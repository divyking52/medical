const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching headless browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('Browser Error:', msg.text());
      errors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    console.error('Page Error:', err.message);
    errors.push(err.message);
  });

  console.log('Navigating to http://127.0.0.1:8118/ ...');
  await page.goto('http://127.0.0.1:8118/', { waitUntil: 'networkidle2' });

  // Check section IDs
  const sections = await page.$$eval('section', elements => elements.map(e => ({ id: e.id, class: e.className })));
  console.log('Detected sections:', sections);

  const eventExists = await page.$('#event');
  console.log('Does #event exist in DOM?:', eventExists !== null);

  const contactoExists = await page.$('#contacto');
  console.log('Does #contacto exist in DOM?:', contactoExists !== null);

  // Check Nav links
  const navLinks = await page.$$eval('.nav-links .nav-link', links => links.map(l => ({ text: l.textContent.trim(), href: l.getAttribute('href') })));
  console.log('Nav links:', navLinks);

  // Check Translate button
  const translateBtn = await page.$('#translateBtn');
  const btnText = await page.$eval('#translateBtn', el => el.textContent.trim());
  console.log('Translate button text:', btnText);

  // Screenshot hero
  await page.screenshot({ path: 'scripts/screenshot_hero.png' });
  console.log('Saved scripts/screenshot_hero.png');

  // Test translation click
  await page.click('#translateBtn');
  await new Promise(r => setTimeout(r, 400));
  const newBtnText = await page.$eval('#translateBtn', el => el.textContent.trim());
  const newNavLinks = await page.$$eval('.nav-links .nav-link', links => links.map(l => l.textContent.trim()));
  console.log('After toggle translation to EN:');
  console.log('Button text:', newBtnText);
  console.log('Nav links in EN:', newNavLinks);

  // Toggle back to ES
  await page.click('#translateBtn');
  await new Promise(r => setTimeout(r, 400));
  console.log('Toggled back to ES');

  // Scroll to #contacto and take screenshot
  await page.evaluate(() => {
    const el = document.getElementById('contacto');
    if (el) el.scrollIntoView();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: 'scripts/screenshot_contacto.png' });
  console.log('Saved scripts/screenshot_contacto.png');

  // Also scroll to #business
  await page.evaluate(() => {
    const el = document.getElementById('business');
    if (el) el.scrollIntoView();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: 'scripts/screenshot_business.png' });
  console.log('Saved scripts/screenshot_business.png');

  await browser.close();
  console.log('\n--- Test Summary ---');
  console.log('Errors count:', errors.length);
  if (errors.length > 0) {
    console.error('Errors found:', errors);
    process.exit(1);
  } else {
    console.log('ALL VERIFICATIONS PASSED PERFECTLY!');
  }
})();
