const { Octokit } = require('@octokit/rest');

// Required Environment Variables:
// GITHUB_TOKEN (PAT with 'repo' scope)
// REPO_OWNER (e.g., 'your-github-username')
// REPO_NAME (e.g., 'toys-for-tots-repo')
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Utility to parse Netlify form submission body
const parseBody = (body) => {
	return Object.fromEntries(new URLSearchParams(body));
};

exports.handler = async (event) => {
	if (event.httpMethod !== 'POST') {
		return { statusCode: 405, body: 'Method Not Allowed' };
	}

	try {
		const formData = parseBody(event.body);

		// Use environment variables for repo context
		const owner = process.env.REPO_OWNER;
		const repo = process.env.REPO_NAME;
		const path = 'locations.json';
		const branch = 'main'; // Or 'master', depending on your default branch

		// --- 1. Get the current JSON file content and SHA from GitHub ---
		const { data: fileData } = await octokit.repos.getContent({
			owner,
			repo,
			path,
			ref: branch,
		});

		// The content is Base64 encoded, decode it
		const currentContent = Buffer.from(fileData.content, 'base64').toString('utf8');
		const currentJson = JSON.parse(currentContent);

		// --- 2. Generate new location data ---

		// Find the next available ID (simple sequential integer or UUID is better for production)
		const newIdNum = currentJson.reduce((max, loc) => Math.max(max, parseInt(loc.id) || 0), 0) + 1;
		const newId = String(newIdNum).padStart(3, '0'); // e.g., "004"

		const newLocation = {
			"label": formData.label,
			"address": formData.address,
			"city": formData.city,
			"state": formData.state || 'GA', // Default state if not provided
			"lat": parseFloat(formData.lat) || 0, // Placeholder
			"lon": parseFloat(formData.lon) || 0, // Placeholder
			"boxes": parseInt(formData.boxes) || 1,
			"volunteer": formData.volunteer,
			"id": newId
		};

		// --- 3. Update JSON and encode new content ---
		currentJson.push(newLocation);
		const newContent = JSON.stringify(currentJson, null, 2); // Pretty-print the JSON
		const newContentBase64 = Buffer.from(newContent).toString('base64');

		// --- 4. Commit the new file content to GitHub ---
		await octokit.repos.createOrUpdateFileContents({
			owner,
			repo,
			path,
			message: `[Netlify Function] Added new location: ${newLocation.label} (ID: ${newId})`,
			content: newContentBase64,
			sha: fileData.sha, // Required SHA of the old file for update
			branch,
		});

		// --- 5. Return success and trigger Netlify deploy ---
		return {
			statusCode: 302,
			headers: {
				'Location': '/success.html', // Redirect to a success page
			},
			body: 'Successfully updated locations.json and triggered build.'
		};

	} catch (error) {
		console.error('GitHub API Error:', error.message);
		return {
			statusCode: 500,
			body: `Error processing request: ${error.message}`
		};
	}
};
