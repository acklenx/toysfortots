const { onCall, onRequest, HttpsError } = require( 'firebase-functions/v2/https' );
const { getFirestore, FieldValue } = require( 'firebase-admin/firestore' );
const { getAuth } = require( 'firebase-admin/auth' );
const { onDocumentCreated } = require( 'firebase-functions/v2/firestore' );
const { onSchedule } = require( 'firebase-functions/v2/scheduler' );
const { initializeApp } = require( 'firebase-admin/app' );
const admin = require( 'firebase-admin' );
const { defineString } = require( 'firebase-functions/params' );
const FormData = require( 'form-data' );
const { Client } = require( '@googlemaps/google-maps-services-js' );
const Mailgun = require( 'mailgun.js' );
const { google } = require( 'googleapis' );
const mailgun = new Mailgun( FormData );
const ADMIN_EMAIL = 'toysfortots@qlamail.com';
const MAILGUN_KEY = defineString( 'MAILGUN_KEY' );
const MAILGUN_DOMAIN = defineString( 'MAILGUN_DOMAIN' );
const GEOCODING_API_KEY = defineString( 'GEOCODING_API_KEY' );
const SHEETS_API_KEY = defineString( 'SHEETS_API_KEY' );
initializeApp();
const mapsClient = new Client( {} );

/**
 * Rate limiting helper to prevent brute force attacks
 * @param {string} identifier - Unique identifier (e.g., "auth:userId" or "passcode:userId")
 * @param {number} limit - Maximum attempts allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Promise<{allowed: boolean, remaining: number, retryAfter?: number}>}
 */
async function checkRateLimit( identifier, limit, windowMs )
{
	// Skip rate limiting in emulator/test mode
	const IS_TEST_MODE = process.env.FUNCTIONS_EMULATOR === 'true';
	if( IS_TEST_MODE )
	{
		return { allowed: true, remaining: limit };
	}

	const db = getFirestore();
	const now = Date.now();
	const windowStart = now - windowMs;

	const rateLimitRef = db.collection( 'rateLimits' ).doc( identifier );

	try
	{
		const result = await db.runTransaction( async( transaction ) =>
		{
			const doc = await transaction.get( rateLimitRef );

			let requests = [];
			if( doc.exists )
			{
				requests = doc.data().requests || [];
			}

			// Remove old requests outside the time window
			const recentRequests = requests.filter( t => t > windowStart );

			if( recentRequests.length >= limit )
			{
				// Rate limit exceeded
				const oldestRequest = recentRequests[0];
				const retryAfterMs = oldestRequest - windowStart;
				const retryAfterSeconds = Math.ceil( retryAfterMs / 1000 );

				return {
					allowed: false,
					remaining: 0,
					retryAfter: retryAfterSeconds
				};
			}

			// Add current request timestamp
			recentRequests.push( now );

			// Update Firestore with new request list
			transaction.set( rateLimitRef, {
				requests: recentRequests,
				lastUpdated: FieldValue.serverTimestamp()
			} );

			return {
				allowed: true,
				remaining: limit - recentRequests.length
			};
		} );

		return result;
	}
	catch( error )
	{
		console.error( 'Rate limit check failed:', error );
		// On error, allow the request (fail open) but log it
		return { allowed: true, remaining: limit };
	}
}
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
const LOCATION_SUGGESTIONS_PATH = `${ PUBLIC_DATA_PREFIX }/locationSuggestions`;

