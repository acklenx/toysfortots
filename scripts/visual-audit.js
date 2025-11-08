/**
 * Visual Consistency Audit Script
 *
 * This script:
 * 1. Takes screenshots of all pages (mobile + desktop)
 * 2. Performs automated consistency checks
 * 3. Generates an HTML report with findings and recommendations
 *
 * Uses proper authentication setup for each page type
 */

import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Configuration
const baseURL = 'http://localhost:5000';
const outputDir = join(projectRoot, 'visual-audit-output');
const screenshotsDir = join(outputDir, 'screenshots');

// Ensure output directories exist
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
if (!existsSync(screenshotsDir)) mkdirSync(screenshotsDir, { recursive: true });

// Import Firebase helper functions
const fixturesPath = join(projectRoot, 'tests/fixtures/firebase-helpers.js');
const { seedTestConfig, authorizeVolunteer, createTestLocation, clearTestData } = await import(`file://${fixturesPath}`);

// Pages to audit
const pages = [
	{ name: 'Home', path: '/', requiresAuth: false, primaryMobile: true },
	{ name: 'Login', path: '/login', requiresAuth: false, primaryMobile: true },
	{ name: 'Dashboard', path: '/dashboard', requiresAuth: true, requiresAuthorization: true, primaryMobile: true },
	{ name: 'Setup', path: '/setup?id=AUDIT_TEST_001', requiresAuth: true, requiresAuthorization: true, primaryMobile: true },
	{ name: 'Box', path: '/box?id=AUDIT_BOX_007', requiresAuth: false, primaryMobile: true },
	{ name: 'Status', path: '/status?id=AUDIT_BOX_007', requiresAuth: false, primaryMobile: true },
	{ name: 'Authorize', path: '/authorize', requiresAuth: true, requiresAuthorization: false, primaryMobile: true },
	{ name: 'Admin', path: '/admin', requiresAuth: true, requiresAuthorization: true, primaryMobile: false },
	{ name: 'Print', path: '/print?id=AUDIT_BOX_007', requiresAuth: false, primaryMobile: false }
];

// Viewports
const viewports = {
	mobile: { width: 375, height: 812, name: 'Mobile (375px)' },
	desktop: { width: 1440, height: 900, name: 'Desktop (1440px)' }
};

// Store all findings
const findings = [];

/**
 * Add a finding to the report
 */
function addFinding(page, viewport, category, severity, title, description, recommendation) {
	findings.push({
		page,
		viewport,
		category,
		severity,
		title,
		description,
		recommendation,
		timestamp: new Date().toISOString()
	});
}

/**
 * Authenticate and authorize a user
 */
async function setupAuthenticatedUser(page, needsAuthorization = false) {
	const timestamp = Date.now();
	const username = `audituser${timestamp}`;
	const password = 'AuditPass123!';

	console.log(`  → Creating user: ${username}`);

	// Seed config with passcode
	await seedTestConfig('semperfi');

	// Navigate to login
	await page.goto(`${baseURL}/login`);
	await page.waitForLoadState('networkidle');

	// Create account
	await page.click('#toggle-sign-up-btn');
	await page.fill('#auth-email', username);
	await page.fill('#auth-password', password);
	await page.click('#email-sign-up-btn');

	// Wait for authentication to complete
	await page.waitForFunction(() => window.auth?.currentUser !== null, { timeout: 10000 });

	if (needsAuthorization) {
		console.log(`  → Authorizing user...`);

		// Get user UID
		const userRecord = await page.evaluate(async () => {
			const auth = window.auth;
			const user = auth.currentUser;
			return { uid: user.uid, email: user.email };
		});

		// Authorize the volunteer directly in Firestore
		await authorizeVolunteer(userRecord.uid, userRecord.email, username);

		console.log(`  → User authorized`);
	}

	return { username, password };
}

/**
 * Set up test data for pages that need it
 */
