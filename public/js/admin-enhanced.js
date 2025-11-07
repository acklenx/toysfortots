// Admin Panel Enhanced Features - Filtering, Sorting, Pagination, Export

export class AdminEnhanced {
	constructor(dataArray, searchInputId, containerElementId, paginationElementId, renderFunction) {
		this.allData = dataArray;
		this.filteredData = [...dataArray];
		this.searchInputId = searchInputId;
		this.containerElementId = containerElementId;
		this.paginationElementId = paginationElementId;
		this.renderFunction = renderFunction;

		this.currentPage = 1;
		this.pageSize = 20;
		this.sortColumn = null;
		this.sortDirection = 'asc';

		this.setupEventListeners();
	}

	setupEventListeners() {
		const searchInput = document.getElementById(this.searchInputId);
		if (searchInput) {
			searchInput.addEventListener('input', (e) => {
				this.filterData(e.target.value);
				this.currentPage = 1;
				this.render();
			});
		}
	}

	filterData(searchTerm) {
		const term = searchTerm.toLowerCase();
		this.filteredData = this.allData.filter(item => {
			return Object.values(item).some(value =>
				String(value).toLowerCase().includes(term)
			);
		});
	}

	sortData(column) {
		if (this.sortColumn === column) {
			this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			this.sortColumn = column;
			this.sortDirection = 'asc';
		}

		this.filteredData.sort((a, b) => {
			const aVal = a[column] || '';
			const bVal = b[column] || '';

			if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
			if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
			return 0;
		});

		this.render();
	}

	getPaginatedData() {
		const startIndex = (this.currentPage - 1) * this.pageSize;
		const endIndex = startIndex + this.pageSize;
		return this.filteredData.slice(startIndex, endIndex);
	}

	getTotalPages() {
		return Math.ceil(this.filteredData.length / this.pageSize);
	}

	nextPage() {
		if (this.currentPage < this.getTotalPages()) {
			this.currentPage++;
			this.render();
		}
	}

	previousPage() {
		if (this.currentPage > 1) {
			this.currentPage--;
			this.render();
		}
	}

	goToPage(page) {
		if (page >= 1 && page <= this.getTotalPages()) {
			this.currentPage = page;
			this.render();
		}
	}

	renderPagination() {
		const paginationContainer = document.getElementById(this.paginationElementId);
		if (!paginationContainer) return;

		const totalPages = this.getTotalPages();

		if (totalPages <= 1) {
			paginationContainer.style.display = 'none';
			return;
		}

		paginationContainer.style.display = 'flex';

		let html = '';
		html += `<button onclick="adminBoxes.previousPage()" ${this.currentPage === 1 ? 'disabled' : ''}>Previous</button>`;
		html += `<span class="page-info">Page ${this.currentPage} of ${totalPages} (${this.filteredData.length} items)</span>`;
		html += `<button onclick="adminBoxes.nextPage()" ${this.currentPage === totalPages ? 'disabled' : ''}>Next</button>`;

		paginationContainer.innerHTML = html;
	}

	render() {
		const paginatedData = this.getPaginatedData();
		const container = document.getElementById(this.containerElementId);

		if (paginatedData.length === 0) {
			container.innerHTML = '<p class="loading">No items found.</p>';
			const paginationContainer = document.getElementById(this.paginationElementId);
			if (paginationContainer) {
				paginationContainer.style.display = 'none';
			}
			return;
		}

		container.innerHTML = this.renderFunction(paginatedData, this.sortColumn, this.sortDirection);
		this.renderPagination();

		// Add click handlers to sortable headers
		const headers = container.querySelectorAll('th.sortable');
		headers.forEach(header => {
			const column = header.dataset.column;
			header.addEventListener('click', () => this.sortData(column));
		});
	}

	exportToCSV(filename) {
		const csvContent = this.convertToCSV(this.filteredData);
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);

		link.setAttribute('href', url);
		link.setAttribute('download', filename);
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	convertToCSV(data) {
		if (data.length === 0) return '';

		const headers = Object.keys(data[0]);
		const csvRows = [];

		// Add header row
		csvRows.push(headers.map(h => `"${h}"`).join(','));

		// Add data rows
		for (const row of data) {
			const values = headers.map(header => {
				const value = row[header] || '';
				return `"${String(value).replace(/"/g, '""')}"`;
			});
			csvRows.push(values.join(','));
		}

		return csvRows.join('\n');
	}

	updateData(newData) {
		this.allData = newData;
		this.filteredData = [...newData];
		const searchInput = document.getElementById(this.searchInputId);
		if (searchInput && searchInput.value) {
			this.filterData(searchInput.value);
		}
		this.currentPage = 1;
		this.render();
	}
}
