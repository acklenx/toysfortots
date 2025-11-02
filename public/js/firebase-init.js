import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { getFunctions, connectFunctionsEmulator } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js';

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


if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
	console.log("TESTING: Connecting to Firebase Emulators...");
	connectAuthEmulator(auth, "http://127.0.0.1:9099");
	connectFirestoreEmulator(db, "127.0.0.1", 8081);
	connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
const appId = firebaseConfig.projectId;
const publicDocumentId = '01';
const dataDocumentId = '01';
const basePath = `artifacts/${ appId }/public/${ publicDocumentId }/data/${ dataDocumentId }`;
export const locationsCollectionPath = `${ basePath }/locations`;
export const reportsCollectionPath = `${ basePath }/totsReports`;