/**
 * Firebase Emulator Helpers for E2E Tests
 */

import admin from 'firebase-admin';

let initialized = false;
let db = null;

const PRIVATE_PATH_PREFIX = 'artifacts/toysfortots-eae4d/private/01/data/01';
const PUBLIC_DATA_PREFIX = 'artifacts/toysfortots-eae4d/public/01/data/01';
const AUTH_VOLUNTEERS_PATH = `${PRIVATE_PATH_PREFIX}/authorizedVolunteers`;
const CONFIG_PATH = `${PRIVATE_PATH_PREFIX}/metadata/config`;
const LOCATIONS_PATH = `${PUBLIC_DATA_PREFIX}/locations`;
const REPORTS_PATH = `${PUBLIC_DATA_PREFIX}/totsReports`;

/**
 * Initialize Firebase Admin SDK for emulator
 */
function initializeFirebaseAdmin() {
  if (initialized) return db;

  // Initialize with emulator settings
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: 'toysfortots-eae4d'
    });
  }

  db = admin.firestore();

  // Connect to emulator
  db.settings({
    host: 'localhost:8080',
    ssl: false
  });

  initialized = true;
  return db;
}

/**
 * Seed the database with test configuration
 */
async function seedTestConfig(passcode = 'TEST_PASSCODE') {
  const firestore = initializeFirebaseAdmin();

  const configRef = firestore.doc(CONFIG_PATH);
  await configRef.set({
    sharedPasscode: passcode,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Verify write with retry for emulator race conditions
  let retries = 3;
  let verifyDoc;
  while (retries > 0) {
    verifyDoc = await configRef.get();
    if (verifyDoc.exists) break;
    await new Promise(resolve => setTimeout(resolve, 100));
    retries--;
  }

  if (!verifyDoc.exists) {
    throw new Error('Failed to verify config was created');
  }

  return passcode;
}

/**
 * Add an authorized volunteer to the database
 */
async function authorizeVolunteer(uid, email, displayName) {
  const firestore = initializeFirebaseAdmin();

  const volunteerRef = firestore.doc(`${AUTH_VOLUNTEERS_PATH}/${uid}`);
  await volunteerRef.set({
    email: email,
    displayName: displayName || email,
    authorizedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Verify write
  const verifyDoc = await volunteerRef.get();
  if (!verifyDoc.exists) {
    throw new Error(`Failed to verify volunteer ${uid} was authorized`);
  }
}

/**
 * Create a test location/box
 */
async function createTestLocation(boxId, data = {}) {
  const firestore = initializeFirebaseAdmin();

  const locationData = {
    label: data.label || `Test Location ${boxId}`,
    address: data.address || '123 Test St',
    city: data.city || 'Atlanta',
    state: data.state || 'GA',
    boxes: data.boxes || 1,
    volunteer: data.volunteer || 'Test Volunteer',
    status: data.status || 'active',
    created: new Date().toISOString(),
    provisionedBy: data.provisionedBy || 'test-uid',
    lat: data.lat || 33.7490,
    lon: data.lon || -84.3880,
    contactName: data.contactName || 'Test Contact',
    contactEmail: data.contactEmail || 'test@example.com',
    contactPhone: data.contactPhone || '555-1234',
    ...data
  };

  const locationRef = firestore.doc(`${LOCATIONS_PATH}/${boxId}`);
  await locationRef.set(locationData);

  // Create initial report
  const reportRef = firestore.collection(REPORTS_PATH).doc();
  await reportRef.set({
    ...locationData,
    boxId: boxId,
    reportType: 'box_registered',
    description: `Box registered by ${locationData.volunteer}.`,
    timestamp: locationData.created,
    status: 'cleared',
    reporterId: locationData.provisionedBy
  });

  // Verify data is readable (ensures emulator has committed the write)
  const verifyDoc = await locationRef.get();
  if (!verifyDoc.exists) {
    throw new Error(`Failed to verify location ${boxId} was created`);
  }

  return locationData;
}

/**
 * Create a test report
 */
async function createTestReport(boxId, reportData = {}) {
  const firestore = initializeFirebaseAdmin();

  // Get location data
  const locationDoc = await firestore.doc(`${LOCATIONS_PATH}/${boxId}`).get();
  if (!locationDoc.exists) {
    throw new Error(`Location ${boxId} not found`);
  }

  const locationData = locationDoc.data();

  const report = {
    boxId: boxId,
    label: locationData.label,
    address: locationData.address,
    city: locationData.city,
    state: locationData.state,
    volunteer: locationData.volunteer,
    reportType: reportData.reportType || 'problem_report',
    description: reportData.description || 'Test problem description',
    notes: reportData.notes || '',
    timestamp: new Date().toISOString(),
    status: reportData.status || 'new',
    reporterId: reportData.reporterId || 'anonymous',
    ...reportData
  };

  const reportRef = firestore.collection(REPORTS_PATH).doc();
  await reportRef.set(report);

  // Verify data is readable (ensures emulator has committed the write)
  const verifyDoc = await reportRef.get();
  if (!verifyDoc.exists) {
    throw new Error(`Failed to verify report was created`);
  }

  return { id: reportRef.id, ...report };
}

/**
 * Clean up all test data
 */
async function clearTestData() {
  const firestore = initializeFirebaseAdmin();

  try {
    // Clear collections
    const collections = [
      AUTH_VOLUNTEERS_PATH,
      LOCATIONS_PATH,
      REPORTS_PATH
    ];

    for (const collectionPath of collections) {
      const snapshot = await firestore.collection(collectionPath).get();
      const batch = firestore.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      if (snapshot.size > 0) {
        await batch.commit();
      }
    }

    // Clear config
    await firestore.doc(CONFIG_PATH).delete().catch(() => {});

    // Small delay to ensure emulator processes all deletes
    await new Promise(resolve => setTimeout(resolve, 50));
  } catch (error) {
    console.error('Error clearing test data:', error);
  }
}

/**
 * Get all reports for a box
 */
async function getReportsForBox(boxId) {
  const firestore = initializeFirebaseAdmin();
  const snapshot = await firestore
    .collection(REPORTS_PATH)
    .where('boxId', '==', boxId)
    .orderBy('timestamp', 'asc')
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export {
  initializeFirebaseAdmin,
  seedTestConfig,
  authorizeVolunteer,
  createTestLocation,
  createTestReport,
  clearTestData,
  getReportsForBox
};

export const PATHS = {
  AUTH_VOLUNTEERS: AUTH_VOLUNTEERS_PATH,
  CONFIG: CONFIG_PATH,
  LOCATIONS: LOCATIONS_PATH,
  REPORTS: REPORTS_PATH
};
