import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    console.log('Navigating...');
    await page.goto('https://kings-amish-furniture-draft-site.myshopify.com/password', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(e => console.log('Goto threw:', e.message));
    
    // wait a bit
    await new Promise(r => setTimeout(r, 2000));
    const html = await page.content();
    console.log('HTML Length:', html.length);
    
    const passSelectors = 'input[type="password"]';
    const inputs = await page.$$eval(passSelectors, els => els.map(el => ({ name: el.name, isVisible: el.offsetParent !== null })));
    console.log('Password Inputs:', inputs);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
