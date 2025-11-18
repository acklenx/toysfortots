#!/usr/bin/env node

/**
 * Script to add missing boxes from locationSuggestions to locations collection
 *
 * This script:
 * 1. Fetches all locationSuggestions (from synced spreadsheet)
 * 2. Fetches all existing locations (provisioned boxes)
 * 3. Identifies suggestions with addresses that aren't yet provisioned
 * 4. Creates location documents for missing boxes with geocoding
 */

const admin = require('firebase-admin');
const { Client } = require('@googlemaps/google-maps-services-js');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Firestore paths (must match production paths)
const LOCATIONS_PATH = 'artifacts/toysfortots-eae4d/public/01/data/01/locations';
const SUGGESTIONS_PATH = 'artifacts/toysfortots-eae4d/public/01/data/01/locationSuggestions';

// Google Maps client for geocoding
const mapsClient = new Client({});
const GEOCODING_API_KEY = process.env.GEOCODING_API_KEY;

/**
 * Generate a unique box ID
 */
function generateBoxId(label) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  const labelSlug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .substring(0, 20);
  return `${labelSlug}-${timestamp}${random}`.toUpperCase();
}

/**
 * Geocode an address to get lat/lng
 */
async function geocodeAddress(address, city, state) {
  const fullAddress = `${address}, ${city}, ${state}`.trim();

  try {
    const response = await mapsClient.geocode({
      params: {
        address: fullAddress,
        key: GEOCODING_API_KEY,
      },
    });

    if (response.data.results && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng,
        formattedAddress: response.data.results[0].formatted_address,
      };
    }
  } catch (error) {
    console.error(`Geocoding failed for ${fullAddress}:`, error.message);
  }

  return null;
}

/**
 * Normalize strings for comparison
 */
function normalize(str) {
  return (str || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if a suggestion already exists as a location
 */
function locationExists(suggestion, existingLocations) {
  const suggestionLabel = normalize(suggestion.label);
  const suggestionAddress = normalize(suggestion.address);

  return existingLocations.some(loc => {
    const locLabel = normalize(loc.label);
    const locAddress = normalize(loc.address);

    // Match by label OR address
    return locLabel === suggestionLabel || locAddress === suggestionAddress;
  });
}

async function main() {
  console.log('🔍 Fetching current locations and suggestions...\n');

  // Fetch existing locations
  const locationsSnapshot = await db.collection(LOCATIONS_PATH).get();
  const existingLocations = [];
  locationsSnapshot.forEach(doc => {
    existingLocations.push({ id: doc.id, ...doc.data() });
  });
  console.log(`✓ Found ${existingLocations.length} existing locations (provisioned boxes)`);

  // Fetch location suggestions
  const suggestionsSnapshot = await db.collection(SUGGESTIONS_PATH).get();
  const allSuggestions = [];
  suggestionsSnapshot.forEach(doc => {
    allSuggestions.push({ id: doc.id, ...doc.data() });
  });
  console.log(`✓ Found ${allSuggestions.length} location suggestions (from spreadsheet)\n`);

  // Filter suggestions that have addresses and don't exist yet
  const suggestionsWithAddresses = allSuggestions.filter(s => s.address && s.address.trim());
  console.log(`✓ ${suggestionsWithAddresses.length} suggestions have addresses`);

  const missingLocations = suggestionsWithAddresses.filter(s => !locationExists(s, existingLocations));
  console.log(`✓ ${missingLocations.length} locations need to be added\n`);

  if (missingLocations.length === 0) {
    console.log('✅ No missing locations to add!');
    return;
  }

  // Confirm before proceeding
  console.log(`📋 About to add ${missingLocations.length} new boxes:\n`);
  missingLocations.slice(0, 5).forEach(loc => {
    console.log(`   • ${loc.label} - ${loc.address}, ${loc.city}, ${loc.state}`);
  });
  if (missingLocations.length > 5) {
    console.log(`   ... and ${missingLocations.length - 5} more\n`);
  }

  console.log('\n🚀 Starting to add locations...\n');

  // Add each missing location
  let successCount = 0;
  let failCount = 0;

  for (const suggestion of missingLocations) {
    const boxId = generateBoxId(suggestion.label);

    console.log(`Adding: ${suggestion.label} (${boxId})`);

    // Geocode the address
    const geoResult = await geocodeAddress(
      suggestion.address,
      suggestion.city || '',
      suggestion.state || 'GA'
    );

    if (!geoResult) {
      console.log(`  ⚠️  Geocoding failed, skipping`);
      failCount++;
      continue;
    }

    // Create location document
    const locationData = {
      boxId,
      label: suggestion.label || 'Unnamed Location',
      address: suggestion.address,
      city: suggestion.city || '',
      state: suggestion.state || 'GA',
      lat: geoResult.lat,
      lng: geoResult.lng,
      contactName: suggestion.contactName || '',
      contactPhone: suggestion.contactPhone || '',
      contactEmail: suggestion.contactEmail || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'system',
      volunteer: 'system',
      volunteerEmail: 'system@import',
    };

    try {
      await db.collection(LOCATIONS_PATH).doc(boxId).set(locationData);
      console.log(`  ✓ Added successfully (${geoResult.lat.toFixed(4)}, ${geoResult.lng.toFixed(4)})`);
      successCount++;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.log(`  ✗ Failed: ${error.message}`);
      failCount++;
    }
  }

  console.log(`\n✅ Complete!`);
  console.log(`   • Successfully added: ${successCount}`);
  console.log(`   • Failed: ${failCount}`);
  console.log(`   • Total locations now: ${existingLocations.length + successCount}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
