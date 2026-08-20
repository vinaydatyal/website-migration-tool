import puppeteer from 'puppeteer';

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = ''; // Ignore fragment
    return u.toString().replace(/\/$/, ''); // Ignore trailing slash
  } catch (e) {
    return null;
  }
}

export async function crawlSite(startUrl, config, onProgress, getIsStopped, getIsPaused, initialState = null) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  if (config?.ignoreRobots) {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  }

  if (config?.authType === 'BASIC_AUTH' && config?.username && config?.password) {
    await page.authenticate({ username: config.username, password: config.password });
  }

  if (config?.authType === 'COOKIE' && config?.customCookie) {
    await page.setExtraHTTPHeaders({ Cookie: config.customCookie });
  }

  if (config?.authType === 'FORM_AUTH' && config?.loginUrl && config?.password) {
    onProgress({ type: 'progress', message: `Attempting form login at ${config.loginUrl}...`, current: 0, total: 0 });
    try {
      await page.goto(config.loginUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      
      // Try to find and click a generic login toggle (like Shopify's 'Enter using password')
      await page.evaluate(() => {
        const toggle = document.querySelector('summary.password-header__login-link, button.password-login, [aria-controls*="login"]');
        if (toggle) toggle.click();
      }).catch(() => {});

      // Wait a moment for any CSS transitions
      await new Promise(r => setTimeout(r, 1000));

      if (config.username) {
        const userSelectors = 'input[type="text"], input[type="email"], input[name*="user"], input[name*="email"], input[id*="user"]';
        await page.waitForSelector(userSelectors, { timeout: 2000 }).catch(() => {});
        const userField = await page.$(userSelectors);
        if (userField) {
          await page.evaluate((selector, val) => {
            const el = document.querySelector(selector);
            if (el) {
              el.value = val;
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }, userSelectors, config.username);
        }
      }
      
      const passSelectors = 'input[type="password"]';
      await page.waitForSelector(passSelectors, { timeout: 5000 });
      
      await page.evaluate((selector, val) => {
        const el = document.querySelector(selector);
        if (el) {
          el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          
          const form = el.closest('form');
          if (form) {
            const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], button');
            if (submitBtn) {
              submitBtn.click();
            } else {
              form.submit();
            }
          }
        }
      }, passSelectors, config.password);
      
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
      onProgress({ type: 'progress', message: `Form login successful!`, current: 0, total: 0 });
    } catch (err) {
      onProgress({ type: 'progress', message: `Form login failed or timed out. Proceeding anyway...`, current: 0, total: 0 });
      console.error('Form login error:', err);
    }
  }

  const visited = initialState?.visited ? new Set(initialState.visited) : new Set();
  const toVisit = initialState?.toVisit ? [...initialState.toVisit] : [{ url: startUrl, depth: 1 }];
  const results = initialState?.results ? [...initialState.results] : [];  
  const maxPages = config?.maxPages || 500;
  const maxDepth = config?.maxDepth || 3;
  const rateLimit = config?.rateLimit || 0;
  
  let exclusionRegex = null;
  if (config?.exclusions) {
    try {
      exclusionRegex = new RegExp(config.exclusions, 'i');
    } catch(e) {
      console.error('Invalid exclusion regex:', e);
    }
  }
  
  let domain;
  try {
    domain = new URL(startUrl).hostname;
  } catch(e) {
    await browser.close();
    throw new Error('Invalid start URL');
  }

  let crawledCount = initialState?.crawledCount || 0;
  while (toVisit.length > 0 && crawledCount < maxPages) {
    if (getIsStopped && getIsStopped()) {
      onProgress({ type: 'progress', message: 'Crawl stopped by user', current: crawledCount, total: visited.size });
      break;
    }
    if (getIsPaused && getIsPaused()) {
      onProgress({ type: 'progress', message: 'Crawl paused by user', current: crawledCount, total: visited.size });
      await browser.close();
      return { 
        isPaused: true, 
        state: { toVisit, visited: Array.from(visited), results, crawledCount } 
      };
    }
    
    const { url: currentUrl, depth: currentDepth } = toVisit.shift();
    const normalized = normalizeUrl(currentUrl);
    
    if (!normalized || visited.has(normalized)) continue;
    
    // Check exclusions
    if (exclusionRegex && exclusionRegex.test(normalized)) continue;
    
    // Only crawl same domain
    try {
      const u = new URL(normalized);
      if (u.hostname !== domain) continue;
    } catch { continue; }
    
    visited.add(normalized);
    
    try {
      onProgress({ 
        type: 'progress', 
        message: `Crawling ${normalized}`, 
        current: crawledCount + 1, 
        total: visited.size + toVisit.length 
      });
      
      const response = await page.goto(normalized, { waitUntil: 'domcontentloaded', timeout: 10000 });
      const statusCode = response ? response.status() : 500;
      
      if (statusCode >= 400) {
        results.push({
          url: normalized,
          title: '', metaDescription: '', h1: '', h2: '',
          statusCode, wordCount: 0, inlinks: 1
        });
        crawledCount++;
        continue;
      }

      const data = await page.evaluate(() => {
        const title = document.title || '';
        const metaDescEl = document.querySelector('meta[name="description"]');
        const metaDescription = metaDescEl ? metaDescEl.getAttribute('content') || '' : '';
        const h1El = document.querySelector('h1');
        const h1 = h1El ? h1El.innerText.trim() : '';
        const h2El = document.querySelector('h2');
        const h2 = h2El ? h2El.innerText.trim() : '';
        const wordCount = document.body ? document.body.innerText.split(/\s+/).length : 0;
        
        const links = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href => href.startsWith('http'));
          
        return { title, metaDescription, h1, h2, wordCount, links };
      });
      
      results.push({
        url: normalized,
        title: data.title,
        metaDescription: data.metaDescription,
        h1: data.h1,
        h2: data.h2,
        statusCode,
        wordCount: data.wordCount,
        inlinks: 1,
        outlinks: data.links.length,
        outgoingLinks: data.links
      });
      
      for (const link of data.links) {
        const nLink = normalizeUrl(link);
        if (nLink && !visited.has(nLink) && currentDepth < maxDepth) {
          // pre-check exclusion to avoid bloating queue
          if (!exclusionRegex || !exclusionRegex.test(nLink)) {
            toVisit.push({ url: nLink, depth: currentDepth + 1 });
          }
        }
      }
      
      crawledCount++;
      if (rateLimit > 0) {
        await new Promise(r => setTimeout(r, rateLimit));
      }
    } catch (error) {
      console.error(`Error crawling ${normalized}:`, error.message);
    }
  }
  
  await browser.close();
  return results;
}
