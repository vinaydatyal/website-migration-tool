import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { crawlSite } from './crawler.js';
import { validateRedirects } from './validator.js';
import { generateAuthUrl, handleAuthCallback, fetchGscData, fetchGscSites, fetchGa4Properties, fetchGa4Data } from './gsc.js';
import { checkDnsAndSsl, checkRobotsTxt, checkSitemapXml } from './infrastructure.js';
import { verifyAuth } from './authMiddleware.js';
import { generatePdfReport } from './pdf.js';
import adminRoutes from './admin.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/admin', adminRoutes);

const generateId = () => Math.random().toString(36).substring(2, 15);

const activeJobs = new Map();

app.post('/api/crawl', verifyAuth, async (req, res) => {
  const { url, config } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const jobId = generateId();
  activeJobs.set(jobId, { status: 'starting', events: [], url, config });

  res.json({ jobId });

  // Start crawling asynchronously
  runCrawlJob(jobId, url, config);
});

async function runCrawlJob(jobId, url, config, initialState = null) {
  try {
    const jobData = activeJobs.get(jobId);
    if (!initialState) {
      jobData.events.push({ type: 'start', message: 'Starting crawl for ' + url });
    } else {
      jobData.events.push({ type: 'progress', message: 'Resuming crawl for ' + url, current: initialState.crawledCount || 0, total: initialState.visited?.length || 0 });
    }
    
    const results = await crawlSite(url, config, (progress) => {
      if (activeJobs.has(jobId)) {
        activeJobs.get(jobId).events.push(progress);
      }
    }, () => {
      return activeJobs.has(jobId) && activeJobs.get(jobId).status === 'stopped';
    }, () => {
      return activeJobs.has(jobId) && activeJobs.get(jobId).status === 'paused';
    }, initialState);
    
    if (activeJobs.has(jobId)) {
      if (results && results.isPaused) {
        const job = activeJobs.get(jobId);
        job.status = 'paused_state';
        job.savedState = results.state;
        job.events.push({ type: 'paused', message: 'Crawl is paused.' });
      } else {
        const entries = Array.isArray(results) ? results : (results?.results || []);
        const summary = results?.summary || {
          totalDiscovered: entries.length,
          crawledCount: entries.length,
          queuedCount: 0,
          maxPagesReached: false,
          maxPages: config?.maxPages || 500,
          successCount: entries.filter(r => r.statusCode && r.statusCode < 400).length,
          errorCount: entries.filter(r => !r.statusCode || r.statusCode >= 400).length
        };
        const job = activeJobs.get(jobId);
        // Store results separately on the job object so GET /api/crawl/results can serve them.
        // We do NOT embed results in the SSE 'done' event to avoid large payload truncation by proxies.
        job.results = entries;
        job.events.push({ type: 'done', summary });
        // NOTE: results are NOT included in the SSE event to avoid payload size limits.
        // The client fetches full results via GET /api/crawl/results?jobId=... after receiving 'done'.
      }
    }
  } catch (error) {
    if (activeJobs.has(jobId)) {
      activeJobs.get(jobId).events.push({ type: 'error', message: error.message });
    }
  }
}

app.post('/api/crawl/pause', verifyAuth, (req, res) => {
  const { jobId } = req.body;
  if (!jobId || !activeJobs.has(jobId)) {
    return res.status(404).json({ error: 'Job not found' });
  }
  const job = activeJobs.get(jobId);
  job.status = 'paused';
  res.json({ success: true });
});

app.post('/api/crawl/resume', verifyAuth, (req, res) => {
  const { jobId } = req.body;
  if (!jobId || !activeJobs.has(jobId)) {
    return res.status(404).json({ error: 'Job not found' });
  }
  const job = activeJobs.get(jobId);
  if (job.status !== 'paused_state' || !job.savedState) {
    return res.status(400).json({ error: 'Job is not in a pausable state' });
  }
  
  job.status = 'crawling';
  runCrawlJob(jobId, job.url, job.config, job.savedState);
  res.json({ success: true });
});

app.post('/api/crawl/stop', verifyAuth, (req, res) => {
  const { jobId } = req.body;
  if (!jobId || !activeJobs.has(jobId)) {
    return res.status(404).json({ error: 'Job not found' });
  }
  const job = activeJobs.get(jobId);
  job.status = 'stopped';
  res.json({ success: true });
});

