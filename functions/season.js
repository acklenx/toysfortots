/**
 * Seasons (drive years) for Cloud Functions. Same rules as public/js/season.js, which explains
 * them; tests/unit/season-parity.test.js checks the two agree.
 */

const SEASON_START_MONTH = 6; // July (0-based), UTC

function toDate( value )
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
		date = new Date( Number( value._seconds ?? value.seconds ) * 1000 );
	}
	else if( typeof value === 'string' || typeof value === 'number' )
	{
		date = new Date( value );
	}
	return date && !Number.isNaN( date.getTime() ) ? date : null;
}

function seasonOf( dateLike )
{
	const date = toDate( dateLike );
	if( !date )
	{
		return null;
	}
	const year = date.getUTCFullYear();
	return date.getUTCMonth() >= SEASON_START_MONTH ? year : year - 1;
}

function boxSeason( location )
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

module.exports = { SEASON_START_MONTH, toDate, seasonOf, boxSeason };
