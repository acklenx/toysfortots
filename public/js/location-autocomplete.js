/**
 * Location Autocomplete Helper
 * Provides functions to search location suggestions and auto-fill form fields
 */

import { db, locationSuggestionsCollectionPath } from './firebase-init.js';
import {
	collection,
	query,
	where,
	getDocs,
	orderBy,
	limit
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

/**
 * Escapes HTML special characters to prevent XSS attacks
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
 * Normalizes a string for search (lowercase, trim)
 */
function normalizeForSearch(str) {
	return (str || '').toLowerCase().trim();
}

/**
 * Searches for location suggestions by address
 * @param {string} address - Address to search for
 * @param {number} maxResults - Maximum number of results to return
 * @returns {Promise<Array>} - Array of matching location suggestions
 */
export async function searchByAddress(address, maxResults = 10) {
	if (!address || address.length < 3) {
		return [];
	}

	const normalized = normalizeForSearch(address);
	const suggestionsRef = collection(db, locationSuggestionsCollectionPath);

	try {
		// Search for addresses that start with the search term
		const q = query(
			suggestionsRef,
			where('searchAddress', '>=', normalized),
			where('searchAddress', '<=', normalized + '\uf8ff'),
			orderBy('searchAddress'),
			limit(maxResults)
		);

		const snapshot = await getDocs(q);
		const results = [];

		snapshot.forEach(doc => {
			results.push({
				id: doc.id,
				...doc.data()
			});
		});

		return results;
	} catch (error) {
		console.error('Error searching by address:', error);
		return [];
	}
}

/**
 * Searches for location suggestions by label/name
 * @param {string} label - Label to search for
 * @param {number} maxResults - Maximum number of results to return
 * @returns {Promise<Array>} - Array of matching location suggestions
 */
export async function searchByLabel(label, maxResults = 10) {
	if (!label || label.length < 2) {
		return [];
	}

	const normalized = normalizeForSearch(label);
	const suggestionsRef = collection(db, locationSuggestionsCollectionPath);

	try {
		// Search for labels that start with the search term
		const q = query(
			suggestionsRef,
			where('searchLabel', '>=', normalized),
			where('searchLabel', '<=', normalized + '\uf8ff'),
			orderBy('searchLabel'),
			limit(maxResults)
		);

		const snapshot = await getDocs(q);
		const results = [];

		snapshot.forEach(doc => {
			results.push({
				id: doc.id,
				...doc.data()
			});
		});

		return results;
	} catch (error) {
		console.error('Error searching by label:', error);
		return [];
	}
}

/**
 * Searches for location suggestions by contact name
 * @param {string} name - Contact name to search for
 * @param {number} maxResults - Maximum number of results to return
 * @returns {Promise<Array>} - Array of matching location suggestions
 */
export async function searchByContactName(name, maxResults = 10) {
	if (!name || name.length < 2) {
		return [];
	}

	const normalized = normalizeForSearch(name);
	const suggestionsRef = collection(db, locationSuggestionsCollectionPath);

	try {
		// Search for contact names that contain the search term
		const q = query(
			suggestionsRef,
			where('searchContactName', '>=', normalized),
			where('searchContactName', '<=', normalized + '\uf8ff'),
			orderBy('searchContactName'),
			limit(maxResults)
		);

		const snapshot = await getDocs(q);
		const results = [];

		snapshot.forEach(doc => {
			const data = doc.data();
			// Only include if contactName exists
			if (data.contactName) {
				results.push({
					id: doc.id,
					...data
				});
			}
		});

		return results;
	} catch (error) {
		console.error('Error searching by contact name:', error);
		return [];
	}
}

/**
 * Searches for location suggestions by contact phone
 * @param {string} phone - Phone number to search for
 * @param {number} maxResults - Maximum number of results to return
 * @returns {Promise<Array>} - Array of matching location suggestions
 */
export async function searchByContactPhone(phone, maxResults = 10) {
	if (!phone || phone.length < 3) {
		return [];
	}

	// Normalize phone: remove all non-digit characters
	const digitsOnly = phone.replace(/\D/g, '');
	const suggestionsRef = collection(db, locationSuggestionsCollectionPath);

	try {
		// Search for phones that start with the digits
		const q = query(
			suggestionsRef,
			where('searchContactPhone', '>=', digitsOnly),
			where('searchContactPhone', '<=', digitsOnly + '\uf8ff'),
			orderBy('searchContactPhone'),
			limit(maxResults)
		);

		const snapshot = await getDocs(q);
		const results = [];

		snapshot.forEach(doc => {
			const data = doc.data();
			// Only include if contactPhone exists
			if (data.contactPhone) {
				results.push({
					id: doc.id,
					...data
				});
			}
		});

		return results;
	} catch (error) {
		console.error('Error searching by contact phone:', error);
		return [];
	}
}

/**
 * Searches for location suggestions by contact email
 * @param {string} email - Email to search for
 * @param {number} maxResults - Maximum number of results to return
 * @returns {Promise<Array>} - Array of matching location suggestions
 */
export async function searchByContactEmail(email, maxResults = 10) {
	if (!email || email.length < 3) {
		return [];
	}

	const normalized = normalizeForSearch(email);
	const suggestionsRef = collection(db, locationSuggestionsCollectionPath);

	try {
		// Search for emails that start with the search term
		const q = query(
			suggestionsRef,
			where('searchContactEmail', '>=', normalized),
			where('searchContactEmail', '<=', normalized + '\uf8ff'),
			orderBy('searchContactEmail'),
			limit(maxResults)
		);

		const snapshot = await getDocs(q);
		const results = [];

		snapshot.forEach(doc => {
			const data = doc.data();
			// Only include if contactEmail exists
			if (data.contactEmail) {
				results.push({
					id: doc.id,
					...data
				});
			}
		});

		return results;
	} catch (error) {
		console.error('Error searching by contact email:', error);
		return [];
	}
}

/**
 * Finds an exact match by address (case-insensitive)
 * @param {string} address - Address to match
 * @returns {Promise<Object|null>} - Matching location or null
 */
export async function findExactMatchByAddress(address) {
	const results = await searchByAddress(address, 5);

	// Look for exact match
	const normalized = normalizeForSearch(address);
	const exactMatch = results.find(r => r.searchAddress === normalized);

	return exactMatch || null;
}

/**
 * Auto-fills form fields from a location suggestion
 * Only fills fields that are currently empty to avoid overwriting user input
 * @param {Object} location - Location suggestion object
 * @param {Object} fieldIds - Map of field names to element IDs
 */
export function autoFillFormFields(location, fieldIds = {}) {
	const defaultFieldIds = {
		label: 'label',
		address: 'address',
		city: 'city',
		state: 'state',
		contactName: 'contactName',
		contactEmail: 'contactEmail',
		contactPhone: 'contactPhone'
	};

	const ids = { ...defaultFieldIds, ...fieldIds };

	// Helper to safely fill a field only if empty
	const fillIfEmpty = (fieldId, value) => {
		const element = document.getElementById(fieldId);
		if (element && !element.value && value) {
			element.value = value;
		}
	};

	fillIfEmpty(ids.label, location.label);
	fillIfEmpty(ids.address, location.address);
	fillIfEmpty(ids.city, location.city);
	fillIfEmpty(ids.state, location.state);
	fillIfEmpty(ids.contactName, location.contactName);
	fillIfEmpty(ids.contactEmail, location.contactEmail);
	fillIfEmpty(ids.contactPhone, location.contactPhone);
}

/**
 * Creates a simple autocomplete dropdown for an input field
 * @param {HTMLElement} inputElement - The input element to attach autocomplete to
 * @param {Function} searchFunction - Function that returns promises with search results
 * @param {Function} onSelect - Callback when user selects a suggestion
 * @param {number} debounceMs - Debounce delay in milliseconds
 */
export function createAutocomplete(inputElement, searchFunction, onSelect, debounceMs = 300) {
	let debounceTimer;
	let dropdownElement;
	let selectedIndex = -1;
	let currentResults = [];

	// Create dropdown element
	function createDropdown() {
		const dropdown = document.createElement('div');
		dropdown.className = 'autocomplete-dropdown';
		dropdown.style.cssText = `
			position: absolute;
			background: white;
			border: 1px solid #ccc;
			border-top: none;
			max-height: 200px;
			overflow-y: auto;
			z-index: 1000;
			box-shadow: 0 4px 6px rgba(0,0,0,0.1);
		`;
		dropdown.style.display = 'none';
		inputElement.parentElement.style.position = 'relative';
		inputElement.parentElement.appendChild(dropdown);
		return dropdown;
	}

	dropdownElement = createDropdown();

	// Helper to highlight selected item
	function updateSelectedItem() {
		const items = dropdownElement.querySelectorAll('.autocomplete-item');
		items.forEach((item, index) => {
			if (index === selectedIndex) {
				item.style.backgroundColor = '#e3f2fd';
			} else {
				item.style.backgroundColor = 'white';
			}
		});
	}

	// Helper to select current item
	function selectCurrentItem() {
		if (selectedIndex >= 0 && selectedIndex < currentResults.length) {
			onSelect(currentResults[selectedIndex]);
			dropdownElement.style.display = 'none';
			selectedIndex = -1;
		}
	}

	// Handle input changes
	inputElement.addEventListener('input', (e) => {
		const value = e.target.value;

		clearTimeout(debounceTimer);
		selectedIndex = -1; // Reset selection on new input

		if (value.length < 2) {
			dropdownElement.style.display = 'none';
			currentResults = [];
			return;
		}

		debounceTimer = setTimeout(async () => {
			const results = await searchFunction(value);
			currentResults = results;

			if (results.length === 0) {
				dropdownElement.style.display = 'none';
				currentResults = [];
				return;
			}

			// Build dropdown HTML (with XSS protection)
			dropdownElement.innerHTML = results.map(result => `
				<div class="autocomplete-item" data-id="${escapeHtml(result.id)}" style="
					padding: 10px;
					cursor: pointer;
					border-bottom: 1px solid #eee;
				">
					<div style="font-weight: bold;">${escapeHtml(result.label || '(No label)')}</div>
					<div style="font-size: 0.875rem; color: #666;">${escapeHtml(result.address || '')}, ${escapeHtml(result.city || '')}</div>
				</div>
			`).join('');

			// Position dropdown
			dropdownElement.style.display = 'block';
			dropdownElement.style.top = inputElement.offsetHeight + 'px';
			dropdownElement.style.left = '0';
			dropdownElement.style.width = inputElement.offsetWidth + 'px';

			// Add hover and click effects
			dropdownElement.querySelectorAll('.autocomplete-item').forEach((item, index) => {
				item.addEventListener('mouseenter', () => {
					selectedIndex = index;
					updateSelectedItem();
				});
				item.addEventListener('click', () => {
					const selectedId = item.getAttribute('data-id');
					const selectedResult = results.find(r => r.id === selectedId);
					if (selectedResult) {
						onSelect(selectedResult);
						dropdownElement.style.display = 'none';
						selectedIndex = -1;
					}
				});
			});
		}, debounceMs);
	});

	// Hide dropdown when clicking outside
	document.addEventListener('click', (e) => {
		if (e.target !== inputElement && !dropdownElement.contains(e.target)) {
			dropdownElement.style.display = 'none';
			selectedIndex = -1;
		}
	});

	// Keyboard navigation
	inputElement.addEventListener('keydown', (e) => {
		const isVisible = dropdownElement.style.display === 'block';

		if (!isVisible) return;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
				updateSelectedItem();
				break;

			case 'ArrowUp':
				e.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, 0);
				updateSelectedItem();
				break;

			case 'Enter':
				e.preventDefault();
				selectCurrentItem();
				break;

			case 'Tab':
				// Auto-select first item on Tab if nothing selected
				if (selectedIndex === -1 && currentResults.length > 0) {
					e.preventDefault();
					selectedIndex = 0;
					selectCurrentItem();
				} else if (selectedIndex >= 0) {
					e.preventDefault();
					selectCurrentItem();
				}
				break;

			case 'Escape':
				e.preventDefault();
				dropdownElement.style.display = 'none';
				selectedIndex = -1;
				break;
		}
	});
}
