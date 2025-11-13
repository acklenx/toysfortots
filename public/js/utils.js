// In /js/utils.js

/**
 * XSS Protection: Escape HTML to prevent script injection
 */
function escapeHtml(unsafe) {
	if (!unsafe) return '';
	return String(unsafe)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/**
 * Displays a formatted date.
 * Used by status/index.html
 */
export const formatDate = (timestamp) => {
	if (!timestamp) {
		return 'No date';
	}

	let date;

	// Handle Firestore Timestamp objects (has seconds and nanoseconds)
	if (timestamp.seconds !== undefined) {
		date = new Date(timestamp.seconds * 1000);
	}
	// Handle Date objects
	else if (timestamp instanceof Date) {
		date = timestamp;
	}
	// Handle ISO strings or timestamps
	else {
		date = new Date(timestamp);
	}

	// Check if date is valid
	if (isNaN(date.getTime())) {
		return 'Invalid date';
	}

	const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
	return date.toLocaleString(undefined, options);
};

/**
 * Shows a message in the main #message-container.
 * Used by setup/index.html
 */
export function showMessage(type, text) {
	const messageContainer = document.getElementById('message-container');
	if (messageContainer) {
		messageContainer.innerHTML = `<div class="message ${escapeHtml(type)}">${escapeHtml(text)}</div>`;
	}
}

/**
 * Shows a message inside the #email-auth-section.
 * Used by setup/index.html and dashboard/index.html
 */
export function showAuthMessage(type, text) {
	const emailAuthSection = document.getElementById('email-auth-section');
	if (!emailAuthSection) return;

	let msgDiv = document.getElementById('auth-msg');
	if (!msgDiv) {
		msgDiv = document.createElement('div');
		msgDiv.id = 'auth-msg';
		// Insert it before the first input/button's parent
		const authError = document.getElementById('auth-error');
		if (authError ) {
			emailAuthSection.appendChild(msgDiv);
		} else {
			alert( emailAuthSection.appendChild(msgDiv) ); // Fallback
		}
	}
	// We add 'message' for basic styling, but also 'mt-3 mb-3' which are CSS classes
	// We should add these to our style.css file
	msgDiv.innerHTML = `<div class="message ${escapeHtml(type)} auth-message-spacing">${escapeHtml(text)}</div>`;
}

/**
 * Clears the message from #email-auth-section.
 * Used by setup/index.html and dashboard/index.html
 */
export function clearAuthMessage() {
	const msgDiv = document.getElementById('auth-msg');
	if (msgDiv) {
		msgDiv.innerHTML = '';
	}
}