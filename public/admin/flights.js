document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const flightTableBody = document.getElementById('flight-table-body');
    const totalFlightsEl = document.getElementById('total-flights');
    const paginationEl = document.getElementById('pagination');
    const filterForm = document.getElementById('filter-form');
    const resetFilterBtn = document.getElementById('reset-filter');
    const addFlightBtn = document.getElementById('add-flight-btn');
    const flightModal = new bootstrap.Modal(document.getElementById('flight-modal'));
    const deleteModal = new bootstrap.Modal(document.getElementById('delete-modal'));
    const saveFlightBtn = document.getElementById('save-flight');
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    // State variables
    let currentPage = 1;
    let flights = [];
    let flightToDelete = null;
    let isEditMode = false;
    
    // Pagination settings
    const itemsPerPage = 10;
    
    // Initialize the page
    init();
    
    function init() {
        // Load initial flights
        loadFlights();
        
        // Event listeners
        filterForm.addEventListener('submit', handleFilterSubmit);
        resetFilterBtn.addEventListener('click', resetFilters);
        addFlightBtn.addEventListener('click', showAddFlightModal);
        saveFlightBtn.addEventListener('click', saveFlight);
        confirmDeleteBtn.addEventListener('click', deleteFlight);
        
        // Set current date as default for the filter date
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('filter-date').value = today;
    }
    
    // API Functions
    async function loadFlights(filters = {}) {
        showLoading(true);
        
        try {
            let url = 'http://localhost:3000/api/flights';
            
            // Add query parameters based on filters
            if (Object.keys(filters).length > 0) {
                const queryParams = new URLSearchParams();
                
                if (filters.departure) queryParams.append('departure', filters.departure);
                if (filters.destination) queryParams.append('destination', filters.destination);
                if (filters.departDate) queryParams.append('departDate', filters.departDate);
                if (filters.status) queryParams.append('status', filters.status);
                
                url += '?' + queryParams.toString();
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Failed to fetch flights');
            }
            
            flights = await response.json();
            
            // Update table and pagination
            renderTable();
            renderPagination();
            totalFlightsEl.textContent = flights.length;
        } catch (error) {
            console.error('Error loading flights:', error);
            showAlert('Không thể tải danh sách chuyến bay. Vui lòng thử lại sau.', 'danger');
        } finally {
            showLoading(false);
        }
    }
    
    async function saveFlight() {
        const flightData = getFlightFormData();
        
        if (!validateFlightData(flightData)) {
            return;
        }
        
        showLoading(true);
        
        try {
            // URL cho request
            let url = 'http://localhost:3000/api/flights';
            let method = 'POST';
            
            if (isEditMode) {
                // Khi cập nhật, sử dụng endpoint đúng
                url = isNaN(flightData.flight_id) 
                    ? `http://localhost:3000/api/flights/code/${flightData.flight_id}` // Nếu ID là chuỗi (ví dụ: VN1000)
                    : `http://localhost:3000/api/flights/${flightData.flight_id}`;      // Nếu ID là số
                method = 'PUT';
            }
                
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(flightData)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Failed to ${isEditMode ? 'update' : 'create'} flight: ${errorData.error || response.statusText}`);
            }
            
            flightModal.hide();
            showAlert(`Chuyến bay đã được ${isEditMode ? 'cập nhật' : 'tạo'} thành công`, 'success');
            loadFlights(getFilterValues());
        } catch (error) {
            console.error('Error saving flight:', error);
            showAlert(`Không thể ${isEditMode ? 'cập nhật' : 'tạo'} chuyến bay. ${error.message}`, 'danger');
        } finally {
            showLoading(false);
        }
    }
    
    async function deleteFlight() {
        if (!flightToDelete) return;
        
        showLoading(true);
        
        try {
            // URL cho request
            let url = isNaN(flightToDelete) 
                ? `http://localhost:3000/api/flights/code/${flightToDelete}` // Nếu ID là chuỗi (ví dụ: VN1000)
                : `http://localhost:3000/api/flights/${flightToDelete}`;      // Nếu ID là số
            
            const response = await fetch(url, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Failed to delete flight: ${errorData.error || response.statusText}`);
            }
            
            deleteModal.hide();
            showAlert('Chuyến bay đã được xóa thành công', 'success');
            loadFlights(getFilterValues());
        } catch (error) {
            console.error('Error deleting flight:', error);
            showAlert(`Không thể xóa chuyến bay. ${error.message}`, 'danger');
        } finally {
            showLoading(false);
            flightToDelete = null;
        }
    }
    
    // UI Functions
    function renderTable() {
        flightTableBody.innerHTML = '';
        
        // Calculate pagination
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, flights.length);
        const paginatedFlights = flights.slice(startIndex, endIndex);
        
        if (paginatedFlights.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="12" class="text-center">Không có chuyến bay nào</td>`;
            flightTableBody.appendChild(tr);
            return;
        }
        
        paginatedFlights.forEach(flight => {
            const tr = document.createElement('tr');
            
            // Format dates - adjust for different date formats
            let formattedDepartureTime, formattedArrivalTime, formattedDate;
            
            if (flight.departureTime && flight.arrivalTime) {
                // If we have the formatted time already
                formattedDepartureTime = flight.departureTime;
                formattedArrivalTime = flight.arrivalTime;
                formattedDate = flight.date || 'N/A';
            } else {
                // If we need to format from full datetime
                const departureTime = new Date(flight.departure_time);
                const arrivalTime = new Date(flight.arrival_time);
                formattedDepartureTime = !isNaN(departureTime) ? formatDateTime(departureTime) : 'N/A';
                formattedArrivalTime = !isNaN(arrivalTime) ? formatDateTime(arrivalTime) : 'N/A';
                
                // Extract date portion from departure_time
                formattedDate = !isNaN(departureTime) ? formatDate(departureTime) : 'N/A';
            }
            
            // Format status
            const statusMap = {
                'scheduled': { text: 'Đã lên lịch', class: 'bg-info' },
                'boarding': { text: 'Đang lên máy bay', class: 'bg-primary' },
                'departed': { text: 'Đã khởi hành', class: 'bg-success' },
                'arrived': { text: 'Đã đến nơi', class: 'bg-success' },
                'cancelled': { text: 'Đã hủy', class: 'bg-danger' },
                'delayed': { text: 'Bị hoãn', class: 'bg-warning' }
            };
            
            const status = statusMap[flight.status] || { text: flight.status, class: 'bg-secondary' };
            
            // Format available classes
            const availableClasses = (flight.available_classes || flight.availableClasses || '').toString();
            let formattedClasses = '';
            
            if (availableClasses.includes('ECONOMY')) formattedClasses += '<span class="badge bg-success me-1">PT</span>';
            if (availableClasses.includes('PREMIUM_ECONOMY')) formattedClasses += '<span class="badge bg-info me-1">PĐB</span>';
            if (availableClasses.includes('BUSINESS')) formattedClasses += '<span class="badge bg-primary me-1">TG</span>';
            if (availableClasses.includes('FIRST')) formattedClasses += '<span class="badge bg-warning me-1">HN</span>';
            
            tr.innerHTML = `
                <td>${flight.flight_id || flight.id}</td>
                <td>${flight.airline}</td>
                <td>${flight.airline_code || flight.airlineCode}${flight.flight_number}</td>
                <td>${flight.departure_airport || flight.departure}</td>
                <td>${flight.arrival_airport || flight.destination}</td>
                <td>${formattedDate}</td>
                <td>${formattedDepartureTime}</td>
                <td>${formattedArrivalTime}</td>
                <td>${formatCurrency(flight.price)}</td>
                <td>${formattedClasses}</td>
                <td>${flight.available_seats || flight.availableSeats}</td>
                <td><span class="badge ${status.class}">${status.text}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary edit-flight" data-id="${flight.flight_id || flight.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-flight" data-id="${flight.flight_id || flight.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            flightTableBody.appendChild(tr);
        });
        
        // Add event listeners for edit and delete buttons
        document.querySelectorAll('.edit-flight').forEach(btn => {
            btn.addEventListener('click', () => showEditFlightModal(btn.dataset.id));
        });
        
        document.querySelectorAll('.delete-flight').forEach(btn => {
            btn.addEventListener('click', () => showDeleteModal(btn.dataset.id));
        });
    }
    
    function renderPagination() {
        paginationEl.innerHTML = '';
        
        if (flights.length <= itemsPerPage) {
            return;
        }
        
        const totalPages = Math.ceil(flights.length / itemsPerPage);
        
        // Previous button
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `<a class="page-link" href="#" aria-label="Previous">
            <span aria-hidden="true">&laquo;</span>
        </a>`;
        prevLi.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentPage > 1) {
                currentPage--;
                renderTable();
                renderPagination();
            }
        });
        paginationEl.appendChild(prevLi);
        
        // First group button (if needed)
        if (currentPage > 5) {
            const firstGroupLi = document.createElement('li');
            firstGroupLi.className = 'page-item';
            firstGroupLi.innerHTML = `<a class="page-link" href="#">1</a>`;
            firstGroupLi.addEventListener('click', (e) => {
                e.preventDefault();
                currentPage = 1;
                renderTable();
                renderPagination();
            });
            paginationEl.appendChild(firstGroupLi);
            
            // Ellipsis if not directly after page 1
            if (currentPage > 6) {
                const ellipsisLi = document.createElement('li');
                ellipsisLi.className = 'page-item disabled';
                ellipsisLi.innerHTML = `<a class="page-link" href="#">...</a>`;
                paginationEl.appendChild(ellipsisLi);
            }
        }
        
        // Calculate start and end pages to show in the current view
        let startPage = Math.max(1, currentPage - 4);
        let endPage = Math.min(totalPages, startPage + 9);
        
        // Adjust start page if we're near the end
        if (endPage - startPage < 9) {
            startPage = Math.max(1, endPage - 9);
        }
        
        // Page numbers - only showing 10 pages at most
        for (let i = startPage; i <= endPage; i++) {
            const li = document.createElement('li');
            li.className = `page-item ${i === currentPage ? 'active' : ''}`;
            li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            li.addEventListener('click', (e) => {
                e.preventDefault();
                currentPage = i;
                renderTable();
                renderPagination();
            });
            paginationEl.appendChild(li);
        }
        
        // Last group button (if needed)
        if (endPage < totalPages) {
            // Ellipsis if not directly before the last page
            if (endPage < totalPages - 1) {
                const ellipsisLi = document.createElement('li');
                ellipsisLi.className = 'page-item disabled';
                ellipsisLi.innerHTML = `<a class="page-link" href="#">...</a>`;
                paginationEl.appendChild(ellipsisLi);
            }
            
            const lastGroupLi = document.createElement('li');
            lastGroupLi.className = 'page-item';
            lastGroupLi.innerHTML = `<a class="page-link" href="#">${totalPages}</a>`;
            lastGroupLi.addEventListener('click', (e) => {
                e.preventDefault();
                currentPage = totalPages;
                renderTable();
                renderPagination();
            });
            paginationEl.appendChild(lastGroupLi);
        }
        
        // Next button
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
        nextLi.innerHTML = `<a class="page-link" href="#" aria-label="Next">
            <span aria-hidden="true">&raquo;</span>
        </a>`;
        nextLi.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
                renderPagination();
            }
        });
        paginationEl.appendChild(nextLi);
    }
    
    function showAddFlightModal() {
        isEditMode = false;
        resetFlightForm();
        document.getElementById('flight-modal-label').textContent = 'Thêm chuyến bay mới';
        flightModal.show();
    }
    
    function showEditFlightModal(flightId) {
        const flight = flights.find(f => (f.flight_id || f.id).toString() === flightId.toString());
        
        if (!flight) {
            showAlert('Không tìm thấy thông tin chuyến bay.', 'danger');
            return;
        }
        
        isEditMode = true;
        
        // Populate form with flight data
        document.getElementById('flight-id').value = flight.flight_id || flight.id;
        document.getElementById('airline').value = flight.airline;
        document.getElementById('airline-code').value = flight.airline_code || flight.airlineCode;
        document.getElementById('flight-number').value = flight.flight_number;
        document.getElementById('departure-airport').value = flight.departure_airport || flight.departure;
        document.getElementById('arrival-airport').value = flight.arrival_airport || flight.destination;
        
        // Set base economy price - other class prices are calculated automatically
        document.getElementById('price').value = flight.price_economy || flight.price;
        document.getElementById('status').value = flight.status;
        
        // Format dates for datetime-local inputs
        let departureTime, arrivalTime;
        
        if (flight.departure_time) {
            departureTime = new Date(flight.departure_time);
        } else if (flight.departureTime && flight.date) {
            // Combine date and time from API format
            const [day, month, year] = flight.date.split('-');
            const [hours, minutes] = flight.departureTime.split(':');
            departureTime = new Date(year, month-1, day, hours, minutes);
        }
        
        if (flight.arrival_time) {
            arrivalTime = new Date(flight.arrival_time);
        } else if (flight.arrivalTime && flight.date) {
            // Combine date and time from API format
            const [day, month, year] = flight.date.split('-');
            const [hours, minutes] = flight.arrivalTime.split(':');
            arrivalTime = new Date(year, month-1, day, hours, minutes);
        }
        
        if (departureTime && !isNaN(departureTime)) {
            document.getElementById('departure-time').value = formatDateTimeForInput(departureTime);
        }
        
        if (arrivalTime && !isNaN(arrivalTime)) {
            document.getElementById('arrival-time').value = formatDateTimeForInput(arrivalTime);
        }
        
        // Set available classes
        const availableClasses = (flight.available_classes || flight.availableClasses || '').toString();
        document.querySelectorAll('.available-class').forEach(checkbox => {
            checkbox.checked = availableClasses.includes(checkbox.value);
            
            // Trigger the change event to show/hide seat inputs
            const event = new Event('change');
            checkbox.dispatchEvent(event);
        });
        
        // Set seat values for each class
        document.getElementById('economy-seats').value = flight.seats_economy || 0;
        document.getElementById('premium-seats').value = flight.seats_premium_economy || 0;
        document.getElementById('business-seats').value = flight.seats_business || 0;
        document.getElementById('first-seats').value = flight.seats_first || 0;
        
        document.getElementById('flight-modal-label').textContent = 'Chỉnh sửa chuyến bay';
        flightModal.show();
    }
    
    function showDeleteModal(flightId) {
        flightToDelete = flightId;
        deleteModal.show();
    }
    
    function resetFlightForm() {
        document.getElementById('flight-form').reset();
        document.getElementById('flight-id').value = '';
        
        // Set default values
        document.getElementById('economy-class').checked = true;
        document.getElementById('premium-economy-class').checked = false;
        document.getElementById('business-class').checked = false;
        document.getElementById('first-class').checked = false;
        
        // Set default dates to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const departureTime = new Date(tomorrow);
        departureTime.setHours(8, 0, 0);
        
        const arrivalTime = new Date(tomorrow);
        arrivalTime.setHours(10, 0, 0);
        
        document.getElementById('departure-time').value = formatDateTimeForInput(departureTime);
        document.getElementById('arrival-time').value = formatDateTimeForInput(arrivalTime);
    }
    
    function handleFilterSubmit(event) {
        event.preventDefault();
        
        const filters = getFilterValues();
        loadFlights(filters);
    }
    
    function resetFilters() {
        filterForm.reset();
        
        // Set current date as default for the filter date
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('filter-date').value = today;
        
        loadFlights();
    }
    
    function getFilterValues() {
        return {
            departure: document.getElementById('filter-departure').value,
            destination: document.getElementById('filter-destination').value,
            departDate: document.getElementById('filter-date').value,
            status: document.getElementById('filter-status').value
        };
    }
    
    function getFlightFormData() {
        // Get selected available classes
        const availableClasses = [];
        document.querySelectorAll('.available-class:checked').forEach(checkbox => {
            availableClasses.push(checkbox.value);
        });
        
        // Get seat counts for each class
        const seatsEconomy = document.getElementById('economy-class').checked ? 
            parseInt(document.getElementById('economy-seats').value) || 0 : 0;
            
        const seatsPremiumEconomy = document.getElementById('premium-economy-class').checked ? 
            parseInt(document.getElementById('premium-seats').value) || 0 : 0;
            
        const seatsBusiness = document.getElementById('business-class').checked ? 
            parseInt(document.getElementById('business-seats').value) || 0 : 0;
            
        const seatsFirst = document.getElementById('first-class').checked ? 
            parseInt(document.getElementById('first-seats').value) || 0 : 0;
        
        // Calculate total seats
        const totalSeats = seatsEconomy + seatsPremiumEconomy + seatsBusiness + seatsFirst;
        
        // Get base economy price and calculate other prices with multipliers
        const priceEconomy = parseFloat(document.getElementById('price').value) || 0;
        
        // Automatically calculate prices for other classes with standard multipliers
        const pricePremiumEconomy = document.getElementById('premium-economy-class').checked ? 
            Math.round(priceEconomy * 1.5) : null;
            
        const priceBusiness = document.getElementById('business-class').checked ? 
            Math.round(priceEconomy * 2.5) : null;
            
        const priceFirst = document.getElementById('first-class').checked ? 
            Math.round(priceEconomy * 4.0) : null;
        
        return {
            flight_id: document.getElementById('flight-id').value,
            airline: document.getElementById('airline').value,
            airline_code: document.getElementById('airline-code').value,
            flight_number: document.getElementById('flight-number').value,
            departure_airport: document.getElementById('departure-airport').value,
            arrival_airport: document.getElementById('arrival-airport').value,
            departure_time: document.getElementById('departure-time').value,
            arrival_time: document.getElementById('arrival-time').value,
            price_economy: priceEconomy,
            price_premium_economy: pricePremiumEconomy,
            price_business: priceBusiness,
            price_first: priceFirst,
            seats_economy: seatsEconomy,
            seats_premium_economy: seatsPremiumEconomy,
            seats_business: seatsBusiness,
            seats_first: seatsFirst,
            available_seats: totalSeats,
            status: document.getElementById('status').value,
            available_classes: availableClasses.join(',')
        };
    }
    
    function validateFlightData(flightData) {
        // Check if departure and arrival airports are different
        if (flightData.departure_airport === flightData.arrival_airport) {
            showAlert('Điểm khởi hành và điểm đến không được trùng nhau', 'danger');
            return false;
        }
        
        // Check if departure time is before arrival time
        const departureTime = new Date(flightData.departure_time);
        const arrivalTime = new Date(flightData.arrival_time);
        
        if (departureTime >= arrivalTime) {
            showAlert('Thời gian khởi hành phải trước thời gian đến', 'danger');
            return false;
        }
        
        // Check if at least one seat class is selected
        if (!flightData.available_classes) {
            showAlert('Vui lòng chọn ít nhất một hạng ghế khả dụng', 'danger');
            return false;
        }
        
        // Check if economy price is provided
        if (flightData.available_classes.includes('ECONOMY') && !flightData.price_economy) {
            showAlert('Vui lòng nhập giá vé phổ thông', 'danger');
            return false;
        }
        
        // Check if selected seat classes have seat counts
        const classes = flightData.available_classes.split(',');
        let missingData = false;
        let errorMessage = 'Vui lòng nhập số ghế cho các hạng ghế đã chọn:';
        
        if (classes.includes('ECONOMY') && !flightData.seats_economy) {
            errorMessage += ' Phổ thông,';
            missingData = true;
        }
        
        if (classes.includes('PREMIUM_ECONOMY') && !flightData.seats_premium_economy) {
            errorMessage += ' Phổ thông đặc biệt,';
            missingData = true;
        }
        
        if (classes.includes('BUSINESS') && !flightData.seats_business) {
            errorMessage += ' Thương gia,';
            missingData = true;
        }
        
        if (classes.includes('FIRST') && !flightData.seats_first) {
            errorMessage += ' Hạng nhất,';
            missingData = true;
        }
        
        if (missingData) {
            showAlert(errorMessage.slice(0, -1), 'danger');
            return false;
        }
        
        return true;
    }
    
    // Helper Functions
    function showLoading(show) {
        loadingSpinner.style.display = show ? 'flex' : 'none';
    }
    
    function showAlert(message, type = 'info') {
        // Create alert element
        const alertEl = document.createElement('div');
        alertEl.className = `alert alert-${type} alert-dismissible fade show`;
        alertEl.setAttribute('role', 'alert');
        alertEl.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Add alert to the top of the main content
        const mainContent = document.querySelector('.main-content');
        mainContent.insertBefore(alertEl, mainContent.firstChild);
        
        // Auto dismiss after 5 seconds
        setTimeout(() => {
            alertEl.remove();
        }, 5000);
    }
    
    function formatDateTime(date) {
        return moment(date).format('DD/MM/YYYY HH:mm');
    }
    
    function formatDateTimeForInput(date) {
        return moment(date).format('YYYY-MM-DDTHH:mm');
    }
    
    function formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    }
    
    function formatDate(date) {
        return moment(date).format('DD/MM/YYYY');
    }
}); 