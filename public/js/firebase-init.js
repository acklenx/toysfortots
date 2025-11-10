import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator, enableMultiTabIndexedDbPersistence } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { getFunctions, connectFunctionsEmulator } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js';

// Check if running locally FIRST (before initializing Firebase)
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const firebaseConfig = {
	apiKey: 'AIzaSyC3-oZseVLWFYFbmjAFEgQ-I6hNOgiPj9w',
	authDomain: 'toysfortots.mcl1311.com',
	projectId: 'toysfortots-eae4d',
	storageBucket: 'toysfortots-eae4d.firebasestorage.app',
	messagingSenderId: '505039956655',
	appId: '1:505039956655:web:c750c66b28f7facd82025a'
};

export const app = initializeApp( firebaseConfig );
export const auth = getAuth( app );
export const db = getFirestore( app );
export const functions = getFunctions( app, 'us-central1' );

// Connect to emulators IMMEDIATELY after getting instances (CRITICAL: must be before any auth/db operations)
if (isLocalhost) {
	// Use 127.0.0.1 instead of localhost to avoid DNS resolution issues in browser contexts
	connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
	connectFirestoreEmulator(db, '127.0.0.1', 8080);
	connectFunctionsEmulator(functions, '127.0.0.1', 5001);
	console.log('[firebase-init] Connected to emulators (auth: 127.0.0.1:9099, firestore: 127.0.0.1:8080, functions: 127.0.0.1:5001)');
} else {
	// Enable offline persistence for production only (not in emulators)
	enableMultiTabIndexedDbPersistence(db)
		.then(() => {
			console.log('Firestore offline persistence enabled');
		})
		.catch((err) => {
			if (err.code === 'failed-precondition') {
				console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
			} else if (err.code === 'unimplemented') {
				console.warn('Browser doesn\'t support offline persistence.');
			} else {
				console.error('Error enabling persistence:', err);
			}
		});
}

// Make auth available globally for tests
window.auth = auth;
const appId = firebaseConfig.projectId;
const publicDocumentId = '01';
const dataDocumentId = '01';
const basePath = `artifacts/${ appId }/public/${ publicDocumentId }/data/${ dataDocumentId }`;
const privateBasePath = `artifacts/${ appId }/private/${ publicDocumentId }/data/${ dataDocumentId }`;

export const locationsCollectionPath = `${ basePath }/locations`;
export const reportsCollectionPath = `${ basePath }/totsReports`;
export const locationSuggestionsCollectionPath = `${ basePath }/locationSuggestions`;
export const authorizedVolunteersCollectionPath = `${ privateBasePath }/authorizedVolunteers`;
export const auditLogsCollectionPath = `${ privateBasePath }/auditLogs`;

// Make paths available globally for user-display.js
window.db = db;
window.functions = functions;
window.authorizedVolunteersCollectionPath = authorizedVolunteersCollectionPath;