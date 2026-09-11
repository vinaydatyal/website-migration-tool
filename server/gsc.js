import { google } from 'googleapis';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKEN_FILE = path.join(__dirname, '..', '.gsc_tokens.json');

// Use environment variables or placeholders if not provided
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback';

// Temporary in-memory store for tokens (in production, save to DB)
const tokenStore = new Map();

// Load tokens from disk if available
try {
  if (fs.existsSync(TOKEN_FILE)) {
    const data = fs.readFileSync(TOKEN_FILE, 'utf8');
    const parsed = JSON.parse(data);
    if (parsed.gsc) tokenStore.set('gsc', parsed.gsc);
    if (parsed.ga4) tokenStore.set('ga4', parsed.ga4);
    if (parsed.currentUser) tokenStore.set('gsc', parsed.currentUser); // Legacy
  }
} catch (e) {
  console.warn('Failed to load GSC tokens from disk:', e.message);
}

function saveTokensToDisk() {
  try {
    const data = { gsc: tokenStore.get('gsc'), ga4: tokenStore.get('ga4') };
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('Failed to save GSC tokens to disk:', e.message);
  }
}

function getOAuthClient(req) {
  let redirectUri = REDIRECT_URI;
  if (req && req.headers && req.headers.host) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    redirectUri = `${protocol}://${req.headers.host}/api/auth/google/callback`;
  }
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri);
}

export function generateAuthUrl(req, res) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).send('Google OAuth credentials missing. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment.');
  }

  const oauth2Client = getOAuthClient(req);
  const service = req.query.service || 'gsc';
  const scopes = [];
  if (service === 'gsc') {
    scopes.push('https://www.googleapis.com/auth/webmasters.readonly');
  } else if (service === 'ga4') {
    scopes.push('https://www.googleapis.com/auth/analytics.readonly');
  }

  const stateObj = { service, r: crypto.randomBytes(8).toString('hex') };
  const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');
  
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state,
    prompt: 'consent'
  });

  // Redirect directly — this lets the client open the popup to this endpoint
  // without needing an async fetch first (which browsers block as popup navigation).
  res.redirect(url);
}


export async function handleAuthCallback(req, res) {
  const { code, state } = req.query;
  
  if (!code) {
    return res.status(400).send('Authorization code missing.');
  }

  try {
    const oauth2Client = getOAuthClient(req);
    const { tokens } = await oauth2Client.getToken(code);
    
    let service = 'gsc';
    try {
      if (state) {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
        if (decoded.service) service = decoded.service;
      }
    } catch (e) {}
    
    tokenStore.set(service, tokens);
    saveTokensToDisk();

    res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage({ type: 'GSC_AUTH_SUCCESS', service: '${service}' }, '*');
            window.close();
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth Callback Error:', error);
    res.status(500).send('Authentication failed.');
  }
}

export async function fetchGscData(req, res) {
  const { siteUrl, startDate, endDate, dimensions } = req.body;

  if (!siteUrl) {
    return res.status(400).json({ error: 'siteUrl is required' });
  }

  const tokens = tokenStore.get('gsc');
  if (!tokens) {
    return res.status(401).json({ error: 'Not authenticated with Google Search Console.' });
  }

  try {
    const oauth2Client = getOAuthClient(req);
    oauth2Client.setCredentials(tokens);

    const searchConsole = google.webmasters({
      version: 'v3',
      auth: oauth2Client,
    });

    // Default to last 30 days if not provided
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const response = await searchConsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: start,
        endDate: end,
        dimensions: dimensions || ['page'],
        rowLimit: 5000,
      },
    });

    const rows = response.data.rows || [];
    
    // Transform rows to a cleaner format
    const data = rows.map(row => ({
      url: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position
    }));

    res.json({ data });
  } catch (error) {
    console.error('GSC API Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch data from Google Search Console' });
  }
}

export async function fetchGscSites(req, res) {
  const tokens = tokenStore.get('gsc');
  if (!tokens) {
    return res.status(401).json({ error: 'Not authenticated with Google Search Console.' });
  }

  try {
    const oauth2Client = getOAuthClient(req);
    oauth2Client.setCredentials(tokens);

    const searchConsole = google.webmasters({
      version: 'v3',
      auth: oauth2Client,
    });

    const response = await searchConsole.sites.list();
    const sites = response.data.siteEntry || [];

    res.json({ sites: sites.map(s => s.siteUrl) });
  } catch (error) {
    console.error('GSC API Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch sites from Google Search Console' });
  }
}

export async function fetchGa4Properties(req, res) {
  const tokens = tokenStore.get('ga4');
  if (!tokens) {
    return res.status(401).json({ error: 'Not authenticated with Google Analytics.' });
  }

  try {
    const oauth2Client = getOAuthClient(req);
    oauth2Client.setCredentials(tokens);

    const analyticsadmin = google.analyticsadmin({
      version: 'v1beta',
      auth: oauth2Client,
    });

    const response = await analyticsadmin.accountSummaries.list();
    const accountSummaries = response.data.accountSummaries || [];
    
    const properties = [];
    accountSummaries.forEach(account => {
      (account.propertySummaries || []).forEach(prop => {
        properties.push({
          id: prop.property,
          name: prop.displayName,
          account: account.displayName
        });
      });
    });

    res.json({ properties });
  } catch (error) {
    console.error('GA4 API Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch properties from GA4' });
  }
}

export async function fetchGa4Data(req, res) {
  const { propertyId, siteUrl, startDate, endDate } = req.body;

  if (!propertyId) {
    return res.status(400).json({ error: 'propertyId is required' });
  }

  const tokens = tokenStore.get('ga4');
  if (!tokens) {
    return res.status(401).json({ error: 'Not authenticated with Google Analytics.' });
  }

  try {
    const oauth2Client = getOAuthClient(req);
    oauth2Client.setCredentials(tokens);

    const analyticsdata = google.analyticsdata({
      version: 'v1beta',
      auth: oauth2Client,
    });

    // Default to last 30 days if not provided
    const end = endDate || 'today';
    const start = startDate || '30daysAgo';

    const response = await analyticsdata.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate: start, endDate: end }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }],
        limit: 10000,
      }
    });

    const rows = response.data.rows || [];
    
    const data = rows.map(row => ({
      url: row.dimensionValues[0].value,
      sessions: parseInt(row.metricValues[0].value, 10) || 0,
      pageviews: parseInt(row.metricValues[1].value, 10) || 0
    }));

    res.json({ data });
  } catch (error) {
    console.error('GA4 API Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch data from GA4' });
  }
}
