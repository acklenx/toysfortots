const fetch = require('node-fetch');

exports.handler = async (event) => {
	// Only process POST requests
	if (event.httpMethod !== 'POST') {
		return { statusCode: 405, body: 'Method Not Allowed' };
	}

	// --- 1. Get Secrets and Data ---
	const { GITHUB_TOKEN, POSITIONSTACK_API_KEY, GITHUB_REPO_SLUG } = process.env;
	const formData = new URLSearchParams(event.body).entries();
	const locationData = Object.fromEntries(formData);

	const fullAddress = `${locationData.address}, ${locationData.city}, GA`;
	const githubApiUrl = `https://api.github.com/repos/${GITHUB_REPO_SLUG}/contents/locations.json`;

	try {
		// --- 2. Geocode the Address ---
		const geoResponse = await fetch(`http://api.positionstack.com/v1/forward?access_key=${POSITIONSTACK_API_KEY}&query=${encodeURIComponent(fullAddress)}&limit=1`);
		const geoData = await geoResponse.json();

		if (!geoData.data || geoData.data.length === 0) {
			throw new Error('Could not find coordinates for the address.');
		}
		const { latitude, longitude } = geoData.data[0];

		// --- 3. Get the current locations.json from GitHub ---
		const currentFileResponse = await fetch(githubApiUrl, {
			headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
		});
		const currentFile = await currentFileResponse.json();
		const currentFileContent = Buffer.from(currentFile.content, 'base64').toString('utf-8');
		const locations = JSON.parse(currentFileContent);

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

		const updatedContent = Buffer.from(JSON.stringify(locations, null, 2)).toString('base64');

		// --- 5. Commit the updated file to GitHub ---
		const updateResponse = await fetch(githubApiUrl, {
			method: 'PUT',
			headers: {
				'Authorization': `token ${GITHUB_TOKEN}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				message: `feat: Add new location - ${locationData.label}`,
				content: updatedContent,
				sha: currentFile.sha // Required to prove you're updating the latest version
			})
		});

		if (!updateResponse.ok) {
			const errorBody = await updateResponse.json();
			throw new Error(`GitHub API Error: ${errorBody.message}`);
		}

		// --- 6. Success! Redirect to the homepage ---
		return {
			statusCode: 302,
			headers: {
				'Location': '/',
			}
		};

	} catch (error) {
		console.error(error);
		return {
			statusCode: 500,
			body: `An error occurred: ${error.message}. Please try again.`
		};
	}
};