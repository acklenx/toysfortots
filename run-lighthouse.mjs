import { chromium } from '@playwright/test';
import { playAudit } from 'playwright-lighthouse';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runLighthouse() {
  console.log('Starting Lighthouse audit...\n');

  const browser = await chromium.launch({
    args: ['--remote-debugging-port=9222'],
  });

  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:5000/', { waitUntil: 'networkidle' });

    await playAudit({
      page: page,
      thresholds: {
        performance: 0,
        accessibility: 0,
        'best-practices': 0,
        seo: 0,
      },
      port: 9222,
    });

    console.log('\n✅ Lighthouse audit complete!');
  } catch (error) {
    console.error('Error running Lighthouse:', error.message);
  } finally {
    await browser.close();
  }
}

runLighthouse();
