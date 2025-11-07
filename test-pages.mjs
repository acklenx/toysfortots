import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Capture console logs and errors
  page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', error => console.log(`[ERROR] ${error}`));

  const pages = [
    { url: 'http://localhost:5000/box/?id=TEST123', name: 'box' },
  ];

  for (const pageInfo of pages) {
    console.log(`\n=== Testing ${pageInfo.name} ===`);
    try {
      await page.goto(pageInfo.url, { waitUntil: 'networkidle', timeout: 10000 });
      await page.waitForTimeout(2000);

      const finalUrl = page.url();
      const title = await page.title();

      console.log(`Final URL: ${finalUrl}`);
      console.log(`Title: ${title}`);

      const bodyText = await page.locator('body').textContent();
      console.log(`Body contains "Drop Box": ${bodyText.includes('Drop Box')}`);
      console.log(`Body contains "Volunteer Access": ${bodyText.includes('Volunteer Access')}`);

    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
  }

  await browser.close();
})();
