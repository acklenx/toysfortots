import { db, auth, locationsCollectionPath } from '../js/firebase-init.js';
import {
	signInAnonymously,
	onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {
	collection,
	getDocs,
	query,
	orderBy
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

document.addEventListener( 'DOMContentLoaded', () =>
{
	const map = L.map( 'map' ).setView( [ 34.05, -84.60 ], 11 );
	L.tileLayer( 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
	} ).addTo( map );
	const locationList = document.getElementById( 'location-list' );
	const customIcon = L.icon( {
		iconUrl: 'images/pin.png',
		iconSize: [ 40, 40 ],
		iconAnchor: [ 20, 40 ],
		popupAnchor: [ 0, -40 ]
	} );

	async function loadLocations()
	{
		locationList.innerHTML = '<p style="padding: 15px; text-align: center;">Loading locations...</p>';
		try
		{
			const locationsRef = collection( db, locationsCollectionPath );
			const q = query( locationsRef, orderBy( 'created', 'desc' ) );
			const querySnapshot = await getDocs( q );
			if( querySnapshot.empty )
			{
				locationList.innerHTML = '<p style="padding: 15px; text-align: center;">No donation locations have been set up yet.</p>';
				return;
			}
			locationList.innerHTML = '';
			querySnapshot.forEach( ( doc ) =>
			{
				const location = doc.data();
				if( location.lat && location.lon )
				{
					const marker = L.marker( [ location.lat, location.lon ], { icon: customIcon } ).addTo( map );
					let popupContent = `<b>${ location.label }</b><br>${ location.address }`;
					if( location.contactName )
					{
						popupContent += `<br><small>Contact: ${ location.contactName }</small>`;
					}
					if( location.contactPhone )
					{
						popupContent += `<br><small>Phone: ${ location.contactPhone }</small>`;
					}
					marker.bindPopup( popupContent );
					const listItem = document.createElement( 'div' );
					listItem.className = 'location-item';
					listItem.innerHTML = `
                            <h4>${ location.label }</h4>
                            <p>${ location.address }</p>
                            ${ location.contactName ? `<p class="contact-info">Contact: ${ location.contactName }</p>` : '' }
                        `;
					listItem.addEventListener( 'click', () =>
					{
						map.setView( [ location.lat, location.lon ], 14 );
						marker.openPopup();
					} );
					locationList.appendChild( listItem );
				}
			} );
		}
		catch( error )
		{
			locationList.innerHTML = `<p style="padding: 15px; text-align: center; color: red;">Could not load location data: ${ error.message }</p>`;
		}
	}

	function initFirebase()
	{
		try
		{
			onAuthStateChanged( auth, ( user ) =>
			{
				if( user )
				{
					setTimeout( () =>
					{
						loadLocations();
					}, 500 );
				}
				else
				{
					signInAnonymously( auth ).catch( () =>
					{
						locationList.innerHTML = '<p style="padding: 15px; color: red;">Error: Could not connect to database.</p>';
					} );
				}
			} );
		}
		catch( error )
		{
			locationList.innerHTML = '<p style="padding: 15px; color: red;">Error: Could not initialize app.</p>';
		}
	}

	initFirebase();
} );