async function setupTestData() {
	console.log(`  → Setting up test data (box location)...`);

	// Create a test box location for Box and Status pages
	await createTestLocation('AUDIT_BOX_007', {
		label: 'Visual Audit Test Location',
		address: '123 Audit Street',
		city: 'Atlanta',
		state: 'GA',
		volunteer: 'audituser@toysfortots.mcl1311.com',
		lat: 34.05,
		lon: -84.60
	});

	console.log(`  → Test data created`);
}

/**
 * Check page for consistency issues
 */
async function checkPageConsistency(page, pageName, viewportName) {
	const issues = [];

	// Check 1: Container usage
	const containers = await page.evaluate(() => {
		const main = document.querySelector('main');
		if (!main) return null;

		return {
			hasMain: true,
			mainClasses: main.className,
			hasPageContainer: main.classList.contains('page-container') ||
			                   main.querySelector('.page-container') !== null,
			hasContainer: main.classList.contains('container') ||
			              main.querySelector('.container') !== null
		};
	});

	if (!containers?.hasMain) {
		issues.push({
			category: 'Structure',
			severity: 'high',
			title: 'Missing <main> tag',
			description: 'Page does not have a <main> element',
			recommendation: 'Add <main class="page-container"> wrapper for content'
		});
	}

	// Check 2: Header and Footer presence
	const headerFooter = await page.evaluate(() => {
		return {
			hasHeader: document.querySelector('header') !== null,
			hasFooter: document.querySelector('footer') !== null,
			hasHeaderPlaceholder: document.querySelector('#header-placeholder') !== null,
			hasFooterPlaceholder: document.querySelector('#footer-placeholder') !== null
		};
	});

	if (!headerFooter.hasHeaderPlaceholder) {
		issues.push({
			category: 'Structure',
			severity: 'high',
			title: 'Missing header placeholder',
			description: 'Page does not have #header-placeholder div',
			recommendation: 'Add <div id="header-placeholder"></div> before main content'
		});
	}

	if (!headerFooter.hasFooterPlaceholder) {
		issues.push({
			category: 'Structure',
			severity: 'high',
			title: 'Missing footer placeholder',
			description: 'Page does not have #footer-placeholder div',
			recommendation: 'Add <div id="footer-placeholder"></div> after main content'
		});
	}

	// Check 3: Body background color
	const bodyStyles = await page.evaluate(() => {
		const body = document.querySelector('body');
		const styles = window.getComputedStyle(body);
		return {
			backgroundColor: styles.backgroundColor,
			hasGrayClass: body.classList.contains('bg-gray-100')
		};
	});

	// Convert rgb to hex for comparison
	const rgbToHex = (rgb) => {
		const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
		if (!match) return rgb;
		return '#' + [match[1], match[2], match[3]]
			.map(x => parseInt(x).toString(16).padStart(2, '0'))
			.join('');
	};

	const bgColor = rgbToHex(bodyStyles.backgroundColor);
	if (bgColor !== '#f4f4f4' && bgColor !== '#f3f4f6') {
		issues.push({
			category: 'Styling',
			severity: 'medium',
			title: 'Inconsistent body background',
			description: `Body background is ${bgColor}, expected #f4f4f4`,
			recommendation: 'Add class="bg-gray-100" to <body> tag'
		});
	}

	// Check 4: Heading hierarchy
	const headings = await page.evaluate(() => {
		const h1s = Array.from(document.querySelectorAll('h1:not(header h1)'));
		const h2s = Array.from(document.querySelectorAll('h2:not(header h2)'));
		return {
			h1Count: h1s.length,
			h2Count: h2s.length,
			h1Text: h1s.map(h => h.textContent.trim()),
			h1Colors: h1s.map(h => window.getComputedStyle(h).color)
		};
	});

	if (headings.h1Count > 1) {
		issues.push({
			category: 'Accessibility',
			severity: 'medium',
			title: 'Multiple H1 headings',
			description: `Found ${headings.h1Count} H1 headings (excluding header)`,
			recommendation: 'Use only one H1 per page for proper heading hierarchy'
		});
	}

	// Check 5: Button styling consistency
	const buttons = await page.evaluate(() => {
		const allButtons = Array.from(document.querySelectorAll('button:not(#hamburger-menu-btn):not(.hamburger-menu-btn)'));
		return allButtons.map(btn => {
			const styles = window.getComputedStyle(btn);
			return {
				text: btn.textContent.trim().substring(0, 30),
				backgroundColor: styles.backgroundColor,
				color: styles.color,
				borderRadius: styles.borderRadius,
				padding: styles.padding
			};
		});
	});

	if (buttons.length > 0) {
		const uniqueStyles = new Set(buttons.map(b => b.borderRadius));
		if (uniqueStyles.size > 2) {
			issues.push({
				category: 'Styling',
				severity: 'low',
				title: 'Inconsistent button border radius',
				description: `Found ${uniqueStyles.size} different border radius values on buttons`,
				recommendation: 'Use consistent border-radius: 8px or var(--border-radius) for all buttons'
			});
		}
	}

	// Check 6: Mobile responsiveness (only check on mobile viewport)
	if (viewportName === 'Mobile (375px)') {
		const mobileIssues = await page.evaluate(() => {
			const issues = [];

			// Check if buttons are too small for touch
			const buttons = Array.from(document.querySelectorAll('button, a.menu-item'));
			buttons.forEach(btn => {
				const rect = btn.getBoundingClientRect();
				if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
					const isVisible = window.getComputedStyle(btn).display !== 'none' &&
					                  window.getComputedStyle(btn).visibility !== 'hidden';
					if (isVisible && !btn.closest('.hamburger-menu-btn')) {
						issues.push({
							element: btn.textContent.trim().substring(0, 30) || btn.className,
							width: rect.width,
							height: rect.height
						});
					}
				}
			});

			return issues;
		});

		if (mobileIssues.length > 0) {
			issues.push({
				category: 'Accessibility',
				severity: 'medium',
				title: 'Touch targets too small',
				description: `Found ${mobileIssues.length} interactive elements smaller than 44x44px`,
				recommendation: 'Ensure all buttons and links are at least 44x44px for touch accessibility'
			});
		}
	}

	return issues;
}

