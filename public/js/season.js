/**
 * Seasons (drive years).
 *
 * A Toys for Tots drive runs roughly October to December, and every year gets new stickers, so
 * each box (sticker / box ID) belongs to one season. The business at that address may come back
 * year after year with a new box ID.
 *
 * A box's season is its explicit `season` field when present (set when the box is provisioned),
 * otherwise it is derived from its `created` date: a season runs July 1 through June 30 and is
 * named for the year it starts in, so a box created 2025-11-04 is season 2025 and one created
 * 2026-01-05 (a late pickup) is still season 2025.
 *
 * Keep SEASON_START_MONTH in step with functions/season.js.
 */

export const SEASON_START_MONTH = 6; // July (0-based), UTC

/**
 * Convert the shapes `created` takes in this app to a Date, or null.
 * - Firestore Timestamp (has toDate())
 * - serialized Timestamp from the cache endpoint ({_seconds} or {seconds})
 * - ISO string (provisionBoxV2 writes these), epoch milliseconds, or a Date
 */
export function toDate( value )
{
	if( value === null || value === undefined || value === '' )
	{
		return null;
	}
	let date = null;
	if( value instanceof Date )
	{
		date = value;
	}
	else if( typeof value.toDate === 'function' )
	{
		date = value.toDate();
	}
	else if( typeof value === 'object' && ( '_seconds' in value || 'seconds' in value ) )
	{
		const seconds = value._seconds ?? value.seconds;
		date = new Date( Number( seconds ) * 1000 );
	}
	else if( typeof value === 'string' || typeof value === 'number' )
	{
		date = new Date( value );
	}
	return date && !Number.isNaN( date.getTime() ) ? date : null;
}

/** The season a date falls in. */
export function seasonOf( dateLike )
{
	const date = toDate( dateLike );
	if( !date )
	{
		return null;
	}
	const year = date.getUTCFullYear();
	return date.getUTCMonth() >= SEASON_START_MONTH ? year : year - 1;
}

/** The season in progress (or about to start) on the given date; defaults to now. */
export function currentSeason( now = new Date() )
{
	return seasonOf( now );
}

/** A box's season: its `season` field if valid, otherwise derived from `created`; null if unknown. */
export function boxSeason( location )
{
	if( !location )
	{
		return null;
	}
	const explicit = Number( location.season );
	if( location.season !== undefined && location.season !== null && location.season !== '' &&
		Number.isInteger( explicit ) && explicit > 2000 )
	{
		return explicit;
	}
	return seasonOf( location.created );
}

/** True when the box belongs to the given season (default: the current one). */
export function isInSeason( location, season = currentSeason() )
{
	return boxSeason( location ) === season;
}

/** Distinct seasons present in a list of boxes, newest first. */
export function seasonsIn( locations )
{
	const seasons = new Set();
	for( const location of locations || [] )
	{
		const season = boxSeason( location );
		if( season !== null )
		{
			seasons.add( season );
		}
	}
	return [ ...seasons ].sort( ( a, b ) => b - a );
}
