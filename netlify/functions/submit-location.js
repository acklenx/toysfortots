const fetch = require('node-fetch');

exports.handler = async (event) => {
	if (event.httpMethod !== 'POST') {
		return { statusCode: 405, body: 'Method Not Allowed' };
	}

	const { GITHUB_TOKEN, GOOGLE_MAPS_API_KEY, GITHUB_REPO_SLUG } = process.env;
	const formData = new URLSearchParams(event.body).entries();
	const locationData = Object.fromEntries(formData);

	const fullAddress = `${locationData.address}, ${locationData.city}, GA`;
	const githubApiUrl = `https://api.github.com/repos/${GITHUB_REPO_SLUG}/contents/locations.json`;

	try {
		// --- 1. Geocode the Address using Google Maps API ---
		const geoResponse = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${GOOGLE_MAPS_API_KEY}`);
		const geoData = await geoResponse.json();

		if (geoData.status !== 'OK' || !geoData.results || geoData.results.length === 0) {
			console.error("Google Geocoding failed:", geoData.status, geoData.error_message);
			throw new Error(`Could not find coordinates for the address. Google API status: ${geoData.status}`);
		}
		const { lat, lng } = geoData.results[0].geometry.location;
		const latitude = lat;
		const longitude = lng;

		// --- 2. Get the current locations.json from GitHub ---
		const currentFileResponse = await fetch(githubApiUrl, {
			headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
		});
		const currentFile = await currentFileResponse.json();

		let locations = [];
		if (currentFile.content) {
			const currentFileContent = Buffer.from(currentFile.content, 'base64').toString('utf-8');
			locations = JSON.parse(currentFileContent);
		}

		// --- 3. Add the new location and prepare the updated file ---
		const newLocation = {
			label: locationData.label,
			address: locationData.address,
			city: locationData.city,
			state: "GA",
			lat: latitude,
			lon: longitude,
			boxes: parseInt(locationData.boxes, 10) || null,
			volunteer: locationData.volunteer
		};
		locations.push(newLocation);

		const updatedContent = Buffer.from(JSON.stringify(locations, null, 2)).toString('base64');

		// --- 4. Commit the updated file to GitHub ---
		const updateResponse = await fetch(githubApiUrl, {
			method: 'PUT',
			headers: {
				'Authorization': `token ${GITHUB_TOKEN}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				message: `feat: Add new location - ${locationData.label}`,
				content: updatedContent,
				sha: currentFile.sha
			})
		});

		if (!updateResponse.ok) {
			const errorBody = await updateResponse.json();
			throw new Error(`GitHub API Error: ${errorBody.message}`);
		}

		// --- 5. Success! ---
		return {
			statusCode: 302,
			headers: { 'Location': '/' }
		};

	} catch (error) {
		console.error(error);
		return {
			statusCode: 500,
			body: `An error occurred: ${error.message}. Please try again.`
		};
	}
};