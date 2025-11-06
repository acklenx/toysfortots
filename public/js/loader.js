async function loadComponent(id, url) {
	try {
		const response = await fetch(url);
		if (!response.ok) return;
		const text = await response.text();
		const el = document.getElementById(id);
		if (el) {
			el.innerHTML = text;
			// Execute any script tags in the loaded HTML
			const scripts = el.querySelectorAll('script');
			scripts.forEach(oldScript => {
				const newScript = document.createElement('script');
				if (oldScript.src) {
					newScript.src = oldScript.src;
				} else {
					newScript.textContent = oldScript.textContent;
				}
				oldScript.parentNode.replaceChild(newScript, oldScript);
			});
		}
	} catch (err) {
		console.error(`Failed to load component ${url}:`, err);
	}
}

// Load both components at the same time
Promise.all([
	loadComponent('header-placeholder', '/_header.html'),
	loadComponent('footer-placeholder', '/_footer.html')
]);