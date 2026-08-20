import http from 'http';
import https from 'https';
import { URL } from 'url';

// Helper to follow redirects and get final URL
const followRedirects = (url, maxRedirects = 5) => {
  return new Promise((resolve) => {
    let redirectsCount = 0;
    const requestOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };

    const makeRequest = (currentUrl) => {
      if (redirectsCount > maxRedirects) {
        return resolve({ finalUrl: currentUrl, status: 'ERROR', message: 'Max redirects exceeded' });
      }

      const parsedUrl = new URL(currentUrl);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const req = protocol.get(currentUrl, requestOptions, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          redirectsCount++;
          // Handle relative redirects
          const nextUrl = res.headers.location.startsWith('http') 
            ? res.headers.location 
            : new URL(res.headers.location, currentUrl).href;
          
          res.resume(); // consume response body
          makeRequest(nextUrl);
        } else if (res.statusCode >= 400) {
          res.resume();
          resolve({ finalUrl: currentUrl, status: 'FAIL', statusCode: res.statusCode, message: `HTTP ${res.statusCode}` });
        } else {
          res.resume();
          resolve({ finalUrl: currentUrl, status: 'SUCCESS', statusCode: res.statusCode });
        }
      });

      req.on('error', (err) => {
        resolve({ finalUrl: currentUrl, status: 'ERROR', message: err.message });
      });

      req.end();
    };

    try {
      makeRequest(url);
    } catch (err) {
      resolve({ finalUrl: url, status: 'ERROR', message: err.message });
    }
  });
};

export const validateRedirects = async (mappings, onProgress) => {
  const results = [];
  let completed = 0;

  // Process in small batches to avoid socket exhaustion
  const batchSize = 10;
  for (let i = 0; i < mappings.length; i += batchSize) {
    const batch = mappings.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (mapping) => {
      const { sourceUrl, targetUrl } = mapping;
      if (!sourceUrl || !targetUrl) {
        completed++;
        return { sourceUrl, targetUrl, status: 'SKIPPED', message: 'Missing URL' };
      }

      const result = await followRedirects(sourceUrl);
      
      // Normalize URLs for comparison (strip trailing slashes, ignore query params for strictness if needed, but for now exact match)
      const normalizedFinal = result.finalUrl.replace(/\/$/, '').split('#')[0];
      const normalizedTarget = targetUrl.replace(/\/$/, '').split('#')[0];

      let matchStatus = result.status;
      if (result.status === 'SUCCESS') {
        matchStatus = normalizedFinal === normalizedTarget ? 'PASS' : 'FAIL';
      }

      completed++;
      if (onProgress) {
        onProgress({ current: completed, total: mappings.length });
      }

      return {
        sourceUrl,
        targetUrl,
        actualUrl: result.finalUrl,
        status: matchStatus,
        statusCode: result.statusCode,
        message: result.status === 'SUCCESS' && matchStatus === 'FAIL' 
          ? `Mismatched destination. Expected ${normalizedTarget} but got ${normalizedFinal}` 
          : result.message
      };
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
};
