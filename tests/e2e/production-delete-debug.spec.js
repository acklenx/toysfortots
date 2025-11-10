/**
 * Production Delete Operation Debug Test
 *
 * This test captures comprehensive error details when delete operations fail in production.
 *
 * What it monitors:
 * - All console messages (log, error, warning, info)
 * - All network requests and responses
 * - Failed network requests (status >= 400)
 * - Response headers (especially referrer-policy)
 * - Request payloads
 * - Firestore operations
 * - UI error messages
 *
 * Test location: "Fives" (or first available location)
 * Production URL: https://toysfortots.mcl1311.com/admin/
 */

const { test, expect } = require('@playwright/test');

test.describe('Production Delete Operation Debug', () => {
	let consoleLogs = [];
	let consoleErrors = [];
	let consoleWarnings = [];
	let networkRequests = [];
	let failedRequests = [];
	let responses = [];

	test.beforeEach(async ({ page }) => {
		// Clear arrays for this test
		consoleLogs = [];
		consoleErrors = [];
		consoleWarnings = [];
		networkRequests = [];
		failedRequests = [];
		responses = [];

		// Listen for ALL console messages
		page.on('console', async (msg) => {
			const type = msg.type();
			const text = msg.text();
			const args = await Promise.all(msg.args().map(arg => arg.jsonValue().catch(() => arg.toString())));

			const logEntry = {
				type,
				text,
				args,
				timestamp: new Date().toISOString()
			};

			console.log(`[BROWSER ${type.toUpperCase()}]`, text);

			if (type === 'error') {
				consoleErrors.push(logEntry);
			} else if (type === 'warning') {
				consoleWarnings.push(logEntry);
			} else {
				consoleLogs.push(logEntry);
			}
		});

		// Listen for ALL network requests
		page.on('request', (request) => {
			const requestInfo = {
				url: request.url(),
				method: request.method(),
				headers: request.headers(),
				postData: request.postData(),
				timestamp: new Date().toISOString()
			};
			networkRequests.push(requestInfo);
			console.log(`[REQUEST] ${request.method()} ${request.url()}`);
		});

		// Listen for ALL responses
		page.on('response', async (response) => {
			const url = response.url();
			const status = response.status();
			const headers = response.headers();

			let body = null;
			try {
				// Try to get response body (may fail for some response types)
				const contentType = headers['content-type'] || '';
				if (contentType.includes('json') || contentType.includes('text')) {
					body = await response.text();
				}
			} catch (error) {
				body = `[Could not read body: ${error.message}]`;
			}

			const responseInfo = {
				url,
				status,
				statusText: response.statusText(),
				headers,
				body,
				timestamp: new Date().toISOString()
			};

			responses.push(responseInfo);

			console.log(`[RESPONSE] ${status} ${url}`);

			// Track failed requests (4xx, 5xx)
			if (status >= 400) {
				failedRequests.push(responseInfo);
				console.error(`[FAILED REQUEST] ${status} ${url}`, {
					statusText: response.statusText(),
					headers,
					body
				});
			}
		});

		// Listen for failed requests (network errors)
		page.on('requestfailed', (request) => {
			const failure = {
				url: request.url(),
				method: request.method(),
				failureText: request.failure()?.errorText || 'Unknown error',
				timestamp: new Date().toISOString()
			};
			failedRequests.push(failure);
			console.error(`[REQUEST FAILED]`, failure);
		});

		// Listen for page errors (uncaught exceptions)
		page.on('pageerror', (error) => {
			console.error(`[PAGE ERROR]`, {
				message: error.message,
				stack: error.stack
			});
			consoleErrors.push({
				type: 'pageerror',
				message: error.message,
				stack: error.stack,
				timestamp: new Date().toISOString()
			});
		});
	});

	test('Capture delete operation errors in production', async ({ page }) => {
		console.log('\n=== STARTING PRODUCTION DELETE DEBUG TEST ===\n');

		// Navigate to production admin panel
		console.log('Navigating to production admin panel...');
		await page.goto('https://toysfortots.mcl1311.com/admin/');

		// Wait for login page to load
		await page.waitForSelector('input[type="text"]', { timeout: 10000 });
		console.log('Login page loaded');

		// Login
		console.log('Logging in as claude...');
		await page.fill('input[type="text"]', 'claude');
		await page.fill('input[type="password"]', 'SuperSecret123!@#');
		await page.click('button[type="submit"]');

		// Wait for admin panel to load
		console.log('Waiting for admin panel to load...');
		await page.waitForSelector('.admin-container', { timeout: 15000 });
		console.log('Admin panel loaded');

		// Wait for data to load - look for the boxes table or "no boxes" message
		console.log('Waiting for boxes data to load...');
		await page.waitForFunction(() => {
			const table = document.querySelector('#boxes-table-body');
			const noBoxes = document.querySelector('.no-data');
			return (table && table.children.length > 0) || noBoxes;
		}, { timeout: 15000 });
		console.log('Boxes data loaded');

		// Wait a bit more to ensure all realtime listeners are set up
		await page.waitForTimeout(2000);

		// Take screenshot before delete
		await page.screenshot({ path: 'playwright-report-production/before-delete.png', fullPage: true });
		console.log('Screenshot saved: before-delete.png');

		// Get list of available boxes
		const boxes = await page.$$eval('#boxes-table-body tr', (rows) => {
			return rows.map(row => {
				const label = row.querySelector('td:nth-child(2)')?.textContent?.trim();
				const id = row.querySelector('button[onclick*="deleteBox"]')?.getAttribute('onclick')?.match(/deleteBox\('([^']+)'/)?.[1];
				return { label, id };
			}).filter(box => box.label && box.id);
		});

		console.log(`Found ${boxes.length} boxes:`, boxes.map(b => b.label));

		if (boxes.length === 0) {
			console.log('No boxes available to delete - test cannot proceed');
			return;
		}

		// Try to find "Fives" or use first available box
		let targetBox = boxes.find(b => b.label === 'Fives') || boxes[0];
		console.log(`\nTarget box for deletion: "${targetBox.label}" (ID: ${targetBox.id})`);

		// Click delete button
		console.log('\nClicking delete button...');
		await page.click(`button[onclick*="deleteBox('${targetBox.id}']`);

		// Wait for confirmation modal
		console.log('Waiting for confirmation modal...');
		await page.waitForSelector('#confirmation-modal.active', { timeout: 5000 });
		console.log('Confirmation modal appeared');

		// Take screenshot of modal
		await page.screenshot({ path: 'playwright-report-production/confirmation-modal.png', fullPage: true });
		console.log('Screenshot saved: confirmation-modal.png');

		// Clear previous logs to focus on the delete operation
		const preDeleteLogCount = consoleLogs.length;
		const preDeleteErrorCount = consoleErrors.length;
		const preDeleteRequestCount = networkRequests.length;

		// Click confirm button
		console.log('\n=== CLICKING CONFIRM - MONITORING DELETE OPERATION ===\n');
		await page.click('#modal-confirm');

		// Wait to observe the result (give it time to complete or fail)
		console.log('Waiting for delete operation to complete...');
		await page.waitForTimeout(5000);

		// Take screenshot after delete
		await page.screenshot({ path: 'playwright-report-production/after-delete.png', fullPage: true });
		console.log('Screenshot saved: after-delete.png');

		// Check if there's an alert dialog
		const alerts = [];
		page.on('dialog', async (dialog) => {
			alerts.push({
				type: dialog.type(),
				message: dialog.message()
			});
			console.log(`[ALERT] ${dialog.type()}: ${dialog.message()}`);
			await dialog.accept();
		});

		// Wait a bit more to catch any delayed errors
		await page.waitForTimeout(2000);

		// Analyze results
		console.log('\n=== DELETE OPERATION ANALYSIS ===\n');

		// Console logs from delete operation
		const deleteOperationLogs = consoleLogs.slice(preDeleteLogCount);
		const deleteOperationErrors = consoleErrors.slice(preDeleteErrorCount);
		const deleteOperationRequests = networkRequests.slice(preDeleteRequestCount);

		console.log(`Console logs during delete: ${deleteOperationLogs.length}`);
		console.log(`Console errors during delete: ${deleteOperationErrors.length}`);
		console.log(`Network requests during delete: ${deleteOperationRequests.length}`);
		console.log(`Failed requests: ${failedRequests.length}`);

		// Print DEBUG logs
		const debugLogs = deleteOperationLogs.filter(log => log.text.includes('DELETE DEBUG') || log.text.includes('CONFIRMATION DEBUG'));
		console.log('\n--- DEBUG LOGS FROM DELETE OPERATION ---');
		debugLogs.forEach(log => {
			console.log(`[${log.timestamp}] ${log.text}`);
			if (log.args && log.args.length > 0) {
				console.log('  Args:', JSON.stringify(log.args, null, 2));
			}
		});

		// Print console errors
		if (deleteOperationErrors.length > 0) {
			console.log('\n--- CONSOLE ERRORS ---');
			deleteOperationErrors.forEach(err => {
				console.log(`[${err.timestamp}] ${err.text}`);
				if (err.args && err.args.length > 0) {
					console.log('  Args:', JSON.stringify(err.args, null, 2));
				}
			});
		}

		// Print failed network requests
		if (failedRequests.length > 0) {
			console.log('\n--- FAILED NETWORK REQUESTS ---');
			failedRequests.forEach(req => {
				console.log(`[${req.timestamp}] ${req.status} ${req.url}`);
				console.log('  Status Text:', req.statusText);
				console.log('  Headers:', JSON.stringify(req.headers, null, 2));
				if (req.body) {
					console.log('  Body:', req.body);
				}
			});
		}

		// Print Firestore-related requests
		const firestoreRequests = deleteOperationRequests.filter(req =>
			req.url.includes('firestore.googleapis.com') ||
			req.url.includes('firebaseio.com')
		);
		if (firestoreRequests.length > 0) {
			console.log('\n--- FIRESTORE REQUESTS ---');
			firestoreRequests.forEach(req => {
				console.log(`[${req.timestamp}] ${req.method} ${req.url}`);
				console.log('  Headers:', JSON.stringify(req.headers, null, 2));
				if (req.postData) {
					console.log('  Post Data:', req.postData);
				}
			});
		}

		// Check for specific error patterns
		const hasReferrerPolicyError = deleteOperationErrors.some(err =>
			err.text.toLowerCase().includes('referrer') ||
			err.text.toLowerCase().includes('referer')
		);
		const has400Error = failedRequests.some(req => req.status === 400);
		const hasPermissionError = deleteOperationErrors.some(err =>
			err.text.toLowerCase().includes('permission') ||
			err.text.toLowerCase().includes('denied')
		);
		const hasFirestoreError = deleteOperationErrors.some(err =>
			err.text.toLowerCase().includes('firestore')
		);

		console.log('\n--- ERROR PATTERN DETECTION ---');
		console.log('Referrer policy error:', hasReferrerPolicyError);
		console.log('400 Bad Request:', has400Error);
		console.log('Permission denied error:', hasPermissionError);
		console.log('Firestore error:', hasFirestoreError);

		// Check if delete actually succeeded by looking for the box
		console.log('\n--- CHECKING DELETE RESULT ---');
		await page.waitForTimeout(2000); // Wait for UI update

		const boxStillExists = await page.$$eval('#boxes-table-body tr', (rows, targetLabel) => {
			return rows.some(row => {
				const label = row.querySelector('td:nth-child(2)')?.textContent?.trim();
				return label === targetLabel;
			});
		}, targetBox.label);

		console.log(`Box "${targetBox.label}" still visible in table:`, boxStillExists);

		// Final summary
		console.log('\n=== TEST COMPLETE - SUMMARY ===');
		console.log(`Target: "${targetBox.label}" (${targetBox.id})`);
		console.log(`Delete operation logs: ${debugLogs.length}`);
		console.log(`Console errors: ${deleteOperationErrors.length}`);
		console.log(`Failed requests: ${failedRequests.length}`);
		console.log(`Box still visible: ${boxStillExists}`);
		console.log(`Expected result: Box should be deleted (not visible)`);
		console.log(`Actual result: ${boxStillExists ? 'FAILED - Box still visible' : 'SUCCESS - Box deleted'}`);

		// Write full report to file
		const report = {
			timestamp: new Date().toISOString(),
			targetBox,
			boxStillExists,
			debugLogs: debugLogs.map(l => ({ timestamp: l.timestamp, text: l.text, args: l.args })),
			consoleErrors: deleteOperationErrors,
			failedRequests,
			firestoreRequests,
			allRequests: deleteOperationRequests,
			errorPatterns: {
				hasReferrerPolicyError,
				has400Error,
				hasPermissionError,
				hasFirestoreError
			}
		};

		const fs = require('fs');
		const path = require('path');
		const reportDir = path.join(process.cwd(), 'playwright-report-production');
		if (!fs.existsSync(reportDir)) {
			fs.mkdirSync(reportDir, { recursive: true });
		}
		fs.writeFileSync(
			path.join(reportDir, 'delete-debug-report.json'),
			JSON.stringify(report, null, 2)
		);
		console.log('\nFull report saved to: playwright-report-production/delete-debug-report.json');
	});
});
