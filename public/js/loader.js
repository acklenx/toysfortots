async function loadComponent(id, url) {
	try {
		const response = await fetch(url);
		if (!response.ok) return;
		const text = await response.text();
		const el = document.getElementById(id);
		if (el) el.innerHTML = text;
	} catch (err) {
		console.error(`Failed to load component ${url}:`, err);
	}
}

// Load both components at the same time
Promise.all([
	loadComponent('header-placeholder', '/_header.html'),
	loadComponent('footer-placeholder', '/_footer.html')
]);