// PDF generation endpoint removed in favor of client-side window.print()

app.get('/api/crawl/results', verifyAuth, (req, res) => {
  const jobId = req.query.jobId;
  if (!jobId || !activeJobs.has(jobId)) {
    return res.status(404).json({ error: 'Job not found' });
  }
  const job = activeJobs.get(jobId);
  const doneEvent = job.events.find(e => e.type === 'done');
  if (doneEvent) {
    // Results are stored on job.results (not in the SSE done event, to avoid large payload issues)
    return res.json({ status: 'done', results: job.results || [], summary: doneEvent.summary });
  }
  const errorEvent = job.events.find(e => e.type === 'error');
  if (errorEvent) {
    return res.json({ status: 'error', message: errorEvent.message });
  }
  return res.json({ status: job.status, events: job.events });
});

app.get('/api/crawl/events', verifyAuth, (req, res) => {
  const jobId = req.query.jobId;
  if (!jobId || !activeJobs.has(jobId)) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); 

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const job = activeJobs.get(jobId);
  let lastEventIndex = 0;

  const interval = setInterval(() => {
    if (!activeJobs.has(jobId)) {
      clearInterval(interval);
      res.end();
      return;
    }
    
    const currentEvents = job.events;
    while (lastEventIndex < currentEvents.length) {
      const event = currentEvents[lastEventIndex];
      sendEvent(event);
      lastEventIndex++;
      
      if (event.type === 'done' || event.type === 'error') {
        clearInterval(interval);
        // Clean up job after 24 hours to allow reconnects 
        setTimeout(() => activeJobs.delete(jobId), 24 * 60 * 60 * 1000);
        res.end();
        return;
      }
    }
  }, 100);
  
  req.on('close', () => {
    clearInterval(interval);
  });
});

app.post('/api/validate-redirects', verifyAuth, async (req, res) => {
  const { mappings } = req.body;
  if (!mappings || !Array.isArray(mappings)) {
    return res.status(400).json({ error: 'Mappings array is required' });
  }

  const jobId = generateId();
  activeJobs.set(jobId, { status: 'starting', events: [] });

  res.json({ jobId });

  try {
    const jobData = activeJobs.get(jobId);
    jobData.events.push({ type: 'start', message: 'Starting validation for ' + mappings.length + ' URLs' });
    
    const results = await validateRedirects(mappings, (progress) => {
      if (activeJobs.has(jobId)) {
        activeJobs.get(jobId).events.push({ type: 'progress', ...progress });
      }
    });
    
    if (activeJobs.has(jobId)) {
      activeJobs.get(jobId).events.push({ type: 'done', results });
    }
  } catch (error) {
    if (activeJobs.has(jobId)) {
      activeJobs.get(jobId).events.push({ type: 'error', message: error.message });
    }
  }
});

app.get('/api/ping-url', verifyAuth, async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    res.json({ status: response.status, ok: response.ok });
  } catch (error) {
    res.json({ status: 500, ok: false, error: error.message });
  }
});

// --- Google Search Console Endpoints ---
app.get('/api/gsc/auth', verifyAuth, generateAuthUrl); // We'll keep the name or could rename to /api/auth/google
app.get('/api/auth/google/callback', handleAuthCallback);
app.post('/api/gsc/data', verifyAuth, fetchGscData);
app.get('/api/gsc/sites', verifyAuth, fetchGscSites);

// --- Google Analytics 4 Endpoints ---
app.get('/api/ga4/properties', verifyAuth, fetchGa4Properties);
app.post('/api/ga4/data', verifyAuth, fetchGa4Data);

// --- Infrastructure Endpoints ---
app.get('/api/check-dns-ssl', verifyAuth, async (req, res) => {
  const { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });
  try {
    const data = await checkDnsAndSsl(domain);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/check-robots', verifyAuth, async (req, res) => {
  const { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });
  try {
    const data = await checkRobotsTxt(domain);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/check-sitemap', verifyAuth, async (req, res) => {
  const { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });
  try {
    const data = await checkSitemapXml(domain);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- PDF Generation Endpoint ---
app.post('/api/generate-pdf', verifyAuth, async (req, res) => {
  try {
    const pdfBuffer = await generatePdfReport(req.body);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="migration-audit-report.pdf"');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  
  // Catch-all route for React Router (Express 5 compatible)
  app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
