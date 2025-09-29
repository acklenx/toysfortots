const fetch = require('node-fetch');

exports.handler = async (event) => {
	// Only process POST requests
	if (event.httpMethod !== 'POST') {
		return { statusCode: 405, body: 'Method Not Allowed' };
	}

	console.log("--- Function Started ---");

	try {
		// --- 1. Get Secrets and Data ---
		const { GITHUB_TOKEN, POSITIONSTACK_API_KEY, GITHUB_REPO_SLUG } = process.env;
		const formData = new URLSearchParams(event.body).entries();
		const locationData = Object.fromEntries(formData);

		console.log("Form Data Received:", locationData);

		if (!GITHUB_TOKEN || !POSITIONSTACK_API_KEY || !GITHUB_REPO_SLUG) {
			console.error("CRITICAL: Missing one or more environment variables.");
			return { statusCode: 500, body: 'Server configuration error: Missing API keys.' };
		}

		const fullAddress = `${locationData.address}, ${locationData.city}, GA`;
		const githubApiUrl = `https://api.github.com/repos/${GITHUB_REPO_SLUG}/contents/locations.json`;

		// --- DIAGNOSTIC LOG ---
		console.log("Attempting to access GitHub API at:", githubApiUrl);

		// --- 2. Geocode the Address ---
		console.log("Geocoding address:", fullAddress);
		const geoResponse = await fetch(`http://api.positionstack.com/v1/forward?access_key=${POSITIONSTACK_API_KEY}&query=${encodeURIComponent(fullAddress)}&limit=1`);
		const geoData = await geoResponse.json();

		if (!geoData.data || geoData.data.length === 0) {
			console.error("Geocoding failed for address:", fullAddress, "Response:", geoData);
			throw new Error('Could not find coordinates for the address.');
		}
		const { latitude, longitude } = geoData.data[0];
		console.log("Geocoding successful. Lat:", latitude, "Lon:", longitude);

		// --- 3. Get the current locations.json from GitHub ---
		console.log("Fetching current file from GitHub...");
		const currentFileResponse = await fetch(githubApiUrl, {
			headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
		});

		if (!currentFileResponse.ok) {
			console.error("Failed to fetch file from GitHub. Status:", currentFileResponse.status, currentFileResponse.statusText);
			const errorBody = await currentFileResponse.text();
			console.error("GitHub API Response Body:", errorBody);
			throw new Error(`Failed to fetch file from GitHub. Status: ${currentFileResponse.status}`);
		}

		const currentFile = await currentFileResponse.json();
		console.log("Successfully fetched file metadata from GitHub.");

		let locations = [];
		if (currentFile.content) {
			const currentFileContent = Buffer.from(currentFile.content, 'base64').toString('utf-8');
			locations = JSON.parse(currentFileContent);
			console.log(`Current file has ${locations.length} locations.`);
		} else {
			console.log("Current file is empty or has no content. Starting fresh.");
		}

		// --- 4. Add the new location and prepare the updated file ---
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
		console.log(`New location added. Total locations now: ${locations.length}`);

		const updatedContent = Buffer.from(JSON.stringify(locations, null, 2)).toString('base64');

		// --- 5. Commit the updated file to GitHub ---
		console.log("Attempting to write updated file to GitHub...");
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
			console.error("Failed to write file to GitHub. Status:", updateResponse.status, updateResponse.statusText);
			const errorBody = await updateResponse.text();
			console.error("GitHub API Response Body:", errorBody);
			throw new Error(`GitHub API Error. Status: ${updateResponse.status}`);
		}
		console.log("Successfully wrote updated file to GitHub.");

		// --- 6. Success! ---
		return {
			statusCode: 302,
			headers: { 'Location': '/' }
		};

	} catch (error) {
		console.error("--- Function Errored ---", error);
		return {
			statusCode: 500,
			body: `An error occurred: ${error.message}. Please check the function logs.`
		};
	}
};