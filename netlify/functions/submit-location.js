const fetch = require('node-fetch');

exports.handler = async (event) => {
	if (event.httpMethod !== 'POST') {
		return { statusCode: 405, body: 'Method Not Allowed' };
	}

	const { GITHUB_TOKEN, POSITIONSTACK_API_KEY, GITHUB_REPO_SLUG } = process.env;
	const formData = new URLSearchParams(event.body).entries();
	const locationData = Object.fromEntries(formData);

	const fullAddress = `${locationData.address}, ${locationData.city}, GA`;
	const githubApiUrl = `https://api.github.com/repos/${GITHUB_REPO_SLUG}/contents/locations.json`;

	try {
		const geoResponse = await fetch(`http://api.positionstack.com/v1/forward?access_key=${POSITIONSTACK_API_KEY}&query=${encodeURIComponent(fullAddress)}&limit=1`);
		const geoData = await geoResponse.json();

		if (!geoData.data || geoData.data.length === 0) {
			throw new Error('Could not find coordinates for the address.');
		}
		const { latitude, longitude } = geoData.data[0];

		const currentFileResponse = await fetch(githubApiUrl, {
			headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
		});
		const currentFile = await currentFileResponse.json();

		let locations = [];
		// --- START FIX ---
		// Check if the file has content. If not, start with an empty array.
		if (currentFile.content) {
			const currentFileContent = Buffer.from(currentFile.content, 'base64').toString('utf-8');
			locations = JSON.parse(currentFileContent);
		}
		// --- END FIX ---

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