// --- 1. IMPORTS ---
// We need these to connect to Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {
	getAuth,
	signInAnonymously,
	onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {
	getFirestore,
	collection,
	getDocs,
	query,
	orderBy
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// --- 2. CONFIG & TOP-LEVEL VARS ---
const firebaseConfig = {
	apiKey: 'AIzaSyC3-oZseVLWFYFbmjAFEgQ-I6hNOgiPj9w',
	authDomain: 'toysfortots-eae4d.firebaseapp.com',
	projectId: 'toysfortots-eae4d',
	storageBucket: 'toysfortots-eae4d.firebasestorage.app',
	messagingSenderId: '505039956655',
	appId: '1:505039956655:web:c750c66b28f7facd82025a',
	measurementId: 'G-XKQYPK0GLC'
};
const appId = firebaseConfig.projectId;
let db; // This will hold our database connection

// --- 3. FIREBASE PATHS ---
// These are from your project's configuration
const publicDocumentId = '01';
const dataDocumentId = '01';
const locationsCollectionPath = `artifacts/${ appId }/public/${ publicDocumentId }/data/${ dataDocumentId }/locations`;

// --- 4. LEAFLET SETUP (from your original file) ---
document.addEventListener( 'DOMContentLoaded', () =>
{
	// Initialize the map, centered on Woodstock, GA
	const map = L.map( 'map' ).setView( [ 34.05, -84.55 ], 10 );

	// Add the tile layer from OpenStreetMap
	L.tileLayer( 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
	} ).addTo( map );

	const locationList = document.getElementById( 'location-list' );

	// --- Define custom icon (your code) ---
	const customIcon = L.icon( {
		iconUrl: 'images/pin.png',
		iconSize: [ 40, 40 ],
		iconAnchor: [ 20, 40 ],
		popupAnchor: [ 0, -40 ]
	} );

	// --- 5. NEW: FIREBASE FUNCTIONS ---

	/**
	 * Fetches locations from Firestore and populates the map and list.
	 */
	async function loadLocations()
	{
		locationList.innerHTML = '<p style="padding: 15px; text-align: center;">Loading locations...</p>';

		try
		{
			const locationsRef = collection( db, locationsCollectionPath );

			// --- THIS IS THE FIX ---
			// 1. Create a query to order by the "created" field, descending
			const q = query( locationsRef, orderBy( 'created', 'desc' ) );

			// 2. Fetch the documents using that query
			const querySnapshot = await getDocs( q );

			if( querySnapshot.empty )
			{
				locationList.innerHTML = '<p style="padding: 15px; text-align: center;">No donation locations have been set up yet.</p>';
				return;
			}

			locationList.innerHTML = ''; // Clear "Loading..."

			// 3. Loop through the results (they are already sorted!)

			querySnapshot.forEach( ( doc ) =>
			{
				const location = doc.data();
				const boxId = doc.id;

				if( location.lat && location.lon )
				{
					const marker = L.marker( [ location.lat, location.lon ], { icon: customIcon } ).addTo( map );

					// --- UPDATED POPUP CONTENT ---
					let popupContent = `<b>${ location.label }</b><br>${ location.address }`;
					if( location.contactName )
					{
						popupContent += `<br><small>Contact: ${ location.contactName }</small>`;
					}
					if( location.contactPhone )
					{
						popupContent += `<br><small>Phone: ${ location.contactPhone }</small>`;
					}
					marker.bindPopup( popupContent );
					// --- END UPDATE ---

					const listItem = document.createElement( 'div' );
					listItem.className = 'location-item';

					// --- UPDATED LIST ITEM ---
					listItem.innerHTML = `
                            <h4>${ location.label }</h4>
                            <p>${ location.address }</p>
                            ${ location.contactName ? `<p class="contact-info">Contact: ${ location.contactName }</p>` : '' }
                        `;
					// --- END UPDATE ---

					listItem.addEventListener( 'click', () =>
					{
						map.setView( [ location.lat, location.lon ], 14 );
						marker.openPopup();
					} );

					locationList.appendChild( listItem );
				}
			} );


		}
		catch( error )
		{
			console.error( 'Error fetching location data:', error );
			// This will show permission errors if they happen
			locationList.innerHTML = `<p style="padding: 15px; text-align: center; color: red;">Could not load location data: ${ error.message }</p>`;
		}
	}

	/**
	 * Initializes Firebase and signs in anonymously.
	 */
	/**
	 * Initializes Firebase and signs in anonymously.
	 */


	/**
	 * Initializes Firebase and signs in anonymously.
	 */
	function initFirebase() {
		console.log("initFirebase: Starting...");
		try {
			const app = initializeApp(firebaseConfig);
			db = getFirestore(app); // Set the global db variable
			const auth = getAuth(app);
			console.log("initFirebase: Firebase App Initialized.");

			onAuthStateChanged(auth, (user) => {
				if (user) {
					// User is signed in (should be anonymous)
					console.log("initFirebase: onAuthStateChanged - Anonymous user SIGNED IN:", user.uid);

					// --- ADDED DELAY ---
					// Wait 500ms before trying to load data to allow auth state to propagate
					setTimeout(() => {
						console.log("initFirebase: Delay complete, calling loadLocations()."); // <-- ADDED LOG
						loadLocations();
					}, 500); // 500 milliseconds = 0.5 seconds
					// --- END DELAY ---

				} else {
					// User is not signed in, attempt to sign in
					console.log("initFirebase: onAuthStateChanged - No user found, attempting signInAnonymously...");
					signInAnonymously(auth).catch((error) => {
						console.error("initFirebase: Anonymous sign-in FAILED:", error);
						locationList.innerHTML = '<p style="padding: 15px; color: red;">Error: Could not connect to database.</p>';
					});
				}
			});
		} catch (error) {
			console.error("initFirebase: Firebase Init FAILED:", error);
			locationList.innerHTML = '<p style="padding: 15px; color: red;">Error: Could not initialize app.</p>';
		}
	}

	// --- 6. START THE APP ---
	initFirebase();
} );