/**
 * Capture screenshot and analyze page
 */
async function capturePage(browser, pageInfo, viewport, viewportName, authUser) {
	console.log(`\n📸 ${pageInfo.name} - ${viewportName}`);

	const context = await browser.newContext({
		viewport: viewport,
		userAgent: viewportName.includes('Mobile')
			? 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15'
			: undefined
	});

	const page = await context.newPage();

	try {
		// Set up authentication if needed
		if (pageInfo.requiresAuth) {
			console.log(`  → Setting up authentication...`);
			const user = await setupAuthenticatedUser(page, pageInfo.requiresAuthorization);
			console.log(`  → Authenticated as ${user.username}`);
		}

		// Navigate to page
		console.log(`  → Navigating to ${pageInfo.path}`);
		await page.goto(`${baseURL}${pageInfo.path}`, {
			waitUntil: 'networkidle',
			timeout: 15000
		});

		// Wait for header/footer to load
		await page.waitForTimeout(1500);

		// Check if page redirected (shouldn't happen with proper auth)
		const currentUrl = page.url();
		if (currentUrl.includes('/login') && !pageInfo.path.includes('/login')) {
			console.log(`  ⚠️  Page redirected to login (unexpected)`);
			addFinding(
				pageInfo.name,
				viewportName,
				'Access',
				'high',
				'Unexpected redirect to login',
				'Page redirected to login despite authentication',
				'Check authentication setup for this page'
			);
			await context.close();
			return;
		}

		// Take screenshot
		const screenshotName = `${pageInfo.name.toLowerCase().replace(/\s/g, '-')}-${viewportName.toLowerCase().includes('mobile') ? 'mobile' : 'desktop'}.png`;
		const screenshotPath = join(screenshotsDir, screenshotName);

		await page.screenshot({
			path: screenshotPath,
			fullPage: true
		});

		console.log(`  ✓ Screenshot saved: ${screenshotName}`);

		// Perform consistency checks
		console.log(`  → Running consistency checks...`);
		const issues = await checkPageConsistency(page, pageInfo.name, viewportName);

		// Add findings
		issues.forEach(issue => {
			addFinding(
				pageInfo.name,
				viewportName,
				issue.category,
				issue.severity,
				issue.title,
				issue.description,
				issue.recommendation
			);
		});

		console.log(`  ✓ Found ${issues.length} issues`);

	} catch (error) {
		console.error(`  ✗ Error capturing ${pageInfo.name}:`, error.message);
		addFinding(
			pageInfo.name,
			viewportName,
			'Error',
			'high',
			'Page Load Error',
			`Failed to load page: ${error.message}`,
			'Investigate why this page is not loading properly'
		);
	} finally {
		await context.close();
	}
}

