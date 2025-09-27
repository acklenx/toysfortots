document.addEventListener('DOMContentLoaded', () => {
	// Initialize the map, centered on Woodstock, GA
	const map = L.map('map').setView([34.10, -84.52], 11);

	// Add the tile layer from OpenStreetMap
	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
	}).addTo(map);

	const locationList = document.getElementById('location-list');

	// Fetch the location data from your JSON file
	fetch('locations.json')
		.then(response => response.json())
		.then(locations => {
			locations.forEach(location => {
				if (location.lat && location.lon) {
					// Create a marker on the map
					const marker = L.marker([location.lat, location.lon]).addTo(map);

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