/**
 * Re-using last season's locations when setting up this season's boxes.
 *
 * Each drive gets new stickers, but most businesses come back. The setup form's autocomplete
 * searches the spreadsheet suggestions; these helpers add matching boxes from earlier seasons in
 * the app, so a returning business can be filled in even if it is not in the spreadsheet.
 */

import { boxSeason, currentSeason } from './season.js';

export function normalize( text )
{
	return String( text || '' ).toLowerCase().replace( /\s+/g, ' ' ).trim();
}

const placeKey = ( item ) => `${ normalize( item.label ) }|${ normalize( item.address ) }`;

/**
 * Boxes from seasons before `season` whose `field` contains `query`, one per place (label and
 * address), newest season first, shaped like a spreadsheet suggestion for autoFillFormFields.
 */
export function previousSeasonMatches( locations, query, { field = 'label', season = currentSeason(), maxResults = 10 } = {} )
{
	const needle = normalize( query );
	if( needle.length < 2 )
	{
		return [];
	}
	const byPlace = new Map();
	for( const location of locations || [] )
	{
		if( !location || location.deleted === true )
		{
			continue;
		}
		const locationSeason = boxSeason( location );
		if( locationSeason === null || locationSeason >= season )
		{
			continue;
		}
		const haystack = normalize( location[ field ] );
		if( !haystack.includes( needle ) )
		{
			continue;
		}
		const key = placeKey( location );
		const existing = byPlace.get( key );
		if( !existing || existing.season < locationSeason )
		{
			byPlace.set( key, {
				label: location.label || '',
				address: location.address || '',
				city: location.city || '',
				state: location.state || '',
				contactName: location.contactName || '',
				contactEmail: location.contactEmail || '',
				contactPhone: location.contactPhone || '',
				id: `previous-${ location.id || location.boxId || key }`,
				previousBoxId: location.id || location.boxId || '',
				season: locationSeason,
				note: `${ locationSeason } box${ location.id ? ` ${ location.id }` : '' }`,
				matchIndex: haystack.indexOf( needle )
			} );
		}
	}
	return [ ...byPlace.values() ]
		.sort( ( a, b ) => a.matchIndex - b.matchIndex || b.season - a.season || normalize( a[ field ] ).localeCompare( normalize( b[ field ] ) ) )
		.slice( 0, maxResults )
		.map( ( { matchIndex, ...rest } ) => rest );
}

/** Spreadsheet suggestions first, then earlier-season boxes for places not already listed. */
export function mergeSuggestions( suggestions, previous, maxResults = 10 )
{
	const seen = new Set( ( suggestions || [] ).map( placeKey ) );
	const merged = [ ...( suggestions || [] ) ];
	for( const item of previous || [] )
	{
		const key = placeKey( item );
		if( !seen.has( key ) )
		{
			seen.add( key );
			merged.push( item );
		}
	}
	return merged.slice( 0, maxResults );
}
