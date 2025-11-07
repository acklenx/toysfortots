// In /js/utils.js

/**
 * Displays a formatted date.
 * Used by status/index.html
 */
export const formatDate = (isoString) => {
	if (!isoString) {
		return 'No date';
	}
	const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
	return new Date(isoString).toLocaleString(undefined, options);
};

/**
 * Shows a message in the main #message-container.
 * Used by setup/index.html
 */
export function showMessage(type, text) {
	const messageContainer = document.getElementById('message-container');
	if (messageContainer) {
		messageContainer.innerHTML = `<div class="message ${type}">${text}</div>`;
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
	msgDiv.innerHTML = `<div class="message ${type} auth-message-spacing">${text}</div>`;
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