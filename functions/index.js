// Import all the necessary modules
const { onCall, HttpsError } = require( 'firebase-functions/v2/https' );
const { getFirestore } = require( 'firebase-admin/firestore' );
const { onDocumentCreated } = require( 'firebase-functions/v2/firestore' );
const { initializeApp } = require( 'firebase-admin/app' );
const admin = require( 'firebase-admin' );
const { defineString } = require( 'firebase-functions/params' );
const FormData = require( 'form-data' );

// --- NEW: Import Google Maps Client ---
const { Client } = require( '@googlemaps/google-maps-services-js' );

const Mailgun = require( 'mailgun.js' );
const mailgun = new Mailgun( FormData );

// This is the email address all reports will be sent to
const ADMIN_EMAIL = 'toysfortots@qlamail.com';

const MAILGUN_KEY = defineString( 'MAILGUN_KEY' );
const MAILGUN_DOMAIN = defineString( 'MAILGUN_DOMAIN' );
// --- NEW: Define the Geocoding API Key Secret ---
const GEOCODING_API_KEY = defineString( 'GEOCODING_API_KEY' );

initializeApp();

// --- NEW: Instantiate the Maps Client ---
const mapsClient = new Client( {} );

// --- sendReportEmail (No changes) ---
exports.sendReportEmail = onDocumentCreated(
	'artifacts/toysfortots-eae4d/public/3USFkKsJe7T8ZYdW5YfE/data/EF1QWEKWPMuoLN7fC4Ri/totsReports/{reportId}',
	async( event ) =>
	{
		const mg = mailgun.client( {
			username: 'api',
			key: MAILGUN_KEY.value()
		} );
		const mailgunDomain = MAILGUN_DOMAIN.value();
		const reportData = event.data.data();

		if( !reportData )
		{
			console.log( 'No data found in the report.' );
			return;
		}

		let subject = 'New Toys for Tots Report';
		if( reportData.reportType === 'pickup_alert' || reportData.reportType === 'pickup_details' )
		{
			subject = `Toys for Tots PICKUP REQUEST: ${ reportData.label }`;
		}
		else if( reportData.reportType === 'problem_alert' || reportData.reportType === 'problem_report' )
		{
			subject = `Toys for Tots PROBLEM REPORT: ${ reportData.label }`;
		}

		const textBody = `
A new report was submitted:

Box ID: ${ reportData.boxId }
Location: ${ reportData.label }
Address: ${ reportData.address }, ${ reportData.city }
Assigned Volunteer: ${ reportData.volunteer }

--- Report Details ---
Type: ${ reportData.reportType }
Description: ${ reportData.description || 'N/A' }
Notes: ${ reportData.notes || 'N/A' }
Timestamp: ${ reportData.timestamp }
`;

		const messageData = {
			from: `Tots Box Bot <bot@${ mailgunDomain }>`,
			to: ADMIN_EMAIL,
			subject: subject,
			text: textBody
		};

		try
		{
			const response = await mg.messages.create( mailgunDomain, messageData );
			console.log( 'Email sent successfully:', response.id );
			return { success: true, messageId: response.id };
		}
		catch( error )
		{
			console.error( 'Error sending Mailgun email:', error );
			return { success: false, error: error.message };
		}
	}
);


// --- Paths for provisionBox ---
const PRIVATE_PATH_PREFIX = 'artifacts/toysfortots-eae4d/private/aCckkx6FbV1oKOhffIfD/data/V8dC2I8Lte56NJU2GyyY';
const CONFIG_PATH = `${ PRIVATE_PATH_PREFIX }/metadata/config`;
const AUTH_VOLUNTEERS_PATH = `${ PRIVATE_PATH_PREFIX }/authorizedVolunteers`;
const PUBLIC_DATA_PREFIX = 'artifacts/toysfortots-eae4d/public/3USFkKsJe7T8ZYdW5YfE/data/EF1QWEKWPMuoLN7fC4Ri'; // ---
																												// NEW
																												// ---
const LOCATIONS_PATH = `${ PUBLIC_DATA_PREFIX }/locations`;
const REPORTS_PATH = `${ PUBLIC_DATA_PREFIX }/totsReports`; // --- NEW ---

