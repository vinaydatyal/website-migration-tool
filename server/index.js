import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { crawlSite } from './crawler.js';
import { generatePdfReport } from './pdfGenerator.js';
import { validateRedirects } from './validator.js';
import { generateAuthUrl, handleAuthCallback, fetchGscData, fetchGscSites, fetchGa4Properties, fetchGa4Data } from './gsc.js';
import { checkDnsAndSsl, checkRobotsTxt, checkSitemapXml } from './infrastructure.js';

const app = express();
app.use(cors());
app.use(express.json());

const generateId = () => Math.random().toString(36).substring(2, 15);

const activeJobs = new Map();

app.post('/api/crawl', async (req, res) => {
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
        activeJobs.get(jobId).events.push({ type: 'done', results });
      }
    }
  } catch (error) {
    if (activeJobs.has(jobId)) {
      activeJobs.get(jobId).events.push({ type: 'error', message: error.message });
    }
  }
}

app.post('/api/crawl/pause', (req, res) => {
  const { jobId } = req.body;
  if (!jobId || !activeJobs.has(jobId)) {
    return res.status(404).json({ error: 'Job not found' });
  }
  const job = activeJobs.get(jobId);
  job.status = 'paused';
  res.json({ success: true });
});

app.post('/api/crawl/resume', (req, res) => {
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

app.post('/api/crawl/stop', (req, res) => {
  const { jobId } = req.body;
  if (!jobId || !activeJobs.has(jobId)) {
    return res.status(404).json({ error: 'Job not found' });
  }
  const job = activeJobs.get(jobId);
  job.status = 'stopped';
  res.json({ success: true });
});

app.post('/api/pdf-report', async (req, res) => {
  try {
    const data = req.body;
    if (!data.stats) {
      return res.status(400).json({ error: 'Stats data is required' });
    }

    const pdfBuffer = await generatePdfReport(data);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="migration-audit-report.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    
    res.end(pdfBuffer);
  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});

app.get('/api/crawl/events', (req, res) => {
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

app.post('/api/validate-redirects', async (req, res) => {
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

app.get('/api/ping-url', async (req, res) => {
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
app.get('/api/gsc/auth', generateAuthUrl); // We'll keep the name or could rename to /api/auth/google
app.get('/api/auth/google/callback', handleAuthCallback);
app.post('/api/gsc/data', fetchGscData);
app.get('/api/gsc/sites', fetchGscSites);

// --- Google Analytics 4 Endpoints ---
app.get('/api/ga4/properties', fetchGa4Properties);
app.post('/api/ga4/data', fetchGa4Data);

// --- Infrastructure Endpoints ---
app.get('/api/check-dns-ssl', async (req, res) => {
  const { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });
  try {
    const data = await checkDnsAndSsl(domain);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/check-robots', async (req, res) => {
  const { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });
  try {
    const data = await checkRobotsTxt(domain);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/check-sitemap', async (req, res) => {
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
app.post('/api/generate-pdf', async (req, res) => {
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
