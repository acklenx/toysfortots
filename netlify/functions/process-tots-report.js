const admin = require('firebase-admin');
const mailgun = require('mailgun.js');
const formData = require('form-data'); // Mailgun needs this for creating messages

// --- FIREBASE INITIALIZATION ---

// Retrieve and decode the Base64 Service Account JSON
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

if (!serviceAccountBase64) {
	console.error("FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is missing.");
}

// Decode Base64 string to get the JSON object
const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
const serviceAccount = JSON.parse(serviceAccountJson);

// Check if Firebase is already initialized (important for Netlify's warm starts)
if (!admin.apps.length) {
	admin.initializeApp({
		credential: admin.credential.cert(serviceAccount)
	});
}
const db = admin.firestore();

// --- MAILGUN INITIALIZATION ---
const Mailgun = mailgun.client;
const mg = new Mailgun(formData);

const mailgunClient = mg.client({
	username: 'api',
	key: process.env.MAILGUN_API_KEY,
	// Use the correct Mailgun URL for your region (default is US)
	url: 'https://api.mailgun.net'
});


exports.handler = async (event, context) => {
	// Ensure only POST requests are processed
	if (event.httpMethod !== 'POST') {
		return { statusCode: 405, body: 'Method Not Allowed' };
	}

	try {
		// Parse the URL-encoded body from the frontend fetch call
		const bodyParams = new URLSearchParams(event.body);
		const data = Object.fromEntries(bodyParams.entries());

		const { 'form-name': formName, 'box-info': boxInfo, notes, description, 'contact-name': contactName, 'contact-email': contactEmail } = data;

		if (!boxInfo) {
			return { statusCode: 400, body: JSON.stringify({ error: 'Missing box-info identifier.' }) };
		}

		const date = new Date();
		const timestamp = admin.firestore.FieldValue.serverTimestamp();
		const dateString = date.toLocaleString();

		// 1. WRITE TO FIRESTORE
		// This provides an immediate, immutable record of the event.
		const reportData = {
			boxInfo,
			timestamp,
			dateSubmitted: dateString,
			formType: formName,
			notes: notes || null,
			description: description || null,
			contact: contactName || null,
			email: contactEmail || null,
		};

		const dbCollection = 'tots-reports';
		const docRef = await db.collection(dbCollection).add(reportData);
		console.log(`Successfully wrote document to Firestore: ${docRef.id}`);

		// 2. SEND EMAIL VIA MAILGUN
		const recipientEmail = process.env.TOTS_RECIPIENT_EMAIL;
		const senderDomain = process.env.MAILGUN_DOMAIN;

		let subject = `TOTS Report: ${formName === 'pickup-details-form' ? 'Pickup Request' : 'Problem Reported'}`;

		let htmlBody = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
                <h2 style="color: #cc0000;">New ${formName === 'pickup-details-form' ? 'Pickup Request' : 'Problem Report'}</h2>
                <p><strong>Location:</strong> ${boxInfo}</p>
                <p><strong>Submitted At:</strong> ${dateString}</p>
                <hr style="margin: 15px 0;">
        `;

		if (formName === 'pickup-details-form') {
			subject += ` for ${boxInfo}`;
			htmlBody += `
                <h3>Pickup Details:</h3>
                <p><strong>Notes:</strong> ${notes || 'No specific notes provided.'}</p>
            `;
		} else {
			subject += ` URGENT Problem for ${boxInfo}`;
			htmlBody += `
                <h3>Problem Details:</h3>
                <p><strong>Description:</strong> ${description || 'N/A'}</p>
            `;
		}

		htmlBody += `
            <hr style="margin: 15px 0;">
            <h3>Contact Info (Optional):</h3>
            <p><strong>Name:</strong> ${contactName || 'None'}</p>
            <p><strong>Email:</strong> ${contactEmail || 'None'}</p>
            <p style="margin-top: 20px; font-size: 10px; color: #777;">Database Record ID: ${docRef.id}</p>
            </div>
        `;

		const messageData = {
			from: `Tots Reporter <no-reply@${senderDomain}>`,
			to: recipientEmail,
			subject: subject,
			html: htmlBody,
		};

		const mailgunResponse = await mailgunClient.messages.create(senderDomain, messageData);
		console.log("Mailgun Success:", mailgunResponse);

		// Success response
		return {
			statusCode: 200,
			body: JSON.stringify({ success: true, firestoreId: docRef.id, message: "Report successfully processed." }),
		};

	} catch (error) {
		console.error('Function Error:', error);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: 'Failed to process report.', details: error.message }),
		};
	}
};