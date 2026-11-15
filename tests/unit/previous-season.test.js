/**
 * Unit tests for public/js/previous-season.js
 */

import { previousSeasonMatches, mergeSuggestions, normalize } from '../../public/js/previous-season.js';

const boxes = [
	{ id: 'XA1', label: 'Bass Pro Shop', address: '152 Northpoint Pkwy', city: 'Acworth', state: 'GA', contactPhone: '470-315-7500', created: { _seconds: Date.parse( '2024-11-01T12:00:00Z' ) / 1000 } },
	{ id: 'B25', label: 'Bass Pro Shop', address: '152 Northpoint Pkwy', city: 'Acworth', state: 'GA', contactName: 'Liz', created: '2025-11-05T10:00:00Z' },
	{ id: 'C25', label: "Ralph's Tavern", address: '4290 Bells Ferry Road', city: 'Kennesaw', state: 'GA', created: '2025-11-06T10:00:00Z' },
	{ id: 'N26', label: 'Bass Pro Outlet', address: '1 New Rd', city: 'Woodstock', state: 'GA', season: 2026, created: '2026-11-10T10:00:00Z' },
	{ id: 'D25', label: 'Deleted Bass Place', address: '9 Gone St', created: '2025-11-06T10:00:00Z', deleted: true }
];

describe( 'normalize', () =>
{
	test( 'lowercases and collapses whitespace', () =>
	{
		expect( normalize( '  Bass   Pro  ' ) ).toBe( 'bass pro' );
		expect( normalize( undefined ) ).toBe( '' );
	} );
} );

describe( 'previousSeasonMatches', () =>
{
	test( 'finds earlier-season boxes by label, newest season per place', () =>
	{
		const results = previousSeasonMatches( boxes, 'bass', { season: 2026 } );
		expect( results ).toHaveLength( 1 );
		expect( results[ 0 ] ).toMatchObject( {
			label: 'Bass Pro Shop', address: '152 Northpoint Pkwy', city: 'Acworth', contactName: 'Liz',
			previousBoxId: 'B25', season: 2025, note: '2025 box B25'
		} );
	} );

	test( 'skips current-season and deleted boxes', () =>
	{
		const labels = previousSeasonMatches( boxes, 'bass', { season: 2026 } ).map( r => r.label );
		expect( labels ).not.toContain( 'Bass Pro Outlet' );
		expect( labels ).not.toContain( 'Deleted Bass Place' );
	} );

	test( 'searches other fields', () =>
	{
		const results = previousSeasonMatches( boxes, 'bells ferry', { field: 'address', season: 2026 } );
		expect( results.map( r => r.label ) ).toEqual( [ "Ralph's Tavern" ] );
	} );

	test( 'needs at least two characters', () =>
	{
		expect( previousSeasonMatches( boxes, 'b', { season: 2026 } ) ).toEqual( [] );
	} );

	test( 'in an earlier season, only seasons before it count', () =>
	{
		const results = previousSeasonMatches( boxes, 'bass', { season: 2025 } );
		expect( results.map( r => r.previousBoxId ) ).toEqual( [ 'XA1' ] );
	} );
} );

describe( 'mergeSuggestions', () =>
{
	test( 'keeps spreadsheet suggestions first and drops duplicate places', () =>
	{
		const sheet = [ { label: 'Bass Pro Shop', address: '152 Northpoint Pkwy' } ];
		const previous = [
			{ label: 'bass pro shop', address: '152  Northpoint Pkwy', note: '2025 box B25' },
			{ label: 'Bass Pro Outlet', address: '1 New Rd', note: '2025 box Z' }
		];
		const merged = mergeSuggestions( sheet, previous );
		expect( merged.map( m => m.label ) ).toEqual( [ 'Bass Pro Shop', 'Bass Pro Outlet' ] );
	} );

	test( 'caps the list', () =>
	{
		const many = Array.from( { length: 12 }, ( _, i ) => ( { label: `Place ${ i }`, address: `${ i } St` } ) );
		expect( mergeSuggestions( many, [], 10 ) ).toHaveLength( 10 );
	} );
} );