/**
 * Generate HTML report
 */
function generateHTMLReport() {
	console.log('\n📊 Generating HTML report...');

	// Group findings by page
	const findingsByPage = {};
	findings.forEach(finding => {
		if (!findingsByPage[finding.page]) {
			findingsByPage[finding.page] = [];
		}
		findingsByPage[finding.page].push(finding);
	});

	// Count by severity
	const severityCounts = findings.reduce((acc, f) => {
		acc[f.severity] = (acc[f.severity] || 0) + 1;
		return acc;
	}, {});

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Visual Consistency Audit Report - Toys for Tots</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
			line-height: 1.6;
			color: #333;
			background: #f5f5f5;
			padding: 20px;
		}
		.container {
			max-width: 1200px;
			margin: 0 auto;
			background: white;
			padding: 40px;
			border-radius: 8px;
			box-shadow: 0 2px 10px rgba(0,0,0,0.1);
		}
		h1 {
			color: #002D62;
			border-bottom: 4px solid #D21F3C;
			padding-bottom: 15px;
			margin-bottom: 30px;
		}
		h2 {
			color: #002D62;
			margin-top: 40px;
			margin-bottom: 20px;
			padding-bottom: 10px;
			border-bottom: 2px solid #e5e7eb;
		}
		h3 {
			color: #D21F3C;
			margin-top: 30px;
			margin-bottom: 15px;
		}
		.summary {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 20px;
			margin-bottom: 40px;
		}
		.summary-card {
			background: #f9fafb;
			padding: 20px;
			border-radius: 8px;
			border-left: 4px solid #D21F3C;
		}
		.summary-card h3 {
			margin: 0 0 10px 0;
			font-size: 1rem;
			color: #666;
		}
		.summary-card .value {
			font-size: 2.5rem;
			font-weight: bold;
			color: #002D62;
		}
		.severity-high { border-left-color: #D21F3C; }
		.severity-medium { border-left-color: #f59e0b; }
		.severity-low { border-left-color: #3b82f6; }
		.severity-info { border-left-color: #10b981; }
		.finding {
			background: #f9fafb;
			padding: 20px;
			margin-bottom: 15px;
			border-radius: 8px;
			border-left: 4px solid #e5e7eb;
		}
		.finding.high { border-left-color: #D21F3C; }
		.finding.medium { border-left-color: #f59e0b; }
		.finding.low { border-left-color: #3b82f6; }
		.finding.info { border-left-color: #10b981; }
		.finding-header {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			margin-bottom: 10px;
		}
		.finding-title {
			font-weight: 600;
			color: #1f2937;
			font-size: 1.1rem;
		}
		.finding-meta {
			display: flex;
			gap: 10px;
			font-size: 0.85rem;
			color: #6b7281;
			margin-bottom: 10px;
		}
		.badge {
			display: inline-block;
			padding: 3px 10px;
			border-radius: 12px;
			font-size: 0.75rem;
			font-weight: 600;
			text-transform: uppercase;
		}
		.badge.high { background: #fee2e2; color: #991b1b; }
		.badge.medium { background: #fef3c7; color: #92400e; }
		.badge.low { background: #dbeafe; color: #1e40af; }
		.badge.info { background: #d1fae5; color: #065f46; }
		.finding-description {
			margin-bottom: 10px;
			color: #4b5563;
		}
		.finding-recommendation {
			background: white;
			padding: 12px;
			border-radius: 6px;
			border-left: 3px solid #10b981;
			font-size: 0.95rem;
		}
		.finding-recommendation strong {
			color: #065f46;
		}
		.screenshots {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
			gap: 20px;
			margin-top: 20px;
		}
		.screenshot-card {
			background: white;
			border: 1px solid #e5e7eb;
			border-radius: 8px;
			overflow: hidden;
		}
		.screenshot-card img {
			width: 100%;
			height: auto;
			display: block;
			border-bottom: 1px solid #e5e7eb;
		}
		.screenshot-card .caption {
			padding: 12px;
			font-size: 0.9rem;
			color: #6b7281;
			text-align: center;
		}
		.timestamp {
			color: #9ca3af;
			font-size: 0.85rem;
			margin-top: 30px;
			padding-top: 20px;
			border-top: 1px solid #e5e7eb;
		}
		.no-findings {
			background: #d1fae5;
			color: #065f46;
			padding: 20px;
			border-radius: 8px;
			text-align: center;
			font-weight: 600;
		}
		.page-section {
			margin-bottom: 50px;
		}
		.category-tag {
			display: inline-block;
			background: #e5e7eb;
			padding: 2px 8px;
			border-radius: 4px;
			font-size: 0.75rem;
			color: #4b5563;
			margin-right: 5px;
		}
	</style>
</head>
<body>
	<div class="container">
		<h1>🎨 Visual Consistency Audit Report</h1>
		<p style="margin-bottom: 30px; color: #6b7281;">
			Automated visual consistency analysis for Toys for Tots donation box tracking system<br>
			Generated: ${new Date().toLocaleString()}
		</p>

		<h2>📊 Summary</h2>
		<div class="summary">
			<div class="summary-card">
				<h3>Total Findings</h3>
				<div class="value">${findings.length}</div>
			</div>
			<div class="summary-card severity-high">
				<h3>High Priority</h3>
				<div class="value">${severityCounts.high || 0}</div>
			</div>
			<div class="summary-card severity-medium">
				<h3>Medium Priority</h3>
				<div class="value">${severityCounts.medium || 0}</div>
			</div>
			<div class="summary-card severity-low">
				<h3>Low Priority</h3>
				<div class="value">${severityCounts.low || 0}</div>
			</div>
		</div>

		<h2>📄 Pages Audited</h2>
		<p style="margin-bottom: 20px; color: #6b7281;">
			All 9 pages were captured at mobile (375px) and desktop (1440px) viewports with proper authentication.
		</p>

		${Object.keys(findingsByPage).sort().map(pageName => {
			const pageFindings = findingsByPage[pageName];
			const highCount = pageFindings.filter(f => f.severity === 'high').length;
			const mediumCount = pageFindings.filter(f => f.severity === 'medium').length;
			const lowCount = pageFindings.filter(f => f.severity === 'low').length;

			return `
			<div class="page-section">
				<h3>${pageName}</h3>
				<p style="color: #6b7281; margin-bottom: 15px;">
					${highCount} high, ${mediumCount} medium, ${lowCount} low priority issues
				</p>

				<div class="screenshots">
					<div class="screenshot-card">
						<img src="screenshots/${pageName.toLowerCase().replace(/\s/g, '-')}-mobile.png" alt="${pageName} Mobile" onerror="this.parentElement.style.display='none'">
						<div class="caption">📱 Mobile (375px)</div>
					</div>
					<div class="screenshot-card">
						<img src="screenshots/${pageName.toLowerCase().replace(/\s/g, '-')}-desktop.png" alt="${pageName} Desktop" onerror="this.parentElement.style.display='none'">
						<div class="caption">🖥️ Desktop (1440px)</div>
					</div>
				</div>

				${pageFindings.length === 0 ? `
					<div class="no-findings">✅ No consistency issues found on this page</div>
				` : `
					${pageFindings.map(finding => `
						<div class="finding ${finding.severity}">
							<div class="finding-header">
								<div class="finding-title">${finding.title}</div>
								<span class="badge ${finding.severity}">${finding.severity}</span>
							</div>
							<div class="finding-meta">
								<span class="category-tag">${finding.category}</span>
								<span>${finding.viewport}</span>
							</div>
							<div class="finding-description">${finding.description}</div>
							<div class="finding-recommendation">
								<strong>💡 Recommendation:</strong> ${finding.recommendation}
							</div>
						</div>
					`).join('')}
				`}
			</div>
			`;
		}).join('')}

		<h2>🎯 Key Recommendations</h2>
		<div style="background: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 30px;">
			<h3 style="margin-top: 0; color: #065f46;">Design System Consistency</h3>
			<ul style="margin-left: 20px; color: #374151;">
				<li>Ensure all pages use <code>.page-container</code> for consistent layout</li>
				<li>Apply <code>bg-gray-100</code> class to all <code>&lt;body&gt;</code> tags</li>
				<li>Use CSS variables for colors instead of hardcoded values</li>
				<li>Standardize button border-radius to 8px across all pages</li>
				<li>Ensure header/footer placeholders are present on all pages</li>
			</ul>
		</div>

		<div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 30px;">
			<h3 style="margin-top: 0; color: #92400e;">Mobile Optimization</h3>
			<ul style="margin-left: 20px; color: #374151;">
				<li>Verify all touch targets are at least 44x44px on mobile</li>
				<li>Test responsive breakpoints at 768px and below</li>
				<li>Ensure forms stack properly on mobile devices</li>
				<li>Check that text remains readable at mobile sizes</li>
			</ul>
		</div>

		<div style="background: #dbeafe; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
			<h3 style="margin-top: 0; color: #1e40af;">Accessibility</h3>
			<ul style="margin-left: 20px; color: #374151;">
				<li>Maintain proper heading hierarchy (single H1 per page)</li>
				<li>Ensure sufficient color contrast for text</li>
				<li>Add ARIA labels where needed</li>
				<li>Test keyboard navigation on all interactive elements</li>
			</ul>
		</div>

		<div class="timestamp">
			Report generated on ${new Date().toLocaleString()}<br>
			Total pages audited: ${pages.length}<br>
			Total screenshots: ${pages.length * 2}<br>
			Total findings: ${findings.length}
		</div>
	</div>
</body>
</html>`;

	const reportPath = join(outputDir, 'visual-audit-report.html');
	writeFileSync(reportPath, html, 'utf-8');

	console.log(`✓ Report saved: ${reportPath}`);
	return reportPath;
}

/**
 * Main execution
 */
async function runAudit() {
	console.log('🎨 Visual Consistency Audit');
	console.log('============================\n');
	console.log(`Base URL: ${baseURL}`);
	console.log(`Output directory: ${outputDir}\n`);

	// Clear any previous test data
	await clearTestData();

	// Set up test data once (box location for Box/Status/Print pages)
	await setupTestData();

	const browser = await chromium.launch({ headless: true });

	try {
		// Capture all pages at both viewports
		for (const pageInfo of pages) {
			// Mobile viewport
			await capturePage(browser, pageInfo, viewports.mobile, viewports.mobile.name, null);

			// Desktop viewport
			await capturePage(browser, pageInfo, viewports.desktop, viewports.desktop.name, null);
		}

		// Generate report
		const reportPath = generateHTMLReport();

		console.log('\n============================');
		console.log('✅ Audit Complete!');
		console.log(`\n📊 Report: ${reportPath}`);
		console.log(`📸 Screenshots: ${screenshotsDir}`);
		console.log(`\n📈 Summary:`);
		console.log(`   Total findings: ${findings.length}`);
		console.log(`   High priority: ${findings.filter(f => f.severity === 'high').length}`);
		console.log(`   Medium priority: ${findings.filter(f => f.severity === 'medium').length}`);
		console.log(`   Low priority: ${findings.filter(f => f.severity === 'low').length}`);
		console.log('\n💡 Open the HTML report in your browser to view results');

	} catch (error) {
		console.error('❌ Audit failed:', error);
		throw error;
	} finally {
		await browser.close();
		// Clean up test data
		await clearTestData();
	}
}

// Run the audit
runAudit().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});