// Google Sheets configuration
const SPREADSHEET_ID = '1XbU6koPSANKaLFN9bFqU11SlNs-9qUhNpkUS6bxFg8k';
const SHEET_NAME = 'WorkingCopy';
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
	const signInProvider = request.auth.token.firebase.sign_in_provider;
	console.log( `User Authenticated. UID: ${ uid }, Email: ${ userEmail }, Provider: ${ signInProvider }` );

	const data = request.data;

	// Get displayName - prefer client-provided value, fallback to Firebase Auth
	let userName = data.displayName;
	if (!userName) {
		// Fallback: Try to get from Firebase Auth
		const auth = getAuth();
		try {
			const userRecord = await auth.getUser(uid);
			userName = userRecord.displayName || userEmail;
			console.log( `Retrieved displayName from Auth: ${ userName }` );
		} catch (error) {
			console.warn( `Could not retrieve user record for displayName, using email: ${ error.message }` );
			userName = userEmail;
		}
	} else {
		console.log( `Using displayName from client: ${ userName }` );
	}
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

		// Rate limiting: 5 passcode attempts per 15 minutes to prevent brute force
		const rateLimit = await checkRateLimit( `passcode:${ uid }`, 5, 15 * 60 * 1000 );
		if( !rateLimit.allowed )
		{
			console.warn( `provisionBoxV2: Passcode rate limit exceeded for UID: ${ uid }. Retry after ${ rateLimit.retryAfter }s` );
			throw new HttpsError(
				'resource-exhausted',
				`Too many passcode attempts. Please try again in ${ Math.ceil( rateLimit.retryAfter / 60 ) } minutes.`
			);
		}

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
			// Security: Do NOT log passcode values
			console.log( 'Validating passcode...' );
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
	// Input validation - comprehensive checks
	function validateInput(field, value, rules) {
		if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
			throw new HttpsError('invalid-argument', `${field} is required`);
		}
		if (value && typeof value === 'string') {
			if (rules.maxLength && value.length > rules.maxLength) {
				throw new HttpsError('invalid-argument', `${field} must be ${rules.maxLength} characters or less`);
			}
			if (rules.minLength && value.trim().length < rules.minLength) {
				throw new HttpsError('invalid-argument', `${field} must be at least ${rules.minLength} characters`);
			}
			if (rules.pattern && !rules.pattern.test(value)) {
				throw new HttpsError('invalid-argument', `${field} format is invalid`);
			}
		}
		if (value && rules.type && typeof value !== rules.type) {
			throw new HttpsError('invalid-argument', `${field} must be a ${rules.type}`);
		}
	}

	// Email regex (RFC 5322 simplified)
	const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	// Phone regex (flexible - allows various formats)
	const phonePattern = /^[\d\s\-().+]+$/;
	// BoxId pattern (alphanumeric, hyphens, underscores)
	const boxIdPattern = /^[A-Z0-9_-]+$/i;

	// Validate required fields
	validateInput('Box ID', data.boxId, { required: true, type: 'string', maxLength: 100, pattern: boxIdPattern });
	validateInput('Label', data.label, { required: true, type: 'string', maxLength: 200, minLength: 1 });
	validateInput('Address', data.address, { required: true, type: 'string', maxLength: 500, minLength: 3 });
	validateInput('City', data.city, { required: true, type: 'string', maxLength: 100, minLength: 1 });
	validateInput('State', data.state, { required: true, type: 'string', maxLength: 50, minLength: 2 });

	// Validate optional fields
	if (data.boxes !== undefined) {
		validateInput('Boxes', data.boxes, { type: 'number' });
		if (data.boxes < 0 || data.boxes > 1000) {
			throw new HttpsError('invalid-argument', 'Boxes must be between 0 and 1000');
		}
	}
	if (data.contactName) {
		validateInput('Contact Name', data.contactName, { type: 'string', maxLength: 200 });
	}
	if (data.contactEmail) {
		validateInput('Contact Email', data.contactEmail, { type: 'string', maxLength: 320, pattern: emailPattern });
	}
	if (data.contactPhone) {
		validateInput('Contact Phone', data.contactPhone, { type: 'string', maxLength: 50, pattern: phonePattern });
	}

	// Sanitize string inputs (trim whitespace)
	data.boxId = data.boxId.trim();
	data.label = data.label.trim();
	data.address = data.address.trim();
	data.city = data.city.trim();
	data.state = data.state.trim();
	if (data.contactName) data.contactName = data.contactName.trim();
	if (data.contactEmail) data.contactEmail = data.contactEmail.trim();
	if (data.contactPhone) data.contactPhone = data.contactPhone.trim();

	console.log('Input validation passed');
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
		contactName: data.contactName, contactEmail: data.contactEmail, contactPhone: data.contactPhone,
		reportCounter: 0,
		deleted: false
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
				role: 'volunteer',
				authorizedAt: FieldValue.serverTimestamp(),
				lastLogin: FieldValue.serverTimestamp(),
				deleted: false
			}, { merge: true } );
		}
		// Create initial report with sequential ID: BOXID-00001
		const initialReportId = `${ data.boxId }-00001`;
		const initialReportRef = db.doc( `${ REPORTS_PATH }/${ initialReportId }` );
		batch.set( initialReportRef, {
			...newLocation, boxId: data.boxId, reportType: 'box_registered',
			description: `Box registered by ${ userName }.`,
			timestamp: newLocation.created, status: 'cleared', reporterId: uid,
			deleted: false
		} );
		// Update reportCounter to 1 since we just created the first report
		batch.update( newLocationRef, { reportCounter: 1 } );
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

/**
 * Reverse Geocoding Cloud Function
 * Converts GPS coordinates to a human-readable address using Google Maps Geocoding API
 * This keeps the API key secure on the server side
 */
