const { onCall, HttpsError } = require( 'firebase-functions/v2/https' );
const { getFirestore, FieldValue } = require( 'firebase-admin/firestore' );
const { onDocumentCreated } = require( 'firebase-functions/v2/firestore' );
const { initializeApp } = require( 'firebase-admin/app' );
const admin = require( 'firebase-admin' );
const { defineString } = require( 'firebase-functions/params' );
const FormData = require( 'form-data' );
const { Client } = require( '@googlemaps/google-maps-services-js' );
const Mailgun = require( 'mailgun.js' );
const mailgun = new Mailgun( FormData );
const ADMIN_EMAIL = 'toysfortots@qlamail.com';
const MAILGUN_KEY = defineString( 'MAILGUN_KEY' );
const MAILGUN_DOMAIN = defineString( 'MAILGUN_DOMAIN' );
const GEOCODING_API_KEY = defineString( 'GEOCODING_API_KEY' );
initializeApp();
const mapsClient = new Client( {} );
exports.sendReportEmail = onDocumentCreated(
	'artifacts/toysfortots-eae4d/public/01/data/01/totsReports/{reportId}',
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
const PRIVATE_PATH_PREFIX = 'artifacts/toysfortots-eae4d/private/01/data/01';
const CONFIG_PATH = `${ PRIVATE_PATH_PREFIX }/metadata/config`;
const AUTH_VOLUNTEERS_PATH = `${ PRIVATE_PATH_PREFIX }/authorizedVolunteers`;
const PUBLIC_DATA_PREFIX = 'artifacts/toysfortots-eae4d/public/01/data/01';
const LOCATIONS_PATH = `${ PUBLIC_DATA_PREFIX }/locations`;
const REPORTS_PATH = `${ PUBLIC_DATA_PREFIX }/totsReports`;
exports.provisionBoxV2 = onCall( async( request ) =>
{
	console.log( '--- provisionBoxV2 STARTED ---' );
	if( !request.auth || !request.auth.uid )
	{
		console.warn( 'Authentication failed: No request.auth or uid.' );
		throw new HttpsError( 'unauthenticated', 'You must be signed in to perform this action.' );
	}
	const uid = request.auth.uid;
	const userEmail = request.auth.token.email;
	const userName = request.auth.token.name || userEmail;
	const signInProvider = request.auth.token.firebase.sign_in_provider;
	console.log( `User Authenticated. UID: ${ uid }, Email: ${ userEmail }, Provider: ${ signInProvider }` );
	const data = request.data;
	const db = getFirestore();
	let isAlreadyAuthorized = false;
	const authVolRef = db.doc( `${ AUTH_VOLUNTEERS_PATH }/${ uid }` );
	try
	{
		const authSnap = await authVolRef.get();
		isAlreadyAuthorized = authSnap.exists;
		console.log( `Authorization check: User is already authorized: ${ isAlreadyAuthorized }` );
	}
	catch( error )
	{
		console.error( 'Authorization check failed:', error );
		throw new HttpsError( 'internal', 'Could not check authorization.' );
	}
	if( !isAlreadyAuthorized )
	{
		console.log( 'User not authorized. Checking passcode from request data.' );
		let secretPasscode;
		try
		{
			const configDoc = await db.doc( CONFIG_PATH ).get();
			if( !configDoc.exists )
			{
				console.error( 'Config document missing at:', CONFIG_PATH );
				throw new HttpsError( 'internal', 'Server configuration is missing. Cannot verify passcode.' );
			}
			secretPasscode = configDoc.data().sharedPasscode;
			if( !data.passcode )
			{
				console.warn( 'Passcode missing in request data.' );
				throw new HttpsError( 'permission-denied', 'New volunteers must provide the correct password.' );
			}
			console.log( `Passcode Check: Submitted='${ data.passcode }', Expected='${ secretPasscode }'` );
			if( data.passcode !== secretPasscode )
			{
				console.warn( 'Incorrect passcode submitted.' );
				throw new HttpsError( 'permission-denied', 'Incorrect passcode. New volunteers must provide the correct password.' );
			}
			console.log( 'Passcode validated successfully.' );
		}
		catch( error )
		{
			if( error instanceof HttpsError )
			{
				throw error;
			}
			console.error( 'Error during passcode validation:', error );
			throw new HttpsError( 'internal', 'Could not read server configuration.' );
		}
	}
	if( !data.boxId || !data.address )
	{
		console.warn( 'Invalid argument: Missing required fields in request data.' );
		throw new HttpsError( 'invalid-argument', 'Box ID address address, are required.' );
	}
	let geocodedLat = null;
	let geocodedLon = null;
	const fullAddress = `${ data.address }, ${ data.city }, ${ data.state }`;
	console.log( `Attempting to geocode the address: ${ fullAddress }` );
	const apiKey = GEOCODING_API_KEY.value();
	if( !apiKey )
	{
		console.error( 'GEOCODING_API_KEY secret is missing or could not be accessed!' );
	}
	else
	{
		try
		{
			const geoResponse = await mapsClient.geocode( {
				params: {
					address: fullAddress,
					key: apiKey
				}
			} );
			if( geoResponse.data.status === 'OK' )
			{
				const geometry = geoResponse.data.results[ 0 ].geometry;
				geocodedLat = geometry.location.lat;
				geocodedLon = geometry.location.lng;
				console.log( `Geocoding successful: ${ geocodedLat }, ${ geocodedLon }` );
			}
			else
			{
				console.warn( `Geocoding failed: Status=${ geoResponse.data.status }, ErrorMessage=${ geoResponse.data.error_message || 'N/A' }` );
			}
		}
		catch( error )
		{
			console.error( 'Geocoding API error during request:', error.response ? JSON.stringify( error.response.data ) : error.message );
		}
	}
	const newLocation = {
		label: data.label, address: data.address, city: data.city, state: data.state,
		boxes: data.boxes, volunteer: userName, status: 'active',
		created: new Date().toISOString(), provisionedBy: uid,
		lat: geocodedLat, lon: geocodedLon,
		contactName: data.contactName, contactEmail: data.contactEmail, contactPhone: data.contactPhone
	};
	console.log( 'New location object built.' );
	try
	{
		const newLocationRef = db.doc( `${ LOCATIONS_PATH }/${ data.boxId }` );
		const docSnap = await newLocationRef.get();
		if( docSnap.exists )
		{
			console.warn( `Attempted to provision existing Box ID: ${ data.boxId }` );
			throw new HttpsError( 'already-exists', `Box ID ${ data.boxId } has already been set up.` );
		}
		const batch = db.batch();
		batch.set( newLocationRef, newLocation );
		if( !isAlreadyAuthorized )
		{
			console.log( `Authorizing new volunteer: ${ uid }` );
			batch.set( authVolRef, {
				email: userEmail, displayName: userName,
				authorizedAt: FieldValue.serverTimestamp()
			}, { merge: true } );
		}
		const initialReportRef = db.collection( REPORTS_PATH ).doc();
		batch.set( initialReportRef, {
			...newLocation, boxId: data.boxId, reportType: 'box_registered',
			description: `Box registered by ${ userName }.`,
			timestamp: newLocation.created, status: 'cleared', reporterId: uid
		} );
		await batch.commit();
		console.log( 'Batch commit successful.' );
		return {
			success: true,
			boxId: data.boxId,
			message: 'Location saved, user authorized, and initial report created.'
		};
	}
	catch( error )
	{
		if( error.code === 'already-exists' )
		{
			console.warn( 'Batch failed due to already-exists error.' );
			throw error;
		}
		console.error( 'Batch commit failed with internal error:', error );
		throw new HttpsError( 'internal', 'Failed to save location data.' );
	}
	finally
	{
		console.log( '--- provisionBoxV2 FINISHED ---' );
	}
} );
exports.isAuthorizedVolunteerV2 = onCall( async( request ) =>
{
	if( !request.auth || !request.auth.uid )
	{
		console.warn( 'isAuthorizedVolunteerV2: Authentication failed (No auth or uid).' );
		throw new HttpsError( 'unauthenticated', 'You must be signed in to perform this action.' );
	}
	console.log( `isAuthorizedVolunteerV2: Checking authorization for UID: ${ request.auth.uid }` );
	const uid = request.auth.uid;
	const db = getFirestore();
	try
	{
		const authVolRef = db.doc( `${ AUTH_VOLUNTEERS_PATH }/${ uid }` );
		const docSnap = await authVolRef.get();
		if( docSnap.exists )
		{
			console.log( 'isAuthorizedVolunteerV2: User is authorized.' );
			return { isAuthorized: true, displayName: request.auth.token.name };
		}
		else
		{
			console.log( 'isAuthorizedVolunteerV2: User is NOT authorized.' );
			return { isAuthorized: false, displayName: request.auth.token.name };
		}
	}
	catch( error )
	{
		console.error( 'isAuthorizedVolunteerV2: Error checking authorization:', error );
		throw new HttpsError( 'internal', 'Could not check authorization status.' );
	}
} );
