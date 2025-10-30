import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { getFunctions } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js';

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
const appId = firebaseConfig.projectId;
const publicDocumentId = '01';
const dataDocumentId = '01';
const basePath = `artifacts/${ appId }/public/${ publicDocumentId }/data/${ dataDocumentId }`;
export const locationsCollectionPath = `${ basePath }/locations`;
export const reportsCollectionPath = `${ basePath }/totsReports`;