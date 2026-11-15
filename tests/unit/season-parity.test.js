/**
 * The site (public/js/season.js) and Cloud Functions (functions/season.js) each carry the season
 * rules; they must agree or a box would show in a different season than it was stamped with.
 */

import { createRequire } from 'module';
import * as site from '../../public/js/season.js';

const require = createRequire( import.meta.url );
const fns = require( '../../functions/season.js' );

const samples = [
	{ created: '2024-11-01T12:00:00Z' },
	{ created: { _seconds: 1730462400 } },
	{ created: { toDate: () => new Date( '2025-11-04T15:00:00Z' ) } },
	{ created: '2026-01-05T00:00:00Z' },
	{ created: '2026-06-30T23:59:59Z' },
	{ created: '2026-07-01T00:00:00Z' },
	{ season: 2026, created: '2025-11-04T00:00:00Z' },
	{ season: '2027' },
	{ season: 'abc', created: '2025-11-04T00:00:00Z' },
	{ created: 'garbage' },
	{}
];

describe( 'season rules: site and functions agree', () =>
{
	test( 'same start month', () =>
	{
		expect( fns.SEASON_START_MONTH ).toBe( site.SEASON_START_MONTH );
	} );

	test.each( samples.map( s => [ JSON.stringify( s ), s ] ) )( 'boxSeason(%s)', ( _label, sample ) =>
	{
		expect( fns.boxSeason( sample ) ).toBe( site.boxSeason( sample ) );
	} );
} );