exports.provisionBox = onCall( async( request ) =>
{
	// 1. Check auth
	if( !request.auth || !request.auth.token.firebase.sign_in_provider )
	{
		throw new HttpsError( 'unauthenticated', 'You must be signed in with Google to perform this action.' );
	}

	const uid = request.auth.uid;
	const userEmail = request.auth.token.email;
	const userName = request.auth.token.name;

	const data = request.data;
	const db = getFirestore();

	// 2. Check authorization status
	let isAlreadyAuthorized = false;
	const authVolRef = db.doc( `${ AUTH_VOLUNTEERS_PATH }/${ uid }` );
	try {
		const authSnap = await authVolRef.get();
		isAlreadyAuthorized = authSnap.exists;
	} catch( error ) {
		throw new HttpsError( 'internal', 'Could not check authorization.' );
	}

	// 3. Validate Passcode if needed
	if( !isAlreadyAuthorized ) {
		let secretPasscode;
		try {
			const configDoc = await db.doc( CONFIG_PATH ).get();
			if( !configDoc.exists ) {
				throw new HttpsError( 'internal', 'Server configuration is missing. Cannot verify passcode.' );
			}
			secretPasscode = configDoc.data().sharedPasscode;
			if ( !data.passcode || data.passcode !== secretPasscode ) {
				throw new HttpsError( 'permission-denied', 'Incorrect passcode. New volunteers must provide the correct password.' );
			}
		} catch( error ) {
			if (error instanceof HttpsError) throw error; // Re-throw HttpsError
			throw new HttpsError( 'internal', 'Could not read server configuration.' );
		}
	}

	// 4. Check input data
	if( !data.boxId || !data.address || !data.city || !data.state ) {
		throw new HttpsError( 'invalid-argument', 'Box ID, address, city, and state are required.' );
	}

	// 5. Geocode address
	let geocodedLat = null;
	let geocodedLon = null;
	const fullAddress = `${ data.address }, ${ data.city }, ${ data.state }`;

	const apiKey = GEOCODING_API_KEY.value(); // <-- GET KEY VALUE

	if (!apiKey) {
		console.error("GEOCODING_API_KEY secret is missing or could not be accessed!"); // <-- ADDED LOG
		// Continue without geocoding, but log the error clearly
	} else {
		try {
			const geoResponse = await mapsClient.geocode( {
				params: {
					address: fullAddress,
					key: apiKey // Use the loaded key
				}
			} );

			// --- Log the ENTIRE response for debugging ---
			if( geoResponse.data.status === 'OK' ) {
				const geometry = geoResponse.data.results[ 0 ].geometry;
				geocodedLat = geometry.location.lat;
				geocodedLon = geometry.location.lng;
				console.log( `Geocoding successful: ${geocodedLat}, ${geocodedLon}` ); // <-- UPDATED LOG
			} else {
				console.warn( `Geocoding failed: Status=${geoResponse.data.status}, ErrorMessage=${geoResponse.data.error_message || 'N/A'}` ); // <-- UPDATED LOG
			}
		} catch( error ) {
			console.error( "Geocoding API error during request:", error.response ? JSON.stringify(error.response.data) : error.message ); // <-- UPDATED LOG
		}
	}

	// 6. Build the new location object
	const newLocation = {
		label: data.label, address: data.address, city: data.city, state: data.state,
		boxes: data.boxes, volunteer: userName, status: 'active',
		created: new Date().toISOString(), provisionedBy: uid,
		lat: geocodedLat, lon: geocodedLon, // Will be null if geocoding failed
		contactName: data.contactName, contactEmail: data.contactEmail, contactPhone: data.contactPhone
	};

	// 7. Save everything in a batch
	try {
		const newLocationRef = db.doc( `${ LOCATIONS_PATH }/${ data.boxId }` );
		const docSnap = await newLocationRef.get();

		if( docSnap.exists ) {
			console.warn(`Attempted to provision existing Box ID: ${data.boxId}`); // <-- ADDED LOG
			throw new HttpsError( 'already-exists', `Box ID ${ data.boxId } has already been set up.` );
		}

		const batch = db.batch();
		batch.set( newLocationRef, newLocation );

		if( !isAlreadyAuthorized ) {
			batch.set( authVolRef, {
				email: userEmail, displayName: userName,
				authorizedAt: admin.firestore.FieldValue.serverTimestamp()
			}, { merge: true } );
		}

		const initialReportRef = db.collection( REPORTS_PATH ).doc();
		batch.set( initialReportRef, {
			...newLocation, boxId: data.boxId, reportType: 'box_registered',
			description: `Box registered by ${ userName }.`,
			timestamp: newLocation.created, status: 'cleared', reporterId: uid
		} );

		await batch.commit();
		return { success: true, boxId: data.boxId, message: 'Location saved, user authorized, and initial report created.' };

	} catch( error ) {
		if( error.code === 'already-exists' ) {
			throw error;
		}
		throw new HttpsError( 'internal', 'Failed to save location data.' );
	}
} );


exports.isAuthorizedVolunteer = onCall( async( request ) =>
{
	// 1. Check for authentication
	if( !request.auth || !request.auth.token.firebase.sign_in_provider )
	{
		throw new HttpsError( 'unauthenticated', 'You must be signed in with Google to perform this action.' );
	}

	const uid = request.auth.uid;
	const db = getFirestore();

	// 2. Check for the user's doc in the private list
	try
	{
		const authVolRef = db.doc( `${ AUTH_VOLUNTEERS_PATH }/${ uid }` );
		const docSnap = await authVolRef.get();

		if( docSnap.exists )
		{
			return { isAuthorized: true, displayName: request.auth.token.name };
		}
		else
		{
			return { isAuthorized: false, displayName: request.auth.token.name };
		}
	}
	catch( error )
	{
		console.error( 'Error checking authorization:', error );
		throw new HttpsError( 'internal', 'Could not check authorization status.' );
	}
} );