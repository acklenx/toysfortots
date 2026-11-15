/**
 * Unit tests for functions/season.js (the site copy is tested in tests/unit/season.test.js,
 * and tests/unit/season-parity.test.js checks the two agree).
 */

const { expect } = require( 'chai' );
const { seasonOf, boxSeason } = require( '../season' );

describe( 'season (functions)', () =>
{
	it( 'stamps a box created during the drive with that year', () =>
	{
		expect( seasonOf( new Date( '2026-11-15T12:00:00Z' ) ) ).to.equal( 2026 );
	} );

	it( 'puts January to June in the previous season', () =>
	{
		expect( seasonOf( new Date( '2027-01-10T12:00:00Z' ) ) ).to.equal( 2026 );
	} );

	it( 'derives the season of existing boxes from Firestore Timestamps', () =>
	{
		const ts = { toDate: () => new Date( '2024-11-01T12:00:00Z' ) };
		expect( boxSeason( { created: ts } ) ).to.equal( 2024 );
	} );

	it( 'prefers an explicit season', () =>
	{
		expect( boxSeason( { season: 2026, created: '2025-11-04T00:00:00Z' } ) ).to.equal( 2026 );
	} );
} );
