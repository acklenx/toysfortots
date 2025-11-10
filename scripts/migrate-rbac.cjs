#!/usr/bin/env node

/**
 * RBAC Migration Script
 *
 * This script adds role and deleted fields to existing volunteers.
 * Run this ONCE before deploying RBAC changes.
 *
 * Usage:
 *   node scripts/migrate-rbac.js [--production]
 *
 * By default, runs against emulators. Use --production flag for production.
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Configuration
const AUTH_VOLUNTEERS_PATH = 'artifacts/toysfortots-eae4d/private/01/data/01/authorizedVolunteers';
const LOCATIONS_PATH = 'artifacts/toysfortots-eae4d/public/01/data/01/locations';
const REPORTS_PATH = 'artifacts/toysfortots-eae4d/public/01/data/01/totsReports';
const ROOT_EMAIL = 'acklenx@gmail.com';
const ROOT_NAME = 'Quincy Acklen';

// Check if running in production mode
const isProduction = process.argv.includes('--production');

// Initialize Firebase Admin
if (isProduction) {
	console.log('🔥 Initializing Firebase Admin for PRODUCTION...');

	// Check for service account key file
	const fs = require('fs');
	const path = require('path');

	// Try multiple possible locations
	const possiblePaths = [
		process.env.GOOGLE_APPLICATION_CREDENTIALS,
		path.join(process.cwd(), 'serviceAccountKey.json'),
		path.join(__dirname, '..', 'serviceAccountKey.json'),
		path.join(process.env.HOME, 'serviceAccountKey.json'),
		path.join(process.env.HOME, 'Downloads', 'serviceAccountKey.json')
	].filter(Boolean);

	let serviceAccountPath = null;
	console.log('🔍 Searching for service account key...');
	for (const tryPath of possiblePaths) {
		const exists = fs.existsSync(tryPath);
		console.log(`   ${exists ? '✓' : '✗'} ${tryPath}`);
		if (exists) {
			serviceAccountPath = tryPath;
			break;
		}
	}

	if (serviceAccountPath) {
		const serviceAccount = require(serviceAccountPath);
		admin.initializeApp({
			credential: admin.credential.cert(serviceAccount),
			projectId: 'toysfortots-eae4d'
		});
		console.log(`✓ Using service account: ${serviceAccountPath}`);
	} else {
		console.log('❌ No service account key found!');
		console.log('   Searched in:');
		possiblePaths.forEach(p => console.log(`     - ${p}`));
		console.log('');
		console.log('   Please download the service account key and place it in one of these locations.');
		console.log('   Or set GOOGLE_APPLICATION_CREDENTIALS environment variable.');
		process.exit(1);
	}
} else {
	console.log('🧪 Initializing Firebase Admin for EMULATORS...');
	process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
	admin.initializeApp({
		projectId: 'toysfortots-eae4d'
	});
}

const db = admin.firestore();

// Helper function to prompt user for confirmation
function promptConfirmation(message) {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	return new Promise((resolve) => {
		rl.question(message + ' (yes/no): ', (answer) => {
			rl.close();
			resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
		});
	});
}

/**
 * Migrate volunteers: Add role and deleted fields
 */
async function migrateVolunteers() {
	console.log('\n📋 Migrating volunteers...');
	const volunteersRef = db.collection(AUTH_VOLUNTEERS_PATH);
	const snapshot = await volunteersRef.get();

	if (snapshot.empty) {
		console.log('⚠️  No volunteers found.');
		return { total: 0, rootFound: false };
	}

	const batch = db.batch();
	let rootFound = false;
	let count = 0;

	snapshot.forEach(doc => {
		const data = doc.data();
		const isRoot = data.email === ROOT_EMAIL || data.displayName === ROOT_NAME;

		if (isRoot) {
			rootFound = true;
			console.log(`👑 Setting ${data.displayName || data.email} as ROOT user`);
		}

		// Determine role (keep existing if already set, otherwise assign based on root status)
		const role = data.role || (isRoot ? 'root' : 'volunteer');

		batch.update(doc.ref, {
			role: role,
			deleted: data.deleted !== undefined ? data.deleted : false,
			modifiedAt: admin.firestore.FieldValue.serverTimestamp()
		});
		count++;

		console.log(`  ✓ ${data.displayName || data.email} → ${role}`);
	});

	await batch.commit();
	console.log(`✅ Migrated ${count} volunteers`);

	if (!rootFound) {
		console.warn(`\n⚠️  WARNING: Root user not found!`);
		console.warn(`   Make sure ${ROOT_EMAIL} or "${ROOT_NAME}" is in authorizedVolunteers`);
	}

	return { total: count, rootFound };
}

