/**
 * Unit tests for public/js/season.js
 */

import { toDate, seasonOf, currentSeason, boxSeason, isInSeason, seasonsIn } from '../../public/js/season.js';

describe( 'toDate', () =>
{
	test( 'handles ISO strings written by provisionBoxV2', () =>
	{
		expect( toDate( '2025-11-04T15:51:26.761Z' ).toISOString() ).toBe( '2025-11-04T15:51:26.761Z' );
	} );

	test( 'handles Firestore Timestamps (toDate)', () =>
	{
		const ts = { toDate: () => new Date( '2024-11-01T12:00:00Z' ) };
		expect( toDate( ts ).toISOString() ).toBe( '2024-11-01T12:00:00.000Z' );
	} );

	test( 'handles serialized Timestamps from the cache endpoint', () =>
	{
		expect( toDate( { _seconds: 1730462400, _nanoseconds: 0 } ).toISOString() ).toBe( '2024-11-01T12:00:00.000Z' );
		expect( toDate( { seconds: 1730462400 } ).toISOString() ).toBe( '2024-11-01T12:00:00.000Z' );
	} );

	test( 'handles Dates and epoch milliseconds', () =>
	{
		const d = new Date( '2026-11-15T00:00:00Z' );
		expect( toDate( d ) ).toBe( d );
		expect( toDate( d.getTime() ).toISOString() ).toBe( d.toISOString() );
	} );

	test( 'returns null for missing or unparseable values', () =>
	{
		expect( toDate( null ) ).toBeNull();
		expect( toDate( undefined ) ).toBeNull();
		expect( toDate( '' ) ).toBeNull();
		expect( toDate( 'not a date' ) ).toBeNull();
		expect( toDate( {} ) ).toBeNull();
	} );
} );

describe( 'seasonOf', () =>
{
	test( 'drive months belong to their own year', () =>
	{
		expect( seasonOf( '2025-11-04T15:00:00Z' ) ).toBe( 2025 );
		expect( seasonOf( '2026-10-01T00:00:00Z' ) ).toBe( 2026 );
		expect( seasonOf( '2026-12-31T23:59:59Z' ) ).toBe( 2026 );
	} );

	test( 'January to June belongs to the previous year (late pickups)', () =>
	{
		expect( seasonOf( '2026-01-05T00:00:00Z' ) ).toBe( 2025 );
		expect( seasonOf( '2026-06-30T23:59:59Z' ) ).toBe( 2025 );
	} );

	test( 'a new season starts July 1', () =>
	{
		expect( seasonOf( '2026-07-01T00:00:00Z' ) ).toBe( 2026 );
	} );

	test( 'returns null without a date', () =>
	{
		expect( seasonOf( null ) ).toBeNull();
	} );
} );

describe( 'currentSeason', () =>
{
	test( 'uses the given date', () =>
	{
		expect( currentSeason( new Date( '2026-11-15T12:00:00Z' ) ) ).toBe( 2026 );
		expect( currentSeason( new Date( '2027-02-01T12:00:00Z' ) ) ).toBe( 2026 );
	} );

	test( 'defaults to now', () =>
	{
		expect( currentSeason() ).toBe( seasonOf( new Date() ) );
	} );
} );

describe( 'boxSeason', () =>
{
	test( 'prefers an explicit season field', () =>
	{
		expect( boxSeason( { season: 2026, created: '2025-11-04T00:00:00Z' } ) ).toBe( 2026 );
		expect( boxSeason( { season: '2026', created: '2025-11-04T00:00:00Z' } ) ).toBe( 2026 );
	} );

	test( 'falls back to created when season is missing or invalid', () =>
	{
		expect( boxSeason( { created: '2025-11-04T00:00:00Z' } ) ).toBe( 2025 );
		expect( boxSeason( { season: '', created: '2025-11-04T00:00:00Z' } ) ).toBe( 2025 );
		expect( boxSeason( { season: 'abc', created: '2025-11-04T00:00:00Z' } ) ).toBe( 2025 );
		expect( boxSeason( { season: null, created: { _seconds: 1730462400 } } ) ).toBe( 2024 );
	} );

	test( 'returns null when nothing is known', () =>
	{
		expect( boxSeason( {} ) ).toBeNull();
		expect( boxSeason( null ) ).toBeNull();
	} );
} );

describe( 'isInSeason', () =>
{
	test( 'compares against the given season', () =>
	{
		expect( isInSeason( { created: '2025-11-04T00:00:00Z' }, 2025 ) ).toBe( true );
		expect( isInSeason( { created: '2025-11-04T00:00:00Z' }, 2026 ) ).toBe( false );
	} );

	test( 'a box with no known season is never in season', () =>
	{
		expect( isInSeason( {}, 2026 ) ).toBe( false );
	} );
} );

describe( 'seasonsIn', () =>
{
	test( 'lists distinct seasons newest first, skipping unknown', () =>
	{
		const boxes = [
			{ created: '2024-11-01T12:00:00Z' },
			{ created: '2025-11-04T00:00:00Z' },
			{ season: 2026 },
			{ created: '2025-12-01T00:00:00Z' },
			{}
		];
		expect( seasonsIn( boxes ) ).toEqual( [ 2026, 2025, 2024 ] );
	} );

	test( 'handles empty input', () =>
	{
		expect( seasonsIn( [] ) ).toEqual( [] );
		expect( seasonsIn( undefined ) ).toEqual( [] );
	} );
} );
