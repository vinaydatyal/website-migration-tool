import { google } from 'googleapis';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

dotenv.config();

// Initialize Supabase Client for the backend
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  },
  global: {
    WebSocket: WebSocket
  },
  realtime: {
    transport: WebSocket
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use environment variables or placeholders if not provided
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback';

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
  
  // Request BOTH scopes to avoid requiring the user to authenticate twice
  const scopes = [
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/analytics.readonly'
  ];

  // We now have req.user from verifyAuth middleware
  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).send('Unauthorized: User ID missing.');
  }

  const stateObj = { service, userId, r: crypto.randomBytes(8).toString('hex') };
  const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');
  
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state,
    prompt: 'consent'
  });

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
    let userId = null;
    try {
      if (state) {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
        if (decoded.service) service = decoded.service;
        if (decoded.userId) userId = decoded.userId;
      }
    } catch (e) {}

    if (userId) {
      // Upsert tokens into Supabase for BOTH services to avoid double authentication
      const upsertData = [
        { user_id: userId, service: 'gsc', tokens },
        { user_id: userId, service: 'ga4', tokens }
      ];

      const { error } = await supabase
        .from('userTokens')
        .upsert(upsertData, { onConflict: 'user_id,service' });

      if (error) {
        console.error('Error saving tokens to Supabase:', error);
      }
    } else {
      console.error('No userId found in OAuth state, tokens will not be saved to DB.');
    }

    res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage({ type: 'GSC_AUTH_SUCCESS', service: 'gsc' }, '*');
            window.opener.postMessage({ type: 'GSC_AUTH_SUCCESS', service: 'ga4' }, '*');
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

async function getTokensFromReq(req, service) {
  const userId = req.user?.sub;
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from('userTokens')
      .select('tokens')
      .eq('user_id', userId)
      .eq('service', service)
      .single();
      
    if (error || !data) return null;
    return data.tokens;
  } catch (e) {
    console.error('Failed to get tokens from Supabase:', e);
    return null;
  }
}

export async function fetchGscData(req, res) {
  const { siteUrl, startDate, endDate, dimensions } = req.body;

  if (!siteUrl) {
    return res.status(400).json({ error: 'siteUrl is required' });
  }

  const tokens = await getTokensFromReq(req, 'gsc');
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
  const tokens = await getTokensFromReq(req, 'gsc');
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
  const tokens = await getTokensFromReq(req, 'ga4');
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
    console.log('GA4 API response accountSummaries count:', accountSummaries.length);
    if (accountSummaries.length === 0) {
      console.log('Full GA4 response:', JSON.stringify(response.data, null, 2));
    }
    
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
  const { propertyId, startDate, endDate } = req.body;

  if (!propertyId) {
    return res.status(400).json({ error: 'propertyId is required' });
  }

  const tokens = await getTokensFromReq(req, 'ga4');
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
