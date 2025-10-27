// Import all the necessary modules
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const functions = require("firebase-functions/v2");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");

const { defineString } = require("firebase-functions/params");
const FormData = require("form-data");

// --- NEW: Import Google Maps Client ---
const { Client } = require("@googlemaps/google-maps-services-js"); // --- ADDED ---

const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(FormData);

// This is the email address all reports will be sent to
const ADMIN_EMAIL = "toysfortots@qlamail.com";

const MAILGUN_KEY = defineString("MAILGUN_KEY");
const MAILGUN_DOMAIN = defineString("MAILGUN_DOMAIN");
// --- NEW: Define the Geocoding API Key Secret ---
const GEOCODING_API_KEY = defineString("GEOCODING_API_KEY"); // --- ADDED ---

initializeApp();

// --- NEW: Instantiate the Maps Client ---
const mapsClient = new Client({}); // --- ADDED ---

// --- sendReportEmail (No changes) ---
exports.sendReportEmail = onDocumentCreated(
	"artifacts/toysfortots-eae4d/public/3USFkKsJe7T8ZYdW5YfE/data/EF1QWEKWPMuoLN7fC4Ri/totsReports/{reportId}",
	async (event) => {
		const mg = mailgun.client({
			username: "api",
			key: MAILGUN_KEY.value()
		});
		const mailgunDomain = MAILGUN_DOMAIN.value();
		const reportData = event.data.data();
		// ... (rest of your email logic is unchanged) ...
		if (!reportData) {
			console.log("No data found in the report.");
			return;
		}

		let subject = "New Toys for Tots Report";
		if (reportData.reportType === "pickup_alert" || reportData.reportType === "pickup_details") {
			subject = `Toys for Tots PICKUP REQUEST: ${reportData.label}`;
		} else if (reportData.reportType === "problem_alert" || reportData.reportType === "problem_report") {
			subject = `Toys for Tots PROBLEM REPORT: ${reportData.label}`;
		}

		const textBody = `
A new report was submitted:

Box ID: ${reportData.boxId}
Location: ${reportData.label}
Address: ${reportData.address}, ${reportData.city}
Assigned Volunteer: ${reportData.volunteer}

--- Report Details ---
Type: ${reportData.reportType}
Description: ${reportData.description || "N/A"}
Notes: ${reportData.notes || "N/A"}
Timestamp: ${reportData.timestamp}
`;

		const messageData = {
			from: `Tots Box Bot <bot@${mailgunDomain}>`,
			to: ADMIN_EMAIL,
			subject: subject,
			text: textBody,
		};

		try {
			const response = await mg.messages.create(mailgunDomain, messageData);
			console.log("Email sent successfully:", response.id);
			return { success: true, messageId: response.id };
		} catch (error) {
			console.error("Error sending Mailgun email:", error);
			return { success: false, error: error.message };
		}
	}
);


// --- Paths for provisionBox ---
const PRIVATE_PATH_PREFIX = "artifacts/toysfortots-eae4d/private/aCckkx6FbV1oKOhffIfD/data/V8dC2I8Lte56NJU2GyyY";
const CONFIG_PATH = `${PRIVATE_PATH_PREFIX}/metadata/config`;
const AUTH_VOLUNTEERS_PATH = `${PRIVATE_PATH_PREFIX}/authorizedVolunteers`;

const LOCATIONS_PATH = "artifacts/toysfortots-eae4d/public/3USFkKsJe7T8ZYdW5YfE/data/EF1QWEKWPMuoLN7fC4Ri/locations";

// --- provisionBox (MODIFIED) ---
exports.provisionBox = onCall(async (request) => {
	// 1. Check for authentication (Google Sign-In)
	if (!request.auth || !request.auth.token.firebase.sign_in_provider) {
		throw new HttpsError('unauthenticated', 'You must be signed in with Google to perform this action.');
	}

	const uid = request.auth.uid;
	const userEmail = request.auth.token.email;
	const userName = request.auth.token.name;

	const data = request.data;
	const db = getFirestore();

	// 2. Get the real passcode from the database
	let secretPasscode;
	try {
		const configDoc = await db.doc(CONFIG_PATH).get();
		if (!configDoc.exists) {
			throw new HttpsError('internal', 'Server configuration is missing. Cannot verify passcode.');
		}
		secretPasscode = configDoc.data().sharedPasscode;
	} catch (error) {
		console.error("Error reading secret passcode:", error);
		throw new HttpsError('internal', 'Could not read server configuration.');
	}

	// 3. Validate the passcode
	if (!data.passcode || data.passcode !== secretPasscode) {
		throw new HttpsError('permission-denied', 'Incorrect passcode.');
	}

	// --- Passcode is CORRECT ---

	// 4. Check that the Box ID is valid
	if (!data.boxId || !data.address || !data.city || !data.state) { // --- MODIFIED ---
		throw new HttpsError('invalid-argument', 'Box ID, address, city, and state are required.');
	}

	// --- NEW: Step 5 - Geocode the address ---
	let geocodedLat = null; // --- ADDED ---
	let geocodedLon = null; // --- ADDED ---

	const fullAddress = `${data.address}, ${data.city}, ${data.state}`; // --- ADDED ---

	try {
		const geoResponse = await mapsClient.geocode({ // --- ADDED ---
			params: {
				address: fullAddress,
				key: GEOCODING_API_KEY.value() // Use the key from secrets
			}
		});

		if (geoResponse.data.status === 'OK') {
			const geometry = geoResponse.data.results[0].geometry;
			geocodedLat = geometry.location.lat;
			geocodedLon = geometry.location.lng; // API gives 'lng', we save as 'lon'
		} else {
			// Don't fail the whole function, just log the error
			console.warn(`Geocoding failed for ${fullAddress}: ${geoResponse.data.status}`);
		}
	} catch (error) {
		console.error("Geocoding API error:", error);
		// Don't fail the function, just log it and continue
	}
	// --- END NEW STEP ---


	// 5. Build the *clean* location object (NO passcode)
	const newLocation = {
		label: data.label,
		address: data.address,
		city: data.city,
		state: data.state,
		boxes: data.boxes,
		volunteer: data.volunteer,
		status: 'active',
		created: new Date().toISOString(),
		provisionedBy: uid,
		lat: geocodedLat, // --- ADDED ---
		lon: geocodedLon  // --- ADDED --- (matches your main.js)
	};

	// 6. Check if the box already exists and save
	try {
		const newLocationRef = db.doc(`${LOCATIONS_PATH}/${data.boxId}`);
		const docSnap = await newLocationRef.get();

		if (docSnap.exists) {
			throw new HttpsError('already-exists', `Box ID ${data.boxId} has already been set up.`);
		}

		const batch = db.batch();
		batch.set(newLocationRef, newLocation);

		const authVolRef = db.doc(`${AUTH_VOLUNTEERS_PATH}/${uid}`);
		batch.set(authVolRef, {
			email: userEmail,
			displayName: userName,
			authorizedAt: new Date().toISOString()
		}, { merge: true });

		await batch.commit();

		return { success: true, boxId: data.boxId, message: 'Location saved and user authorized.' };

	} catch (error) {
		if (error.code === 'already-exists') {
			throw error;
		}
		console.error("Error writing to Firestore:", error);
		throw new HttpsError('internal', 'Failed to save location data.');
	}
});