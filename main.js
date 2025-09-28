document.addEventListener('DOMContentLoaded', () => {
	// Initialize the map, centered on Woodstock, GA
	const map = L.map('map').setView([34.05, -84.55], 10); // Adjusted initial view

	// Add the tile layer from OpenStreetMap
	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
	}).addTo(map);

	const locationList = document.getElementById('location-list');

	// --- Define custom icon ---
	const customIcon = L.icon({
		iconUrl: 'images/pin.png', // Path to your custom icon
		iconSize: [40, 40],                     // Size of the icon (width, height)
		iconAnchor: [20, 40],                   // Point of the icon which will correspond to marker's location (half of iconSize width, full height for bottom-center)
		popupAnchor: [0, -40]                   // Point from which the popup should open relative to the iconAnchor
	});


	// Fetch the location data from your JSON file
	fetch('locations.json')
		.then(response => response.json())
		.then(locations => {
			locations.forEach(location => {
				if (location.lat && location.lon) {
					// Create a marker on the map
					// --- Use the customIcon here ---
					const marker = L.marker([location.lat, location.lon], { icon: customIcon }).addTo(map);


					// Create the popup content
					let popupContent = `<b>${location.label}</b><br>${location.address}`;
					if (location.contact) {
						popupContent += `<br><small>Contact: ${location.contact}</small>`;
					}
					marker.bindPopup(popupContent);

					// Create the list item
					const listItem = document.createElement('div');
					listItem.className = 'location-item';
					listItem.innerHTML = `
                        <h4>${location.label}</h4>
                        <p>${location.address}</p>
                    `;

					// Add click event to list item to pan map and open popup
					listItem.addEventListener('click', () => {
						map.setView([location.lat, location.lon], 14); // Zoom in closer
						marker.openPopup();
					});

					locationList.appendChild(listItem);
				}
			});
		})
		.catch(error => {
			console.error('Error fetching location data:', error);
			locationList.innerHTML = '<p style="padding: 15px;">Could not load location data.</p>';
		});
});