/**
 * Migrate locations: Add deleted field
 */
async function migrateLocations() {
	console.log('\n📍 Migrating locations...');
	const locationsRef = db.collection(LOCATIONS_PATH);
	const snapshot = await locationsRef.get();

	if (snapshot.empty) {
		console.log('⚠️  No locations found.');
		return 0;
	}

	const batch = db.batch();
	let count = 0;

	snapshot.forEach(doc => {
		const data = doc.data();
		if (data.deleted === undefined) {
			batch.update(doc.ref, {
				deleted: false
			});
			count++;
		}
	});

	if (count > 0) {
		await batch.commit();
		console.log(`✅ Migrated ${count} locations`);
	} else {
		console.log('✓ All locations already have deleted field');
	}

	return count;
}

/**
 * Migrate reports: Add deleted field
 */
async function migrateReports() {
	console.log('\n📝 Migrating reports...');
	const reportsRef = db.collection(REPORTS_PATH);

	// Query in batches to avoid memory issues
	const batchSize = 500;
	let lastDoc = null;
	let totalMigrated = 0;

	while (true) {
		let query = reportsRef.orderBy(admin.firestore.FieldPath.documentId()).limit(batchSize);
		if (lastDoc) {
			query = query.startAfter(lastDoc);
		}

		const snapshot = await query.get();
		if (snapshot.empty) {
			break;
		}

		const batch = db.batch();
		let batchCount = 0;

		snapshot.forEach(doc => {
			const data = doc.data();
			if (data.deleted === undefined) {
				batch.update(doc.ref, {
					deleted: false
				});
				batchCount++;
			}
			lastDoc = doc;
		});

		if (batchCount > 0) {
			await batch.commit();
			totalMigrated += batchCount;
			console.log(`  ✓ Migrated ${batchCount} reports (total: ${totalMigrated})`);
		}

		if (snapshot.size < batchSize) {
			break; // Last batch
		}
	}

	if (totalMigrated > 0) {
		console.log(`✅ Migrated ${totalMigrated} reports`);
	} else {
		console.log('✓ All reports already have deleted field');
	}

	return totalMigrated;
}

/**
 * Main migration function
 */
async function runMigration() {
	console.log('\n' + '='.repeat(60));
	console.log('  RBAC MIGRATION SCRIPT');
	console.log('='.repeat(60));
	console.log(`\nEnvironment: ${isProduction ? '🔴 PRODUCTION' : '🟢 EMULATORS'}`);
	console.log(`Project ID: toysfortots-eae4d`);

	if (isProduction) {
		console.log('\n⚠️  WARNING: This will modify PRODUCTION data!');
		const confirmed = await promptConfirmation('Are you sure you want to continue?');
		if (!confirmed) {
			console.log('\n❌ Migration cancelled.');
			process.exit(0);
		}
	}

	console.log('\n🚀 Starting migration...');

	try {
		// Migrate volunteers (most important - includes root user setup)
		const volunteerResult = await migrateVolunteers();

		// Migrate locations
		const locationsCount = await migrateLocations();

		// Migrate reports
		const reportsCount = await migrateReports();

		// Summary
		console.log('\n' + '='.repeat(60));
		console.log('  MIGRATION COMPLETE');
		console.log('='.repeat(60));
		console.log(`\n✅ Volunteers: ${volunteerResult.total} migrated`);
		console.log(`   ${volunteerResult.rootFound ? '👑 Root user found' : '⚠️  Root user NOT found'}`);
		console.log(`✅ Locations: ${locationsCount} migrated`);
		console.log(`✅ Reports: ${reportsCount} migrated`);

		if (!volunteerResult.rootFound) {
			console.log('\n⚠️  IMPORTANT: Root user not found!');
			console.log('   Before deploying, ensure Quincy Acklen is added as authorized volunteer.');
		}

		console.log('\n🎉 Migration successful!\n');
		process.exit(0);
	} catch (error) {
		console.error('\n❌ Migration failed:', error);
		process.exit(1);
	}
}

// Run migration
runMigration();
