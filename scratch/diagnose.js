import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  
  page.on('console', m => console.log('LOG:', m.type(), m.text()));
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message, '\nSTACK:\n', e.stack));
  page.on('requestfailed', r => console.log('FAILED REQ:', r.url(), r.failure()?.errorText));

  console.log('Loading /blink-esim/dashboard...');
  await page.goto('https://website-migration-tool-production.up.railway.app/blink-esim/dashboard', { 
    waitUntil: 'networkidle2',
    timeout: 30000 
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  const root = await page.evaluate(() => {
    const el = document.getElementById('root');
    return {
      innerHTML: el ? el.innerHTML.slice(0, 500) : null,
      visibleText: document.body.innerText
    };
  });
  console.log('BODY TEXT PREVIEW:', root.visibleText.slice(0, 300));

  await browser.close();
})();
