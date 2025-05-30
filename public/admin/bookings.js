document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const bookingTableBody = document.getElementById('booking-table-body');
    const totalBookingsEl = document.getElementById('total-bookings');
    const paginationEl = document.getElementById('pagination');
    const filterForm = document.getElementById('filter-form');
    const resetFilterBtn = document.getElementById('reset-filter');
    const bookingDetailsModal = new bootstrap.Modal(document.getElementById('booking-details-modal'));
    const loadingSpinner = document.getElementById('loading-spinner');
    const savePaymentStatusBtn = document.getElementById('save-payment-status');
    const printBookingBtn = document.getElementById('print-booking');
    
    // State variables
    let currentPage = 1;
    let bookings = [];
    let currentBookingId = null;
    
    // Pagination settings
    const itemsPerPage = 10;
    
    // Initialize the page
    init();
    
    function init() {
        // Load initial bookings
        loadBookings();
        
        // Set up event listeners
        filterForm.addEventListener('submit', handleFilterSubmit);
        resetFilterBtn.addEventListener('click', resetFilters);
        savePaymentStatusBtn.addEventListener('click', updatePaymentStatus);
        printBookingBtn.addEventListener('click', printBookingDetails);
        
        // Set default date range (last 30 days)
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        document.getElementById('filter-to-date').value = today.toISOString().split('T')[0];
        document.getElementById('filter-from-date').value = thirtyDaysAgo.toISOString().split('T')[0];
    }
    
    // API Functions
    async function loadBookings(filters = {}) {
        showLoading(true);
        
        try {
            let url = 'http://localhost:3000/api/admin/bookings';
            
            // Add query parameters based on filters
            if (Object.keys(filters).length > 0) {
                const queryParams = new URLSearchParams();
                
                if (filters.bookingId) queryParams.append('bookingId', filters.bookingId);
                if (filters.contactName) queryParams.append('contactName', filters.contactName);
                if (filters.paymentStatus) queryParams.append('paymentStatus', filters.paymentStatus);
                if (filters.fromDate) queryParams.append('fromDate', filters.fromDate);
                if (filters.toDate) queryParams.append('toDate', filters.toDate);
                
                url += '?' + queryParams.toString();
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Failed to fetch bookings');
            }
            
            bookings = await response.json();
            
            // Update table and pagination
            renderTable();
            renderPagination();
            totalBookingsEl.textContent = bookings.length;
        } catch (error) {
            console.error('Error loading bookings:', error);
            showAlert('Không thể tải danh sách đặt vé. Vui lòng thử lại sau.', 'danger');
        } finally {
            showLoading(false);
        }
    }
    
    async function loadBookingDetails(bookingId) {
        showLoading(true);
        
        try {
            const response = await fetch(`http://localhost:3000/api/admin/bookings/${bookingId}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch booking details');
            }
            
            const bookingDetails = await response.json();
            renderBookingDetails(bookingDetails);
            currentBookingId = bookingId;
            
            bookingDetailsModal.show();
        } catch (error) {
            console.error('Error loading booking details:', error);
            showAlert('Không thể tải chi tiết đặt vé. Vui lòng thử lại sau.', 'danger');
        } finally {
            showLoading(false);
        }
    }
    
    async function updatePaymentStatus() {
        if (!currentBookingId) return;
        
        const newStatus = document.getElementById('update-payment-status').value;
        const oldStatus = document.querySelector('#detail-payment-status .badge').textContent;
        
        showLoading(true);
        
        try {
            const response = await fetch(`http://localhost:3000/api/admin/bookings/${currentBookingId}/payment`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ paymentStatus: newStatus })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update payment status');
            }
            
            const responseData = await response.json();
            
            // Thông báo phù hợp với trạng thái cập nhật
            let message = 'Trạng thái thanh toán đã được cập nhật thành công';
            if (newStatus === 'paid' && oldStatus !== 'Đã thanh toán') {
                message = 'Trạng thái thanh toán đã được cập nhật thành "Đã thanh toán". Ghế đã được tự động gán cho hành khách.';
            }
            
            showAlert(message, 'success');
            
            // Reload booking details
            await loadBookingDetails(currentBookingId);
            
            // Reload bookings list
            loadBookings(getFilterValues());
        } catch (error) {
            console.error('Error updating payment status:', error);
            showAlert('Không thể cập nhật trạng thái thanh toán. Vui lòng thử lại sau.', 'danger');
        } finally {
            showLoading(false);
        }
    }
    
    // UI Functions
    function renderTable() {
        bookingTableBody.innerHTML = '';
        
        // Calculate pagination
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, bookings.length);
        const paginatedBookings = bookings.slice(startIndex, endIndex);
        
        if (paginatedBookings.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="10" class="text-center">Không có đơn đặt vé nào</td>`;
            bookingTableBody.appendChild(tr);
            return;
        }
        
        paginatedBookings.forEach(booking => {
            const tr = document.createElement('tr');
            
            // Format booking time
            const bookingTime = new Date(booking.booking_time);
            const formattedBookingTime = formatDateTime(bookingTime);
            
            // Format payment status
            const statusMap = {
                'unpaid': { text: 'Chờ xác nhận', class: 'bg-warning' },
                'paid': { text: 'Đã thanh toán', class: 'bg-success' },
                'refunded': { text: 'Hoàn tiền', class: 'bg-info' },
                'cancelled': { text: 'Đã hủy', class: 'bg-danger' }
            };
            
            const status = statusMap[booking.payment_status] || { text: booking.payment_status, class: 'bg-secondary' };
            
            // Format travel class
            const travelClassMap = {
                'ECONOMY': 'Phổ thông',
                'PREMIUM_ECONOMY': 'Phổ thông đặc biệt',
                'BUSINESS': 'Thương gia',
                'FIRST': 'Thương gia hạng nhất'
            };
            
            const travelClass = travelClassMap[booking.travel_class] || booking.travel_class;
            
            // Determine if it's a round-trip booking
            const isRoundTrip = booking.is_round_trip === 1;
            const tripType = isRoundTrip ? 
                '<span class="badge bg-primary">Khứ hồi</span>' : 
                '<span class="badge bg-secondary">Một chiều</span>';
            
            // Format flight information with origin-destination
            let flightInfo = 'N/A';
            if (booking.flight_info) {
                flightInfo = `${booking.flight_info.airline_code}${booking.flight_info.flight_number}<br>
                           <small>${booking.flight_info.departure_airport} ⟶ ${booking.flight_info.arrival_airport}</small>`;
                
                // If it's a round-trip, add return flight info
                if (isRoundTrip && booking.return_flight_info) {
                    flightInfo += `<br><hr class="my-1"><small>${booking.return_flight_info.airline_code}${booking.return_flight_info.flight_number}<br>
                                ${booking.return_flight_info.departure_airport} ⟶ ${booking.return_flight_info.arrival_airport}</small>`;
                }
            }
            
            tr.innerHTML = `
                <td>${booking.booking_id}</td>
                <td>${booking.contact_name}</td>
                <td>${tripType}</td>
                <td>${flightInfo}</td>
                <td>${formattedBookingTime}</td>
                <td>${booking.passenger_count || 'N/A'}</td>
                <td>${travelClass}</td>
                <td>${formatCurrency(booking.total_amount)}</td>
                <td><span class="badge ${status.class}">${status.text}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary view-booking" data-id="${booking.booking_id}">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            `;
            
            bookingTableBody.appendChild(tr);
        });
        
        // Add event listeners for view booking buttons
        document.querySelectorAll('.view-booking').forEach(btn => {
            btn.addEventListener('click', () => loadBookingDetails(btn.dataset.id));
        });
    }
    
    function renderPagination() {
        paginationEl.innerHTML = '';
        
        if (bookings.length <= itemsPerPage) {
            return;
        }
        
        const totalPages = Math.ceil(bookings.length / itemsPerPage);
        
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
        
        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
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
    
    function renderBookingDetails(bookingDetails) {
        console.log('Booking details:', bookingDetails);
        
        const booking = bookingDetails.booking;
        const departureFlight = bookingDetails.departureFlight;
        const returnFlight = bookingDetails.returnFlight;
        const passengers = bookingDetails.passengers;
        const passengerCounts = bookingDetails.passengerCounts;
        
        // Format booking date
        const bookingTime = new Date(booking.booking_time);
        const formattedBookingTime = formatDateTime(bookingTime);
        
        // Format payment status
        const statusMap = {
            'unpaid': { text: 'Chờ xác nhận', class: 'bg-warning' },
            'paid': { text: 'Đã thanh toán', class: 'bg-success' },
            'refunded': { text: 'Hoàn tiền', class: 'bg-info' },
            'cancelled': { text: 'Đã hủy', class: 'bg-danger' }
        };
        
        const status = statusMap[booking.payment_status] || { text: booking.payment_status, class: 'bg-secondary' };
        
        // Determine if it's a round-trip booking
        const isRoundTrip = booking.is_round_trip === 1;
        const tripType = isRoundTrip ? 'Khứ hồi' : 'Một chiều';
        
        // Booking info
        document.getElementById('detail-booking-id').textContent = booking.booking_id;
        document.getElementById('detail-booking-date').textContent = formattedBookingTime;
        document.getElementById('detail-trip-type').textContent = tripType;
        document.getElementById('detail-contact-name').textContent = booking.contact_name;
        document.getElementById('detail-email').textContent = booking.email || 'N/A';
        document.getElementById('detail-phone').textContent = booking.phone || 'N/A';
        document.getElementById('detail-promo-code').textContent = booking.promo_code || 'Không có';
        document.getElementById('detail-total-amount').textContent = formatCurrency(booking.total_amount);
        document.getElementById('detail-payment-status').innerHTML = `<span class="badge ${status.class}">${status.text}</span>`;
        
        // Set payment method and transaction information
        const paymentMethodEl = document.getElementById('detail-payment-method');
        const transactionInfoEl = document.getElementById('detail-transaction-info');
        
        // Default values
        paymentMethodEl.textContent = 'Không có thông tin';
        transactionInfoEl.textContent = 'Không có thông tin';
        
        // Check if we have payment information from the API
        if (bookingDetails.paymentInfo) {
            const methodMap = {
                'bank_transfer': 'Chuyển khoản ngân hàng',
                'momo': 'Ví điện tử MoMo'
            };
            
            paymentMethodEl.textContent = methodMap[bookingDetails.paymentInfo.method] || bookingDetails.paymentInfo.method;
            
            // Parse and display transaction info
            if (bookingDetails.paymentInfo.transaction_info) {
                try {
                    const transactionInfo = JSON.parse(bookingDetails.paymentInfo.transaction_info);
                    
                    if (bookingDetails.paymentInfo.method === 'bank_transfer') {
                        let infoHtml = `<ul class="list-unstyled mb-0">`;
                        if (transactionInfo.senderName) {
                            infoHtml += `<li><strong>Người chuyển:</strong> ${transactionInfo.senderName}</li>`;
                        }
                        if (transactionInfo.bankName) {
                            infoHtml += `<li><strong>Ngân hàng:</strong> ${transactionInfo.bankName}</li>`;
                        }
                        if (transactionInfo.transferDate) {
                            const transferDate = new Date(transactionInfo.transferDate);
                            infoHtml += `<li><strong>Ngày chuyển:</strong> ${formatDateTime(transferDate)}</li>`;
                        }
                        infoHtml += `</ul>`;
                        transactionInfoEl.innerHTML = infoHtml;
                    } else if (bookingDetails.paymentInfo.method === 'momo') {
                        let infoHtml = `<ul class="list-unstyled mb-0">`;
                        if (transactionInfo.phoneNumber) {
                            infoHtml += `<li><strong>Số điện thoại:</strong> ${transactionInfo.phoneNumber}</li>`;
                        }
                        if (transactionInfo.transactionDate) {
                            const transactionDate = new Date(transactionInfo.transactionDate);
                            infoHtml += `<li><strong>Ngày giao dịch:</strong> ${formatDateTime(transactionDate)}</li>`;
                        }
                        infoHtml += `</ul>`;
                        transactionInfoEl.innerHTML = infoHtml;
                    } else {
                        transactionInfoEl.textContent = JSON.stringify(transactionInfo);
                    }
                } catch (error) {
                    console.warn('Error parsing transaction info:', error);
                    transactionInfoEl.textContent = bookingDetails.paymentInfo.transaction_info;
                }
            }
        }
        
        // Format travel class
        const travelClassMap = {
            'ECONOMY': 'Phổ thông',
            'PREMIUM_ECONOMY': 'Phổ thông đặc biệt',
            'BUSINESS': 'Thương gia',
            'FIRST': 'Thương gia hạng nhất'
        };
        
        const travelClass = travelClassMap[booking.travel_class] || booking.travel_class;
        document.getElementById('detail-travel-class').textContent = travelClass;
        
        // Passenger counts
        if (passengerCounts) {
            document.getElementById('adult-count').textContent = `${passengerCounts.numAdults || 0} người lớn`;
            document.getElementById('child-count').textContent = `${passengerCounts.numChildren || 0} trẻ em`;
            document.getElementById('infant-count').textContent = `${passengerCounts.numInfants || 0} em bé`;
        } else {
            // Backup logic in case we don't have passenger counts
            const adultCount = passengers.filter(p => p.passenger_type === 'ADULT').length;
            const childCount = passengers.filter(p => p.passenger_type === 'CHILD').length;
            const infantCount = passengers.filter(p => p.passenger_type === 'INFANT').length;
            
            document.getElementById('adult-count').textContent = `${adultCount} người lớn`;
            document.getElementById('child-count').textContent = `${childCount} trẻ em`;
            document.getElementById('infant-count').textContent = `${infantCount} em bé`;
        }
        
        // Set current payment status in select
        document.getElementById('update-payment-status').value = booking.payment_status;
        
        // Đã loại bỏ tính năng gán ghế
        const seatInfoEl = document.getElementById('seat-assignment-info');
        if (seatInfoEl) {
            seatInfoEl.style.display = 'none';
        }
        
        // Check if return flight details should be shown
        const returnFlightDetails = document.getElementById('return-flight-details');
        if (returnFlightDetails) {
            if (isRoundTrip && returnFlight) {
                returnFlightDetails.style.display = 'block';
            } else {
                returnFlightDetails.style.display = 'none';
            }
        }
        
        // Populate departure flight details
        populateFlightDetails(departureFlight, false);
        
        // Populate return flight details if available
        if (isRoundTrip && returnFlight) {
            populateFlightDetails(returnFlight, true);
        }
        
        // Populate passenger list
        const passengerList = document.getElementById('passenger-list');
        passengerList.innerHTML = '';
        
        if (passengers && passengers.length > 0) {
            passengers.forEach((passenger, index) => {
                const tr = document.createElement('tr');
                
                                // Đã loại bỏ hiển thị số ghế
                
                // Xác định loại hành khách và hiển thị với badge màu khác nhau
                let passengerType = '';
                let passengerTypeBadge = '';
                
                if (passenger.passenger_type === 'ADULT') {
                    passengerType = 'Người lớn';
                    passengerTypeBadge = '<span class="badge bg-primary">Người lớn</span>';
                } else if (passenger.passenger_type === 'CHILD') {
                    passengerType = 'Trẻ em';
                    passengerTypeBadge = '<span class="badge bg-info">Trẻ em</span>';
                } else if (passenger.passenger_type === 'INFANT') {
                    passengerType = 'Em bé';
                    passengerTypeBadge = '<span class="badge bg-secondary">Em bé</span>';
                } else {
                    passengerType = 'Người lớn';
                    passengerTypeBadge = '<span class="badge bg-primary">Người lớn</span>';
                }
                
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${passenger.full_name}</td>
                    <td>${passenger.gender || 'N/A'}</td>
                    <td>${passenger.dob || 'N/A'}</td>
                    <td>${passenger.passport_number}</td>
                    <td>${passenger.luggage_weight > 0 ? passenger.luggage_weight + ' kg' : 'Không có'}</td>
                    <td>${passenger.insurance ? 'Có' : 'Không'}</td>
                    <td>${passenger.meal ? 'Có' : 'Không'}</td>
                    <td>${passengerTypeBadge}</td>
                `;
                
                passengerList.appendChild(tr);
            });
        } else {
            passengerList.innerHTML = `<tr><td colspan="9" class="text-center">Không có thông tin hành khách</td></tr>`;
        }
    }
    
    // Helper function to populate flight details
    function populateFlightDetails(flight, isReturn) {
        if (!flight) return;
        
        const prefix = isReturn ? 'detail-return-' : 'detail-';
        
        document.getElementById(prefix + 'flight-id').textContent = flight.airline_code + flight.flight_number;
        document.getElementById(prefix + 'airline').textContent = flight.airline;
        document.getElementById(prefix + 'departure').textContent = flight.departure_airport;
        document.getElementById(prefix + 'destination').textContent = flight.arrival_airport;
        
        // Format the date for display
        document.getElementById(prefix + 'flight-date').textContent = flight.date ? moment(flight.date).format('DD/MM/YYYY') : 'N/A';
        
        // Format the time for display
        try {
            // Try to parse times if they're timestamps or formatted strings
            const depTime = flight.departure_time ? moment(flight.departure_time).format('HH:mm') : 'N/A';
            const arrTime = flight.arrival_time ? moment(flight.arrival_time).format('HH:mm') : 'N/A';
            
            document.getElementById(prefix + 'departure-time').textContent = depTime;
            document.getElementById(prefix + 'arrival-time').textContent = arrTime;
        } catch (e) {
            // Fallback to original values if parsing fails
            document.getElementById(prefix + 'departure-time').textContent = flight.departure_time || 'N/A';
            document.getElementById(prefix + 'arrival-time').textContent = flight.arrival_time || 'N/A';
        }
    }
    
    function handleFilterSubmit(event) {
        event.preventDefault();
        
        const filters = getFilterValues();
        loadBookings(filters);
    }
    
    function resetFilters() {
        filterForm.reset();
        
        // Set default date range (last 30 days)
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        document.getElementById('filter-to-date').value = today.toISOString().split('T')[0];
        document.getElementById('filter-from-date').value = thirtyDaysAgo.toISOString().split('T')[0];
        
        loadBookings();
    }
    
    function getFilterValues() {
        return {
            bookingId: document.getElementById('filter-booking-id').value,
            contactName: document.getElementById('filter-contact-name').value,
            paymentStatus: document.getElementById('filter-payment-status').value,
            fromDate: document.getElementById('filter-from-date').value,
            toDate: document.getElementById('filter-to-date').value
        };
    }
    
    function printBookingDetails() {
        if (!currentBookingId) return;
        
        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        
        // Get booking details from the modal
        const bookingId = document.getElementById('detail-booking-id').textContent;
        const contactName = document.getElementById('detail-contact-name').textContent;
        const tripType = document.getElementById('detail-trip-type').textContent;
        const isRoundTrip = tripType === 'Khứ hồi';
        
        // Departure flight info
        const departureFlightId = document.getElementById('detail-flight-id').textContent;
        const departureAirline = document.getElementById('detail-airline').textContent;
        const departureDeparture = document.getElementById('detail-departure').textContent;
        const departureDestination = document.getElementById('detail-destination').textContent;
        const departureFlightDate = document.getElementById('detail-flight-date').textContent;
        const departureDepartureTime = document.getElementById('detail-departure-time').textContent;
        const departureArrivalTime = document.getElementById('detail-arrival-time').textContent;
        
        // Return flight info (if round-trip)
        let returnFlightInfo = '';
        if (isRoundTrip) {
            const returnFlightId = document.getElementById('detail-return-flight-id').textContent;
            const returnAirline = document.getElementById('detail-return-airline').textContent;
            const returnDeparture = document.getElementById('detail-return-departure').textContent;
            const returnDestination = document.getElementById('detail-return-destination').textContent;
            const returnFlightDate = document.getElementById('detail-return-flight-date').textContent;
            const returnDepartureTime = document.getElementById('detail-return-departure-time').textContent;
            const returnArrivalTime = document.getElementById('detail-return-arrival-time').textContent;
            
            returnFlightInfo = `
            <div class="booking-info">
                <h2>Thông tin chuyến bay về</h2>
                <table>
                    <tr>
                        <th>Mã chuyến bay:</th>
                        <td>${returnFlightId}</td>
                    </tr>
                    <tr>
                        <th>Hãng bay:</th>
                        <td>${returnAirline}</td>
                    </tr>
                    <tr>
                        <th>Lộ trình:</th>
                        <td>${returnDeparture} → ${returnDestination}</td>
                    </tr>
                    <tr>
                        <th>Ngày bay:</th>
                        <td>${returnFlightDate}</td>
                    </tr>
                    <tr>
                        <th>Giờ khởi hành:</th>
                        <td>${returnDepartureTime}</td>
                    </tr>
                    <tr>
                        <th>Giờ đến:</th>
                        <td>${returnArrivalTime}</td>
                    </tr>
                </table>
            </div>
            `;
        }
        
        const travelClass = document.getElementById('detail-travel-class').textContent;
        const totalAmount = document.getElementById('detail-total-amount').textContent;
        
        // Lấy thông tin số lượng hành khách theo loại
        const adultCount = document.getElementById('adult-count').textContent;
        const childCount = document.getElementById('child-count').textContent;
        const infantCount = document.getElementById('infant-count').textContent;
        
        // Create the content for the print window
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Thông tin đặt vé #${bookingId}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .header h1 { margin-bottom: 5px; }
                    .booking-info { margin-bottom: 20px; }
                    .booking-info h2 { border-bottom: 1px solid #ddd; padding-bottom: 5px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    table, th, td { border: 1px solid #ddd; }
                    th, td { padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .footer { margin-top: 50px; text-align: center; font-size: 0.8em; }
                    .passenger-counts { margin-bottom: 15px; }
                    .passenger-counts span { display: inline-block; margin-right: 10px; padding: 5px 10px; border-radius: 4px; background-color: #f5f5f5; }
                    @media print {
                        .no-print { display: none; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>FlyViet</h1>
                    <p>Thông tin đặt vé</p>
                </div>
                
                <div class="booking-info">
                    <h2>Thông tin đặt vé</h2>
                    <table>
                        <tr>
                            <th>Mã đặt vé:</th>
                            <td>${bookingId}</td>
                        </tr>
                        <tr>
                            <th>Người đặt:</th>
                            <td>${contactName}</td>
                        </tr>
                        <tr>
                            <th>Loại vé:</th>
                            <td>${tripType}</td>
                        </tr>
                        <tr>
                            <th>Tổng tiền:</th>
                            <td>${totalAmount}</td>
                        </tr>
                    </table>
                </div>
                
                <div class="booking-info">
                    <h2>Thông tin chuyến bay đi</h2>
                    <table>
                        <tr>
                            <th>Mã chuyến bay:</th>
                            <td>${departureFlightId}</td>
                        </tr>
                        <tr>
                            <th>Hãng bay:</th>
                            <td>${departureAirline}</td>
                        </tr>
                        <tr>
                            <th>Lộ trình:</th>
                            <td>${departureDeparture} → ${departureDestination}</td>
                        </tr>
                        <tr>
                            <th>Ngày bay:</th>
                            <td>${departureFlightDate}</td>
                        </tr>
                        <tr>
                            <th>Giờ khởi hành:</th>
                            <td>${departureDepartureTime}</td>
                        </tr>
                        <tr>
                            <th>Giờ đến:</th>
                            <td>${departureArrivalTime}</td>
                        </tr>
                        <tr>
                            <th>Hạng vé:</th>
                            <td>${travelClass}</td>
                        </tr>
                    </table>
                </div>
                
                ${returnFlightInfo}
                
                <div class="booking-info">
                    <h2>Danh sách hành khách</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Họ tên</th>
                                <th>Giới tính</th>
                                <th>Số hộ chiếu</th>
                                <th>Số ghế</th>
                                <th>Loại hành khách</th>
                                <th>Suất ăn</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${document.getElementById('passenger-list').innerHTML}
                        </tbody>
                    </table>
                </div>
                
                <div class="booking-info">
                    <h2>Thông tin số lượng hành khách</h2>
                    <div class="passenger-counts">
                        <span>Người lớn: ${adultCount}</span>
                        <span>Trẻ em: ${childCount}</span>
                        <span>Em bé: ${infantCount}</span>
                    </div>
                </div>
                
                <div class="footer">
                    <p>Cảm ơn quý khách đã sử dụng dịch vụ của FlyViet!</p>
                    <p>Mọi thắc mắc xin liên hệ: hotline@flyviet.vn | 1900 1234</p>
                </div>
                
                <div class="no-print" style="text-align: center; margin-top: 20px;">
                    <button onclick="window.print()">In vé</button>
                    <button onclick="window.close()">Đóng</button>
                </div>
            </body>
            </html>
        `);
        
        printWindow.document.close();
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
        // Ensure we have a valid date object
        if (!(date instanceof Date) || isNaN(date)) {
            return 'N/A';
        }
        return moment(date).format('DD/MM/YYYY HH:mm');
    }
    
    function formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    }
}); 