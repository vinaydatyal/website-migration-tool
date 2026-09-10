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
  const maxConcurrency = config?.concurrency || 5; // Limits memory usage on Free Tiers
  
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
  let isCrawling = true;
  let isPausedState = false;
  let activeWorkers = 0;

  // The initial page used for setup/auth is no longer needed, close it to free memory
  if (page) await page.close().catch(() => {});

  // Sitemap Discovery (only on fresh start)
  if (!initialState && !getIsStopped?.() && !getIsPaused?.()) {
    onProgress({ type: 'progress', message: `Discovering sitemaps for ${domain}...`, current: 0, total: 0 });
    try {
      const parsedUrl = new URL(startUrl);
      const origin = `${parsedUrl.protocol}//${parsedUrl.host}`;
      let sitemapUrls = [];
      
      const robotsResponse = await fetch(`${origin}/robots.txt`).catch(() => null);
      if (robotsResponse && robotsResponse.ok) {
        const robotsText = await robotsResponse.text();
        const matches = robotsText.matchAll(/Sitemap:\s*(https?:\/\/[^\s]+)/gi);
        for (const match of matches) {
          sitemapUrls.push(match[1]);
        }
      }
      
      if (sitemapUrls.length === 0) {
        sitemapUrls.push(`${origin}/sitemap.xml`);
      }

      const fetchSitemap = async (sUrl) => {
        try {
          const res = await fetch(sUrl).catch(() => null);
          if (!res || !res.ok) return [];
          const text = await res.text();
          const urls = [];
          
          if (text.includes('<sitemapindex')) {
             const nestedMatches = text.matchAll(/<loc>(.*?)<\/loc>/g);
             for (const m of nestedMatches) {
                const nestedUrls = await fetchSitemap(m[1].trim());
                urls.push(...nestedUrls);
             }
          } else {
             const locMatches = text.matchAll(/<loc>(.*?)<\/loc>/g);
             for (const m of locMatches) {
                urls.push(m[1].trim());
             }
          }
          return urls;
        } catch(e) {
          return [];
        }
      };

      const addedFromSitemap = new Set();
      for (const sitemapUrl of sitemapUrls) {
         const discovered = await fetchSitemap(sitemapUrl);
         for (const dUrl of discovered) {
           const normalized = normalizeUrl(dUrl);
           if (normalized && !visited.has(normalized) && !addedFromSitemap.has(normalized)) {
              let shouldAdd = true;
              if (exclusionRegex && exclusionRegex.test(normalized)) shouldAdd = false;
              try { if (new URL(normalized).hostname !== domain) shouldAdd = false; } catch { shouldAdd = false; }
              
              if (shouldAdd) {
                 toVisit.push({ url: dUrl, depth: 1 });
                 addedFromSitemap.add(normalized);
              }
           }
         }
      }
      if (addedFromSitemap.size > 0) {
         onProgress({ type: 'progress', message: `Found ${addedFromSitemap.size} URLs via Sitemap!`, current: 0, total: addedFromSitemap.size });
      }
    } catch(err) {
       console.error('Sitemap discovery error:', err);
    }
  }

  await new Promise((resolve) => {
    const processNext = async () => {
      // 1. Check external termination signals
      if (getIsStopped && getIsStopped()) {
        isCrawling = false;
      }
      if (getIsPaused && getIsPaused()) {
        isCrawling = false;
        isPausedState = true;
      }

      // 2. Base case: Finish the pool
      if (!isCrawling || (toVisit.length === 0 && activeWorkers === 0) || crawledCount >= maxPages) {
        if (activeWorkers === 0) resolve(); // All workers drained
        return;
      }

      // 3. Waiting case: Idle until another worker adds links
      if (toVisit.length === 0) return;
      
      // 4. Concurrency limit
      if (activeWorkers >= maxConcurrency) return;

      // 5. Claim a task
      activeWorkers++;
      const currentItem = toVisit.shift();
      if (!currentItem) {
        activeWorkers--;
        processNext();
        return;
      }
      
      const { url: currentUrl, depth: currentDepth } = currentItem;
      const normalized = normalizeUrl(currentUrl);

      // 6. Validate URL
      let shouldCrawl = true;
      if (!normalized || visited.has(normalized)) shouldCrawl = false;
      if (exclusionRegex && exclusionRegex.test(normalized)) shouldCrawl = false;
      try {
        const u = new URL(normalized);
        if (u.hostname !== domain) shouldCrawl = false;
      } catch { shouldCrawl = false; }

      if (!shouldCrawl) {
        activeWorkers--;
        processNext(); // Try the next link immediately
        return;
      }

      // 7. Mark visited and update progress
      visited.add(normalized);
      crawledCount++;

      onProgress({ 
        type: 'progress', 
        message: `Crawling ${normalized}`, 
        current: crawledCount, 
        total: visited.size + toVisit.length 
      });

      // 8. Fire off another worker to hit max concurrency if queue allows
      processNext();

      // 9. Process the URL
      let workerPage;
      try {
        workerPage = await browser.newPage();
        
        // Speed hack: Block heavy non-HTML resources
        await workerPage.setRequestInterception(true);
        workerPage.on('request', (req) => {
          if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
            req.abort();
          } else {
            req.continue();
          }
        });

        // 15s timeout to prevent hanging on bad connections
        const response = await workerPage.goto(normalized, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const statusCode = response ? response.status() : 500;
        
        if (statusCode >= 400) {
          results.push({
            url: normalized,
            title: '', metaDescription: '', h1: '', h2: '',
            statusCode, wordCount: 0, inlinks: 1
          });
        } else {
          // Extract DOM metadata
          const data = await workerPage.evaluate(() => {
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
          
          // Queue new internal links
          for (const link of data.links) {
            const nLink = normalizeUrl(link);
            if (nLink && !visited.has(nLink) && currentDepth < maxDepth) {
              if (!exclusionRegex || !exclusionRegex.test(nLink)) {
                toVisit.push({ url: nLink, depth: currentDepth + 1 });
              }
            }
          }
        }
        
        // Respect rate limits if set
        if (rateLimit > 0) {
          await new Promise(r => setTimeout(r, rateLimit));
        }
      } catch (error) {
        console.error(`Error crawling ${normalized}:`, error.message);
      } finally {
        // ALWAYS clean up the page context to prevent memory leaks
        if (workerPage) await workerPage.close().catch(() => {});
        activeWorkers--;
        processNext(); // Notify pool that a slot is free
      }
    };

    // Kickoff initial batch of workers
    for (let i = 0; i < maxConcurrency; i++) {
      processNext();
    }
  });

  if (isPausedState) {
    onProgress({ type: 'progress', message: 'Crawl paused by user', current: crawledCount, total: visited.size });
    await browser.close();
    return { 
      isPaused: true, 
      state: { toVisit, visited: Array.from(visited), results, crawledCount } 
    };
  }

  if (getIsStopped && getIsStopped()) {
    onProgress({ type: 'progress', message: 'Crawl stopped by user', current: crawledCount, total: visited.size });
  }

  await browser.close();
  return results;
}
