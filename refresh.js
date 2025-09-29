const fetch = require('node-fetch');
const fs = require('fs');
require('dotenv').config(); // This line loads the .env file

// --- CONFIGURATION ---
// The script now reads the key from your .env file
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const inputFile = 'locations.json';
const outputFile = 'locations_updated.json';

// --- SCRIPT LOGIC (No changes below this line) ---
async function refreshCoordinates() {
	if (!GOOGLE_MAPS_API_KEY) {
		console.error("ERROR: GOOGLE_MAPS_API_KEY is not defined. Make sure it is set in your .env file.");
		return;
	}

	console.log(`Reading locations from ${inputFile}...`);
	const rawData = fs.readFileSync(inputFile);
	const locations = JSON.parse(rawData);

	const updatedLocations = [];

	console.log(`Found ${locations.length} locations. Starting geocoding...`);

	for (const location of locations) {
		if (!location.address || location.address.trim() === '') {
			console.log(`- Skipping "${location.label}" due to empty address.`);
			updatedLocations.push(location);
			continue;
		}

		const fullAddress = `${location.address}, ${location.city}, ${location.state}`;
		const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${GOOGLE_MAPS_API_KEY}`;

		try {
			const response = await fetch(url);
			const data = await response.json();

			if (data.status === 'OK' && data.results.length > 0) {
				const { lat, lng } = data.results[0].geometry.location;
				location.lat = lat;
				location.lon = lng;
				console.log(`- SUCCESS: Updated "${location.label}"`);
			} else {
				console.log(`- FAILED: Could not geocode "${location.label}". Status: ${data.status}`);
			}
		} catch (error) {
			console.log(`- ERROR: An error occurred for "${location.label}":`, error.message);
		}

		updatedLocations.push(location);

		await new Promise(resolve => setTimeout(resolve, 50));
	}

	fs.writeFileSync(outputFile, JSON.stringify(updatedLocations, null, 2));
	console.log(`\nProcessing complete! Updated data saved to ${outputFile}.`);
}

refreshCoordinates();