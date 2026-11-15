import { test, expect } from '@playwright/test';
import { authorizeVolunteer, createTestLocation } from '../fixtures/firebase-helpers.js';
import { generateBoxId, generateUsername } from '../fixtures/test-id-generator.js';
import { signIn } from '../fixtures/auth.js';
import { currentSeason } from '../../public/js/season.js';

/**
 * Seasons: each drive year gets new stickers (box IDs). The map and dashboard show the current
 * season by default; the dashboard can switch to earlier seasons.
 */

const SEASON = currentSeason();
const VOLUNTEER = 'Season Tester (TEST)';
const PASSWORD = 'SeasonTest2026!';
const username = generateUsername( 'season' );

const boxes = {
	current: { id: generateBoxId( 'SEASONNOW' ), label: `Current season box ${ SEASON }`, created: `${ SEASON }-11-04T15:00:00.000Z`, season: SEASON },
	lastYear: { id: generateBoxId( 'SEASONLAST' ), label: `Last season box ${ SEASON - 1 }`, created: `${ SEASON - 1 }-11-04T15:00:00.000Z` },
	twoYearsAgo: { id: generateBoxId( 'SEASONOLD' ), label: `Old season box ${ SEASON - 2 }`, created: { seconds: Date.parse( `${ SEASON - 2 }-11-01T12:00:00Z` ) / 1000 } }
};

test.describe.configure( { mode: 'serial' } );

test.beforeAll( async() =>
{
	// Create the volunteer's account in the Auth emulator and authorize them
	const email = `${ username }@toysfortots.mcl1311.com`;
	const response = await fetch( 'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=test-key', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify( { email, password: PASSWORD, returnSecureToken: true } )
	} );
	const account = await response.json();
	if( !account.localId )
	{
		throw new Error( `Auth emulator sign-up failed: ${ JSON.stringify( account ) }` );
	}
	await authorizeVolunteer( account.localId, email, VOLUNTEER );

	for( const box of Object.values( boxes ) )
	{
		const data = { label: box.label, volunteer: VOLUNTEER, created: box.created };
		if( box.season )
		{
			data.season = box.season;
		}
		if( box.created.seconds )
		{
			// A real Firestore Timestamp, like the boxes imported from the spreadsheet
			const { default: admin } = await import( 'firebase-admin' );
			data.created = admin.firestore.Timestamp.fromMillis( box.created.seconds * 1000 );
		}
		await createTestLocation( box.id, data );
	}
} );

test( 'home map lists only the current season', async( { page } ) =>
{
	// The home page renders from the locations cache only (on localhost: /mock-locations-cache.json).
	// Serve a cache shaped like getLocationsCache's output, with boxes from three seasons.
	const toCacheEntry = ( box, i ) => ( {
		id: box.id, label: box.label, address: `${ i + 1 } Season St`, city: 'Woodstock', state: 'GA',
		lat: 34.1 + i / 100, lon: -84.5 - i / 100,
		created: box.created.seconds ? { _seconds: box.created.seconds, _nanoseconds: 0 } : box.created,
		...( box.season ? { season: box.season } : {} )
	} );
	await page.route( '**/mock-locations-cache.json*', route => route.fulfill( {
		contentType: 'application/json',
		body: JSON.stringify( { locations: Object.values( boxes ).map( toCacheEntry ), count: 3, generatedAt: new Date().toISOString(), version: 1 } )
	} ) );

	await page.goto( '/' );
	const list = page.locator( '#location-list' );
	await expect( list ).toContainText( boxes.current.label, { timeout: 10000 } );
	await expect( list ).not.toContainText( boxes.lastYear.label );
	await expect( list ).not.toContainText( boxes.twoYearsAgo.label );
} );

test( 'dashboard defaults to the current season and can switch seasons', async( { page } ) =>
{
	await signIn( page, username, PASSWORD );
	await page.goto( '/dashboard/' );

	const title = page.locator( '#boxes-title' );
	const container = page.locator( '#boxes-container' );
	const seasonSelect = page.locator( '#season-filter' );

	await expect( title ).toContainText( `(${ SEASON })`, { timeout: 10000 } );
	await page.locator( '#view-filter' ).selectOption( 'all_boxes' );
	await expect( title ).toContainText( `All Box Statuses (${ SEASON })` );
	await expect( container ).toContainText( boxes.current.label );
	await expect( container ).not.toContainText( boxes.lastYear.label );
	await expect( container ).not.toContainText( boxes.twoYearsAgo.label );

	// The picker offers each season with boxes, newest first, then "All seasons"
	const options = await seasonSelect.locator( 'option' ).evaluateAll( opts => opts.map( o => o.value ) );
	expect( options.slice( 0, 3 ) ).toEqual( [ String( SEASON ), String( SEASON - 1 ), String( SEASON - 2 ) ] );
	expect( options[ options.length - 1 ] ).toBe( 'all' );

	await seasonSelect.selectOption( String( SEASON - 1 ) );
	await expect( title ).toContainText( `(${ SEASON - 1 })` );
	await expect( container ).toContainText( boxes.lastYear.label );
	await expect( container ).not.toContainText( boxes.current.label );

	await seasonSelect.selectOption( 'all' );
	await expect( title ).toContainText( '(all seasons)' );
	for( const box of Object.values( boxes ) )
	{
		await expect( container ).toContainText( box.label );
	}
} );

test( 'dashboard ?season= preselects a season', async( { page } ) =>
{
	await signIn( page, username, PASSWORD );
	await page.goto( `/dashboard/?season=${ SEASON - 2 }&volunteer=${ encodeURIComponent( VOLUNTEER ) }` );
	await expect( page.locator( '#boxes-title' ) ).toContainText( `${ VOLUNTEER }'s Boxes (${ SEASON - 2 })`, { timeout: 10000 } );
	await expect( page.locator( '#boxes-container' ) ).toContainText( boxes.twoYearsAgo.label );
	await expect( page.locator( '#season-filter' ) ).toHaveValue( String( SEASON - 2 ) );
} );
