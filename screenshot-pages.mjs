import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const pages = [
    { url: 'http://localhost:5000/', name: 'home' },
    { url: 'http://localhost:5000/login/', name: 'login' },
    { url: 'http://localhost:5000/dashboard/', name: 'dashboard' },
    { url: 'http://localhost:5000/setup/?id=TEST123', name: 'setup' },
    { url: 'http://localhost:5000/box/?id=TEST123', name: 'box' },
    { url: 'http://localhost:5000/status/?id=TEST123', name: 'status' }
  ];

  for (const pageInfo of pages) {
    console.log(`Capturing ${pageInfo.name}...`);
    try {
      await page.goto(pageInfo.url, { waitUntil: 'networkidle', timeout: 10000 });
      await page.waitForTimeout(1000); // Let everything settle
      await page.screenshot({ path: `/tmp/screenshot-${pageInfo.name}.png`, fullPage: true });
      console.log(`✓ ${pageInfo.name} captured`);
    } catch (error) {
      console.log(`✗ ${pageInfo.name} failed: ${error.message}`);
    }
  }

  await browser.close();
  console.log('\nScreenshots saved to /tmp/screenshot-*.png');
})();