exports.reverseGeocode = onCall( async( request ) =>
{
	const { lat, lon } = request.data;

	// Validate input
	if( !lat || !lon )
	{
		throw new HttpsError( 'invalid-argument', 'Latitude and longitude are required.' );
	}

	// Validate coordinate ranges
	if( lat < -90 || lat > 90 || lon < -180 || lon > 180 )
	{
		throw new HttpsError( 'invalid-argument', 'Invalid coordinates. Lat must be -90 to 90, Lon must be -180 to 180.' );
	}

	console.log( `reverseGeocode: Attempting to reverse geocode coordinates: ${ lat }, ${ lon }` );

	const apiKey = GEOCODING_API_KEY.value();
	if( !apiKey )
	{
		console.error( 'reverseGeocode: GEOCODING_API_KEY is missing!' );
		throw new HttpsError( 'internal', 'Geocoding service is not configured.' );
	}

	try
	{
		const geoResponse = await mapsClient.reverseGeocode( {
			params: {
				latlng: `${ lat },${ lon }`,
				key: apiKey
			}
		} );

		if( geoResponse.data.status === 'OK' && geoResponse.data.results.length > 0 )
		{
			const result = geoResponse.data.results[ 0 ];
			const addressComponents = result.address_components;

			// Extract address parts from components
			const getComponent = ( types ) =>
			{
				const component = addressComponents.find( comp =>
					types.some( type => comp.types.includes( type ) )
				);
				return component ? component.long_name : '';
			};

			const streetNumber = getComponent( [ 'street_number' ] );
			const route = getComponent( [ 'route' ] );
			const city = getComponent( [ 'locality', 'sublocality', 'postal_town' ] );
			const county = getComponent( [ 'administrative_area_level_2' ] );
			const state = getComponent( [ 'administrative_area_level_1' ] );
			const postalCode = getComponent( [ 'postal_code' ] );

			const address = `${ streetNumber } ${ route }`.trim();

			console.log( `reverseGeocode: Success - Address: ${ address }, City: ${ city }, State: ${ state }` );

			return {
				success: true,
				address: address || '',
				city: city || '',
				state: state || '',
				county: county || '',
				postalCode: postalCode || '',
				formattedAddress: result.formatted_address
			};
		}
		else
		{
			console.warn( `reverseGeocode: API returned status: ${ geoResponse.data.status }` );
			throw new HttpsError( 'not-found', 'No address found for the given coordinates.' );
		}
	}
	catch( error )
	{
		console.error( 'reverseGeocode: Error during API call:', error.response ? JSON.stringify( error.response.data ) : error.message );
		throw new HttpsError( 'internal', 'Failed to reverse geocode coordinates.' );
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

	// Rate limiting: 90 checks per minute to prevent enumeration attacks
	const rateLimit = await checkRateLimit( `authcheck:${ uid }`, 90, 60 * 1000 );
	if( !rateLimit.allowed )
	{
		console.warn( `isAuthorizedVolunteerV2: Rate limit exceeded for UID: ${ uid }` );
		throw new HttpsError(
			'resource-exhausted',
			'Too many authorization checks. Please wait a moment and try again.'
		);
	}

	const db = getFirestore();
	try
	{
		const authVolRef = db.doc( `${ AUTH_VOLUNTEERS_PATH }/${ uid }` );
		const docSnap = await authVolRef.get();
		if( docSnap.exists )
		{
			console.log( 'isAuthorizedVolunteerV2: User is authorized.' );
			const userData = docSnap.data();

			// Update lastLogin timestamp (fire-and-forget, don't wait)
			authVolRef.update( { lastLogin: FieldValue.serverTimestamp() } ).catch( error =>
			{
				console.warn( `Failed to update lastLogin for ${ uid }:`, error.message );
			} );

			return { isAuthorized: true, displayName: userData.displayName || request.auth.token.name };
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

exports.authorizeVolunteerV2 = onCall( async( request ) =>
{
	console.log( '--- authorizeVolunteerV2 STARTED ---' );
	if( !request.auth || !request.auth.uid )
	{
		console.warn( 'authorizeVolunteerV2: Authentication failed (No auth or uid).' );
		throw new HttpsError( 'unauthenticated', 'You must be signed in to authorize.' );
	}
	const uid = request.auth.uid;
	const userEmail = request.auth.token.email;
	// Prefer displayName from client (preserves case from signup cookie), fallback to token or email
	const userName = request.data.displayName || request.auth.token.name || userEmail;
	console.log( `authorizeVolunteerV2: User Authenticated. UID: ${ uid }, Email: ${ userEmail }, DisplayName: ${ userName }` );

	// Rate limiting: 5 attempts per 15 minutes to prevent brute force attacks
	const rateLimit = await checkRateLimit( `authorize:${ uid }`, 5, 15 * 60 * 1000 );
	if( !rateLimit.allowed )
	{
		console.warn( `authorizeVolunteerV2: Rate limit exceeded for UID: ${ uid }. Retry after ${ rateLimit.retryAfter }s` );
		throw new HttpsError(
			'resource-exhausted',
			`Too many authorization attempts. Please try again in ${ Math.ceil( rateLimit.retryAfter / 60 ) } minutes.`
		);
	}

	const data = request.data;
	const code = data.code;

	if( !code )
	{
		console.warn( 'authorizeVolunteerV2: No authorization code provided.' );
		throw new HttpsError( 'invalid-argument', 'Authorization code is required.' );
	}

	const db = getFirestore();

	// Check if user is already authorized
	const authVolRef = db.doc( `${ AUTH_VOLUNTEERS_PATH }/${ uid }` );
	try
	{
		const authSnap = await authVolRef.get();
		if( authSnap.exists )
		{
			console.log( 'authorizeVolunteerV2: User is already authorized.' );
			return { success: true, message: 'You are already authorized.' };
		}
	}
	catch( error )
	{
		console.error( 'authorizeVolunteerV2: Error checking existing authorization:', error );
		throw new HttpsError( 'internal', 'Error checking authorization status.' );
	}

	// Get the shared passcode from config
	const configRef = db.doc( CONFIG_PATH );
	let sharedPasscode;
	try
	{
		const configSnap = await configRef.get();
		if( !configSnap.exists )
		{
			console.error( 'authorizeVolunteerV2: Config document not found!' );
			throw new HttpsError( 'internal', 'Authorization system not configured.' );
		}
		const configData = configSnap.data();
		sharedPasscode = configData.sharedPasscode;
		if( !sharedPasscode )
		{
			console.error( 'authorizeVolunteerV2: No shared passcode in config!' );
			throw new HttpsError( 'internal', 'Authorization system not configured properly.' );
		}
		console.log( 'authorizeVolunteerV2: Shared passcode retrieved from config.' );
	}
	catch( error )
	{
		console.error( 'authorizeVolunteerV2: Error reading config:', error );
		throw new HttpsError( 'internal', 'Error accessing authorization system.' );
	}

	// Verify the code
	if( code !== sharedPasscode )
	{
		console.warn( 'authorizeVolunteerV2: Invalid authorization code provided.' );
		return { success: false, message: 'Invalid authorization code. Please check the code and try again.' };
	}

	console.log( 'authorizeVolunteerV2: Code verified successfully. Authorizing user...' );

	// Add user to authorized volunteers
	try
	{
		await authVolRef.set( {
			uid: uid,
			email: userEmail,
			displayName: userName,
			role: 'volunteer',
			authorizedAt: FieldValue.serverTimestamp(),
			deleted: false
		} );
		console.log( 'authorizeVolunteerV2: User authorized successfully.' );
		return { success: true, message: 'Authorization successful!' };
	}
	catch( error )
	{
		console.error( 'authorizeVolunteerV2: Error saving authorization:', error );
		throw new HttpsError( 'internal', 'Error saving authorization. Please try again.' );
	}
} );

/**
 * Update volunteer role (admin/root only)
 * Callable function to change a volunteer's role
 */
exports.updateVolunteerRole = onCall( async( request ) =>
{
	console.log( '--- updateVolunteerRole STARTED ---' );

	// Check authentication
	if( !request.auth || !request.auth.uid )
	{
		console.warn( 'updateVolunteerRole: Authentication failed.' );
		throw new HttpsError( 'unauthenticated', 'You must be signed in to perform this action.' );
	}

	const callerUid = request.auth.uid;
	const db = getFirestore();

	// Check if caller is admin
	try
	{
		const callerDoc = await db.doc( `${ AUTH_VOLUNTEERS_PATH }/${ callerUid }` ).get();
		if( !callerDoc.exists || !['admin', 'root'].includes( callerDoc.data().role ) )
		{
			console.warn( `updateVolunteerRole: User ${ callerUid } not authorized (not admin/root).` );
			throw new HttpsError( 'permission-denied', 'Only admins can change roles.' );
		}
		console.log( `updateVolunteerRole: Caller ${ callerUid } is ${ callerDoc.data().role }` );
	}
	catch( error )
	{
		if( error instanceof HttpsError )
		{
			throw error;
		}
		console.error( 'updateVolunteerRole: Error checking caller authorization:', error );
		throw new HttpsError( 'internal', 'Could not verify authorization.' );
	}

	const { volunteerId, newRole } = request.data;

	// Validate input
	if( !volunteerId || !newRole )
	{
		throw new HttpsError( 'invalid-argument', 'volunteerId and newRole are required.' );
	}

	if( !['volunteer', 'admin', 'root'].includes( newRole ) )
	{
		throw new HttpsError( 'invalid-argument', 'Invalid role. Must be: volunteer, admin, or root.' );
	}

	// Can't change your own role
	if( volunteerId === callerUid )
	{
		console.warn( `updateVolunteerRole: User ${ callerUid } attempted to change own role.` );
		throw new HttpsError( 'permission-denied', 'Cannot change your own role.' );
	}

	// Get target volunteer
	try
	{
		const targetDoc = await db.doc( `${ AUTH_VOLUNTEERS_PATH }/${ volunteerId }` ).get();
		if( !targetDoc.exists )
		{
			throw new HttpsError( 'not-found', 'Volunteer not found.' );
		}

		const targetData = targetDoc.data();

		// Can't change root user
		if( targetData.role === 'root' )
		{
			console.warn( `updateVolunteerRole: Attempted to modify root user ${ volunteerId }.` );
			throw new HttpsError( 'permission-denied', 'Cannot modify root user.' );
		}

		// Update role
		await db.doc( `${ AUTH_VOLUNTEERS_PATH }/${ volunteerId }` ).update( {
			role: newRole,
			modifiedAt: FieldValue.serverTimestamp(),
			modifiedBy: callerUid
		} );

		console.log( `updateVolunteerRole: Changed ${ volunteerId } role from ${ targetData.role } to ${ newRole }` );
		return {
			success: true,
			message: `Role updated to ${ newRole }.`,
			previousRole: targetData.role,
			newRole: newRole
		};
	}
	catch( error )
	{
		if( error instanceof HttpsError )
		{
			throw error;
		}
		console.error( 'updateVolunteerRole: Error updating role:', error );
		throw new HttpsError( 'internal', 'Failed to update role.' );
	}
	finally
	{
		console.log( '--- updateVolunteerRole FINISHED ---' );
	}
} );

/**
 * Core sync function - reads Google Sheets and syncs to Firestore
 * Called by both manual trigger and scheduled function
 */
async function syncLocationSuggestionsFromSheets()
{
	console.log( '--- syncLocationSuggestionsFromSheets STARTED ---' );
	const sheets = google.sheets( 'v4' );
	const db = getFirestore();

	// Get API key for Google Sheets
	const apiKey = SHEETS_API_KEY.value();
	if( !apiKey )
	{
		console.error( 'SHEETS_API_KEY is not set!' );
		throw new HttpsError( 'internal', 'Google Sheets API key not configured.' );
	}

	try
	{
		// Read spreadsheet data using API key
		const response = await sheets.spreadsheets.values.get( {
			spreadsheetId: SPREADSHEET_ID,
			range: `${ SHEET_NAME }!A2:N`, // Skip header row, read columns A through N
			key: apiKey
		} );

		const rows = response.data.values;
		if( !rows || rows.length === 0 )
		{
			console.log( 'No data found in spreadsheet.' );
			return { success: true, synced: 0, message: 'No data to sync.' };
		}

		console.log( `Found ${ rows.length } rows in spreadsheet.` );

		// Use batch writes for efficiency
		const batch = db.batch();
		let syncedCount = 0;

		rows.forEach( ( row, index ) =>
		{
			// Map spreadsheet columns to fields
			const label = ( row[ 0 ] || '' ).trim();
			const address = ( row[ 1 ] || '' ).trim();
			const city = ( row[ 2 ] || '' ).trim();
			const state = ( row[ 3 ] || 'GA' ).trim();
			const contactName = ( row[ 5 ] || '' ).trim(); // Column F: Owner/Manager Name
			const contactPhone = ( row[ 6 ] || '' ).trim(); // Column G: Phone
			const contactEmail = ( row[ 9 ] || '' ).trim(); // Column J: Email

			// Skip rows with no label or address
			if( !label || !address )
			{
				console.log( `Skipping row ${ index + 2 }: missing label or address` );
				return;
			}

			// Create normalized search fields (lowercase for case-insensitive search)
			const searchLabel = label.toLowerCase();
			const searchAddress = address.toLowerCase();
			const searchContactName = contactName ? contactName.toLowerCase() : '';
			const searchContactEmail = contactEmail ? contactEmail.toLowerCase() : '';
			// For phone: remove all non-digit characters for search
			const searchContactPhone = contactPhone ? contactPhone.replace( /\D/g, '' ) : '';

			// Generate document ID from label+address hash (for idempotency)
			const docId = Buffer.from( `${ label }|${ address }` )
				.toString( 'base64' )
				.replace( /[/+=]/g, '' )
				.substring( 0, 100 );

			const suggestionData = {
				label,
				address,
				city,
				state,
				contactName,
				contactPhone,
				contactEmail,
				searchLabel,
				searchAddress,
				searchContactName,
				searchContactPhone,
				searchContactEmail,
				syncedAt: FieldValue.serverTimestamp(),
				sourceRow: index + 2 // Row number in spreadsheet (1-indexed + header)
			};

			const docRef = db.doc( `${ LOCATION_SUGGESTIONS_PATH }/${ docId }` );
			batch.set( docRef, suggestionData, { merge: true } );
			syncedCount++;
		} );

		// Commit all writes
		await batch.commit();
		console.log( `Successfully synced ${ syncedCount } location suggestions.` );

		return {
			success: true,
			synced: syncedCount,
			message: `Synced ${ syncedCount } locations from spreadsheet.`
		};
	}
	catch( error )
	{
		console.error( 'Error syncing location suggestions:', error );
		throw new HttpsError( 'internal', `Sync failed: ${ error.message }` );
	}
	finally
	{
		console.log( '--- syncLocationSuggestionsFromSheets FINISHED ---' );
	}
}

/**
 * Manual trigger for syncing location suggestions
 * Callable by authorized volunteers
 */
exports.syncLocationSuggestions = onCall( async( request ) =>
{
	console.log( '--- syncLocationSuggestions (manual) STARTED ---' );

	// Check authentication
	if( !request.auth || !request.auth.uid )
	{
		console.warn( 'syncLocationSuggestions: Authentication failed.' );
		throw new HttpsError( 'unauthenticated', 'You must be signed in to sync locations.' );
	}

	const uid = request.auth.uid;
	const db = getFirestore();

	// Check authorization
	try
	{
		const authVolRef = db.doc( `${ AUTH_VOLUNTEERS_PATH }/${ uid }` );
		const authSnap = await authVolRef.get();

		if( !authSnap.exists )
		{
			console.warn( `syncLocationSuggestions: User ${ uid } not authorized.` );
			throw new HttpsError( 'permission-denied', 'Only authorized volunteers can sync locations.' );
		}

		console.log( `syncLocationSuggestions: User ${ uid } authorized. Starting sync...` );
	}
	catch( error )
	{
		if( error instanceof HttpsError )
		{
			throw error;
		}
		console.error( 'syncLocationSuggestions: Error checking authorization:', error );
		throw new HttpsError( 'internal', 'Error checking authorization.' );
	}

	// Perform sync
	const result = await syncLocationSuggestionsFromSheets();
	console.log( '--- syncLocationSuggestions (manual) FINISHED ---' );
	return result;
} );

/**
 * Scheduled sync of location suggestions
 * Runs every 10 minutes
 */
exports.scheduledSyncLocationSuggestions = onSchedule( {
	schedule: 'every 10 minutes',
	timeZone: 'America/New_York'
}, async( event ) =>
{
	console.log( '--- scheduledSyncLocationSuggestions STARTED ---' );
	const result = await syncLocationSuggestionsFromSheets();
	console.log( '--- scheduledSyncLocationSuggestions FINISHED ---' );
	return result;
} );

/**
 * HTTP endpoint to trigger sync via curl (REQUIRES AUTHORIZATION)
 * Usage: curl -H "Authorization: Bearer <ID_TOKEN>" https://us-central1-toysfortots-eae4d.cloudfunctions.net/triggerSyncLocationSuggestions
 * Optional 30s delay: curl -H "Authorization: Bearer <ID_TOKEN>" https://...?delay=30
 */
exports.triggerSyncLocationSuggestions = onRequest( { cors: ['https://toysfortots.mcl1311.com'] }, async( req, res ) =>
{
	console.log( '--- triggerSyncLocationSuggestions (HTTP) STARTED ---' );

	// Verify authentication
	const authHeader = req.headers.authorization;
	if( !authHeader || !authHeader.startsWith( 'Bearer ' ) )
	{
		console.warn( 'triggerSyncLocationSuggestions: Missing or invalid Authorization header' );
		return res.status( 401 ).json( {
			success: false,
			error: 'Unauthorized - Missing authentication token'
		} );
	}

	const idToken = authHeader.split( 'Bearer ' )[1];
	const db = getFirestore();

	try
	{
		// Verify the ID token
		const decodedToken = await admin.auth().verifyIdToken( idToken );
		const uid = decodedToken.uid;

		// Check if user is authorized volunteer
		const authVolRef = db.doc( `${ AUTH_VOLUNTEERS_PATH }/${ uid }` );
		const authSnap = await authVolRef.get();

		if( !authSnap.exists )
		{
			console.warn( `triggerSyncLocationSuggestions: User ${ uid } not authorized` );
			return res.status( 403 ).json( {
				success: false,
				error: 'Forbidden - Only authorized volunteers can trigger sync'
			} );
		}

		console.log( `triggerSyncLocationSuggestions: User ${ uid } authorized` );

		// Optional delay parameter (in seconds)
		const delaySeconds = parseInt( req.query.delay || '0', 10 );
		if( delaySeconds > 0 )
		{
			console.log( `Waiting ${ delaySeconds } seconds before sync...` );
			await new Promise( resolve => setTimeout( resolve, delaySeconds * 1000 ) );
		}

		const result = await syncLocationSuggestionsFromSheets();
		console.log( '--- triggerSyncLocationSuggestions (HTTP) FINISHED ---' );
		res.status( 200 ).json( result );
	}
	catch( error )
	{
		if( error.code === 'auth/argument-error' || error.code === 'auth/id-token-expired' )
		{
			console.error( 'triggerSyncLocationSuggestions: Invalid or expired token:', error );
			return res.status( 401 ).json( {
				success: false,
				error: 'Unauthorized - Invalid or expired token'
			} );
		}

		console.error( 'triggerSyncLocationSuggestions error:', error );
		res.status( 500 ).json( {
			success: false,
			error: error.message
		} );
	}
} );

/**
 * Core cache generation function - reads all locations and writes to static file
 * Called by both manual trigger and scheduled function
 */
async function generateLocationsCache()
{
	console.log( '--- generateLocationsCache STARTED ---' );
	const db = getFirestore();
	const { getStorage } = require( 'firebase-admin/storage' );
	const bucket = getStorage().bucket( 'toysfortots-eae4d.firebasestorage.app' );

	try
	{
		// Get all locations, sorted by newest first
		const locationsRef = db.collection( LOCATIONS_PATH );
		const snapshot = await locationsRef.orderBy( 'created', 'desc' ).get();

		if( snapshot.empty )
		{
			console.log( 'No locations found.' );
			return { success: true, count: 0, message: 'No locations to cache.' };
		}

		// Build locations array (filter out deleted boxes)
		const locations = [];
		snapshot.forEach( doc =>
		{
			const data = doc.data();

			// Skip soft-deleted boxes (don't include in public cache)
			if( data.deleted === true )
			{
				return;
			}

			locations.push( {
				id: doc.id,
				label: data.label,
				address: data.address,
				city: data.city,
				state: data.state,
				lat: data.lat,
				lon: data.lon,
				volunteer: data.volunteer,
				status: data.status,
				boxes: data.boxes,
				created: data.created
			} );
		} );

		// Ensure consistent sort order (newest first)
		locations.sort( ( a, b ) =>
		{
			const aTime = a.created?.toMillis ? a.created.toMillis() : 0;
			const bTime = b.created?.toMillis ? b.created.toMillis() : 0;
			return bTime - aTime; // Descending order (newest first)
		} );

		console.log( `Found ${ locations.length } locations (sorted by newest first).` );

		// Create cache object with metadata
		const cacheData = {
			locations: locations,
			generatedAt: new Date().toISOString(),
			count: locations.length,
			version: 1
		};

		// Write to Cloud Storage as static JSON
		const file = bucket.file( 'public/locations-cache.json' );
		await file.save( JSON.stringify( cacheData ), {
			metadata: {
				contentType: 'application/json',
				cacheControl: 'public, max-age=3600' // Cache for 1 hour
			},
			public: true // Make publicly accessible
		} );

		console.log( `Cache file written successfully: ${ locations.length } locations` );

		return {
			success: true,
			count: locations.length,
			message: `Cached ${ locations.length } locations.`,
			url: `https://storage.googleapis.com/${ bucket.name }/public/locations-cache.json`
		};
	}
	catch( error )
	{
		console.error( 'Error generating locations cache:', error );
		throw new HttpsError( 'internal', `Cache generation failed: ${ error.message }` );
	}
	finally
	{
		console.log( '--- generateLocationsCache FINISHED ---' );
	}
}

/**
 * HTTP endpoint to serve cached locations (CORS-enabled)
 * Usage: fetch('https://us-central1-toysfortots-eae4d.cloudfunctions.net/getLocationsCache')
 */
exports.getLocationsCache = onRequest( { cors: ['https://toysfortots.mcl1311.com', 'http://localhost:5000'] }, async( req, res ) =>
{
	console.log( '--- getLocationsCache STARTED ---' );
	const { getStorage } = require( 'firebase-admin/storage' );
	const bucket = getStorage().bucket( 'toysfortots-eae4d.firebasestorage.app' );

	try
	{
		const file = bucket.file( 'public/locations-cache.json' );
		const [ exists ] = await file.exists();

		if( !exists )
		{
			console.log( 'Cache file does not exist. Generating now...' );
			const result = await generateLocationsCache();
			const [ contents ] = await file.download();
			res.status( 200 )
				.set( 'Content-Type', 'application/json' )
				.set( 'Cache-Control', 'public, max-age=3600' )
				.send( contents );
			return;
		}

		// Stream the cached file
		const [ contents ] = await file.download();
		console.log( `Serving cached locations: ${ contents.length } bytes` );

		res.status( 200 )
			.set( 'Content-Type', 'application/json' )
			.set( 'Cache-Control', 'public, max-age=3600' )
			.send( contents );
	}
	catch( error )
	{
		console.error( 'getLocationsCache error:', error );
		res.status( 500 ).json( {
			success: false,
			error: error.message
		} );
	}
	finally
	{
		console.log( '--- getLocationsCache FINISHED ---' );
	}
} );

/**
 * Manual trigger to regenerate locations cache
 * Callable by authorized volunteers
 */
exports.refreshLocationsCache = onCall( async( request ) =>
{
	console.log( '--- refreshLocationsCache (manual) STARTED ---' );

	// Check authentication
	if( !request.auth || !request.auth.uid )
	{
		console.warn( 'refreshLocationsCache: Authentication failed.' );
		throw new HttpsError( 'unauthenticated', 'You must be signed in to refresh cache.' );
	}

	const uid = request.auth.uid;
	const db = getFirestore();

	// Check authorization
	try
	{
		const authVolRef = db.doc( `${ AUTH_VOLUNTEERS_PATH }/${ uid }` );
		const authSnap = await authVolRef.get();

		if( !authSnap.exists )
		{
			console.warn( `refreshLocationsCache: User ${ uid } not authorized.` );
			throw new HttpsError( 'permission-denied', 'Only authorized volunteers can refresh cache.' );
		}

		console.log( `refreshLocationsCache: User ${ uid } authorized. Refreshing cache...` );
	}
	catch( error )
	{
		if( error instanceof HttpsError )
		{
			throw error;
		}
		console.error( 'refreshLocationsCache: Error checking authorization:', error );
		throw new HttpsError( 'internal', 'Error checking authorization.' );
	}

	// Generate cache
	const result = await generateLocationsCache();
	console.log( '--- refreshLocationsCache (manual) FINISHED ---' );
	return result;
} );

/**
 * Scheduled cache refresh
 * Runs every 6 hours
 */
exports.scheduledRefreshLocationsCache = onSchedule( {
	schedule: 'every 6 hours',
	timeZone: 'America/New_York'
}, async( event ) =>
{
	console.log( '--- scheduledRefreshLocationsCache STARTED ---' );
	const result = await generateLocationsCache();
	console.log( '--- scheduledRefreshLocationsCache FINISHED ---' );
	return result;
} );

/**
 * HTTP endpoint to trigger cache refresh via curl (REQUIRES AUTHORIZATION)
 * Usage: curl -X POST -H "Authorization: Bearer <ID_TOKEN>" https://us-central1-toysfortots-eae4d.cloudfunctions.net/triggerRefreshLocationsCache
 */
exports.triggerRefreshLocationsCache = onRequest( { cors: ['https://toysfortots.mcl1311.com', 'http://localhost:5000'] }, async( req, res ) =>
{
	console.log( '--- triggerRefreshLocationsCache (HTTP) STARTED ---' );

	// Verify authentication
	const authHeader = req.headers.authorization;
	if( !authHeader || !authHeader.startsWith( 'Bearer ' ) )
	{
		console.warn( 'triggerRefreshLocationsCache: Missing or invalid Authorization header' );
		return res.status( 401 ).json( {
			success: false,
			error: 'Unauthorized - Missing authentication token'
		} );
	}

	const idToken = authHeader.split( 'Bearer ' )[1];
	const db = getFirestore();

	try
	{
		// Verify the ID token
		const decodedToken = await admin.auth().verifyIdToken( idToken );
		const uid = decodedToken.uid;

		// Check if user is authorized volunteer
		const authVolRef = db.doc( `${ AUTH_VOLUNTEERS_PATH }/${ uid }` );
		const authSnap = await authVolRef.get();

		if( !authSnap.exists )
		{
			console.warn( `triggerRefreshLocationsCache: User ${ uid } not authorized` );
			return res.status( 403 ).json( {
				success: false,
				error: 'Forbidden - Only authorized volunteers can trigger cache refresh'
			} );
		}

		console.log( `triggerRefreshLocationsCache: User ${ uid } authorized` );

		const result = await generateLocationsCache();
		console.log( '--- triggerRefreshLocationsCache (HTTP) FINISHED ---' );
		res.status( 200 ).json( result );
	}
	catch( error )
	{
		if( error.code === 'auth/argument-error' || error.code === 'auth/id-token-expired' )
		{
			console.error( 'triggerRefreshLocationsCache: Invalid or expired token:', error );
			return res.status( 401 ).json( {
				success: false,
				error: 'Unauthorized - Invalid or expired token'
			} );
		}

		console.error( 'triggerRefreshLocationsCache error:', error );
		res.status( 500 ).json( {
			success: false,
			error: error.message
		} );
	}
} );

// Create report with sequential ID per box
exports.createReportV2 = onCall( async( request ) =>
{
	const db = getFirestore();

	// Validate input
	if( !request.data || !request.data.boxId || !request.data.reportData )
	{
		throw new HttpsError( 'invalid-argument', 'boxId and reportData are required' );
	}

	const { boxId, reportData } = request.data;

	try
	{
		const locationRef = db.doc( `${ LOCATIONS_PATH }/${ boxId }` );

		// Use transaction to atomically increment counter and create report
		const result = await db.runTransaction( async( transaction ) =>
		{
			const locationDoc = await transaction.get( locationRef );

			if( !locationDoc.exists )
			{
				throw new HttpsError( 'not-found', `Location with boxId ${ boxId } not found` );
			}

			const locationData = locationDoc.data();

			// Get current counter (default to 0 if not set)
			const currentCounter = locationData.reportCounter || 0;
			const newCounter = currentCounter + 1;

			// Create padded sequential number (5 digits: 00001, 00002, etc.)
			const paddedNumber = String( newCounter ).padStart( 5, '0' );
			const reportId = `${ boxId }-${ paddedNumber }`;

			// Create report with custom ID
			const reportRef = db.doc( `${ REPORTS_PATH }/${ reportId }` );

			const fullReport = {
				...reportData,
				...locationData,
				boxId: boxId,
				timestamp: FieldValue.serverTimestamp(),
				status: reportData.status || 'new'
			};

			transaction.set( reportRef, fullReport );

			// Update location's report counter
			transaction.update( locationRef, {
				reportCounter: newCounter
			} );

			return { reportId, counter: newCounter };
		} );

		console.log( `Report created with ID: ${ result.reportId }, counter: ${ result.counter }` );

		return {
			success: true,
			reportId: result.reportId,
			counter: result.counter
		};
	}
	catch( error )
	{
		console.error( 'createReportV2 error:', error );

		if( error instanceof HttpsError )
		{
			throw error;
		}

		throw new HttpsError( 'internal', error.message );
	}
} );

/**
 * Generate a unique box ID for imported locations
 * Format: X + 5 random alphanumeric characters (total 6 chars)
 * Example: XA3K9F
 */
function generateImportedBoxId()
{
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let id = 'X';
	for( let i = 0; i < 5; i++ )
	{
		id += chars.charAt( Math.floor( Math.random() * chars.length ) );
	}
	return id;
}

/**
 * Geocode an address to get lat/lng
 */
async function geocodeAddress( address, city, state )
{
	const fullAddress = `${ address }, ${ city }, ${ state }`.trim();

	try
	{
		const response = await mapsClient.geocode( {
			params: {
				address: fullAddress,
				key: GEOCODING_API_KEY.value()
			}
		} );

		if( response.data.results && response.data.results.length > 0 )
		{
			const location = response.data.results[ 0 ].geometry.location;
			return {
				lat: location.lat,
				lng: location.lng,
				formattedAddress: response.data.results[ 0 ].formatted_address
			};
		}
	}
	catch( error )
	{
		console.error( `Geocoding failed for ${ fullAddress }:`, error.message );
	}

	return null;
}

/**
 * Normalize strings for comparison
 */
function normalizeString( str )
{
	return ( str || '' ).toLowerCase().trim().replace( /\s+/g, ' ' );
}

/**
 * Check if a suggestion already exists as a location
 */
function locationExistsInList( suggestion, existingLocations )
{
	const suggestionLabel = normalizeString( suggestion.label );
	const suggestionAddress = normalizeString( suggestion.address );

	return existingLocations.some( loc =>
	{
		const locLabel = normalizeString( loc.label );
		const locAddress = normalizeString( loc.address );

		// Match by label OR address
		return locLabel === suggestionLabel || locAddress === suggestionAddress;
	} );
}

/**
 * Sync location suggestions to actual locations
 * Creates boxes for all spreadsheet entries that have addresses but aren't provisioned yet
 * Callable by authorized volunteers only
 */
exports.syncSuggestionsToLocations = onCall( async( request ) =>
{
	console.log( '--- syncSuggestionsToLocations STARTED ---' );

	// Check authorization
	if( !request.auth )
	{
		throw new HttpsError( 'unauthenticated', 'Must be signed in' );
	}

	const db = getFirestore();
	const uid = request.auth.uid;

	// Verify user is authorized
	const authDoc = await db.doc( `${ AUTH_VOLUNTEERS_PATH }/${ uid }` ).get();
	if( !authDoc.exists )
	{
		throw new HttpsError( 'permission-denied', 'Not authorized' );
	}

	try
	{
		console.log( 'Fetching existing locations and suggestions...' );

		// Fetch existing locations
		const locationsSnapshot = await db.collection( LOCATIONS_PATH ).get();
		const existingLocations = [];
		locationsSnapshot.forEach( doc =>
		{
			existingLocations.push( { id: doc.id, ...doc.data() } );
		} );
		console.log( `Found ${ existingLocations.length } existing locations` );

		// Fetch location suggestions
		const suggestionsSnapshot = await db.collection( LOCATION_SUGGESTIONS_PATH ).get();
		const allSuggestions = [];
		suggestionsSnapshot.forEach( doc =>
		{
			allSuggestions.push( { id: doc.id, ...doc.data() } );
		} );
		console.log( `Found ${ allSuggestions.length } suggestions` );

		// Filter suggestions that have addresses and don't exist yet
		const suggestionsWithAddresses = allSuggestions.filter( s => s.address && s.address.trim() );
		console.log( `${ suggestionsWithAddresses.length } suggestions have addresses` );

		const missingLocations = suggestionsWithAddresses.filter( s =>
			!locationExistsInList( s, existingLocations )
		);
		console.log( `${ missingLocations.length } locations need to be added` );

		if( missingLocations.length === 0 )
		{
			return {
				success: true,
				added: 0,
				skipped: 0,
				failed: 0,
				message: 'No new locations to add - all suggestions already exist!'
			};
		}

		// Add each missing location
		let addedCount = 0;
		let skippedCount = 0;
		let failedCount = 0;
		const results = [];

		for( const suggestion of missingLocations )
		{
			const boxId = generateImportedBoxId();

			console.log( `Processing: ${ suggestion.label } (${ boxId })` );

			// Geocode the address
			const geoResult = await geocodeAddress(
				suggestion.address,
				suggestion.city || '',
				suggestion.state || 'GA'
			);

			if( !geoResult )
			{
				console.log( `  Geocoding failed for ${ suggestion.label }, skipping` );
				skippedCount++;
				results.push( {
					label: suggestion.label,
					status: 'skipped',
					reason: 'geocoding_failed'
				} );
				continue;
			}

			// Create location document
			// Use a 2024 date for imported boxes since these are historical locations
			const timestamp2024 = admin.firestore.Timestamp.fromDate( new Date( '2024-11-01T12:00:00Z' ) );

			const locationData = {
				boxId,
				label: suggestion.label || 'Unnamed Location',
				address: suggestion.address,
				city: suggestion.city || '',
				state: suggestion.state || 'GA',
				lat: geoResult.lat,
				lon: geoResult.lng, // Use 'lon' not 'lng' to match existing schema
				contactName: suggestion.contactName || '',
				contactPhone: suggestion.contactPhone || '',
				contactEmail: suggestion.contactEmail || '',
				createdAt: timestamp2024, // Set to 2024 date instead of current time
				createdBy: uid,
				volunteer: uid,
				volunteerEmail: request.auth.token.email || 'imported@system',
				importedFromSpreadsheet: true // Flag to identify imported boxes
			};

			try
			{
				await db.collection( LOCATIONS_PATH ).doc( boxId ).set( locationData );
				console.log( `  Added successfully: ${ boxId }` );
				addedCount++;
				results.push( {
					label: suggestion.label,
					boxId,
					status: 'added'
				} );

				// Small delay to avoid rate limiting on geocoding
				await new Promise( resolve => setTimeout( resolve, 200 ) );
			}
			catch( error )
			{
				console.error( `  Failed to add ${ suggestion.label }:`, error );
				failedCount++;
				results.push( {
					label: suggestion.label,
					status: 'failed',
					reason: error.message
				} );
			}
		}

		console.log( `Sync complete: ${ addedCount } added, ${ skippedCount } skipped, ${ failedCount } failed` );

		return {
			success: true,
			added: addedCount,
			skipped: skippedCount,
			failed: failedCount,
			total: missingLocations.length,
			message: `Successfully added ${ addedCount } new locations from spreadsheet`,
			results
		};
	}
	catch( error )
	{
		console.error( 'Error in syncSuggestionsToLocations:', error );
		throw new HttpsError( 'internal', `Sync failed: ${ error.message }` );
	}
	finally
	{
		console.log( '--- syncSuggestionsToLocations FINISHED ---' );
	}
} );

