import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';

async function runDetailedLighthouse() {
  console.log('Starting detailed Lighthouse audit...\n');

  const browser = await chromium.launch({
    args: ['--remote-debugging-port=9222', '--no-sandbox'],
  });

  try {
    const { lhr } = await lighthouse('http://localhost:5000/', {
      port: 9222,
      output: 'json',
      logLevel: 'error',
    });

    console.log('\n========== LIGHTHOUSE SCORES ==========');
    console.log(`Performance: ${lhr.categories.performance.score * 100}`);
    console.log(`Accessibility: ${lhr.categories.accessibility.score * 100}`);
    console.log(`Best Practices: ${lhr.categories['best-practices'].score * 100}`);
    console.log(`SEO: ${lhr.categories.seo.score * 100}`);

    console.log('\n========== PERFORMANCE OPPORTUNITIES ==========');
    const opportunities = Object.values(lhr.audits).filter(
      audit => audit.details && audit.details.type === 'opportunity' && audit.score < 1
    );

    opportunities.sort((a, b) => (b.details.overallSavingsMs || 0) - (a.details.overallSavingsMs || 0));

    opportunities.slice(0, 5).forEach(audit => {
      console.log(`\n${audit.title}`);
      console.log(`  Savings: ${Math.round(audit.details.overallSavingsMs || 0)}ms`);
      console.log(`  ${audit.description}`);
    });

    console.log('\n========== ACCESSIBILITY ISSUES ==========');
    const a11yIssues = Object.values(lhr.audits).filter(
      audit => audit.score !== null && audit.score < 1 && lhr.categories.accessibility.auditRefs.some(ref => ref.id === audit.id)
    );

    if (a11yIssues.length === 0) {
      console.log('✅ No accessibility issues found!');
    } else {
      a11yIssues.forEach(audit => {
        console.log(`\n❌ ${audit.title}`);
        console.log(`  ${audit.description}`);
      });
    }

    console.log('\n========== DIAGNOSTIC INFO ==========');
    console.log(`First Contentful Paint: ${lhr.audits['first-contentful-paint'].displayValue}`);
    console.log(`Largest Contentful Paint: ${lhr.audits['largest-contentful-paint'].displayValue}`);
    console.log(`Total Blocking Time: ${lhr.audits['total-blocking-time'].displayValue}`);
    console.log(`Cumulative Layout Shift: ${lhr.audits['cumulative-layout-shift'].displayValue}`);
    console.log(`Speed Index: ${lhr.audits['speed-index'].displayValue}`);

  } catch (error) {
    console.error('Error running Lighthouse:', error.message);
  } finally {
    await browser.close();
  }
}

runDetailedLighthouse();
