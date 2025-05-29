document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const bookingsLoading = document.getElementById('bookings-loading');
    const bookingsList = document.getElementById('bookings-list');
    const noBookings = document.getElementById('no-bookings');
    const bookingSearch = document.getElementById('booking-search');
    const statusFilter = document.getElementById('status-filter');
    
    // API base URL
    const API_BASE_URL = 'http://localhost:3000/api';
    
    // Current bookings data
    let allBookings = [];
    
    // Check authentication
    const checkAuth = () => {
        const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
        if (!sessionId) {
            // Redirect to login page
            window.location.href = 'login.html?redirect=my-bookings.html';
            return false;
        }
        return sessionId;
    };
    
    // Get airport name from code
    const getAirportName = (code) => {
        const airports = {
            'HAN': 'Hà Nội',
            'SGN': 'Hồ Chí Minh',
            'DAD': 'Đà Nẵng',
            'CXR': 'Nha Trang',
            'PQC': 'Phú Quốc',
            'HUI': 'Huế',
            'VCA': 'Cần Thơ',
            'VDO': 'Vân Đồn',
            'DLI': 'Đà Lạt',
            'VCS': 'Côn Đảo'
        };
        return airports[code] || code;
    };
    
    // Format date
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    };
    
    // Format currency
    const formatCurrency = (price) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    };
    
    // Get status class
    const getStatusClass = (status) => {
        switch (status.toLowerCase()) {
            case 'confirmed':
                return 'status-confirmed';
            case 'pending':
                return 'status-pending';
            case 'cancelled':
                return 'status-cancelled';
            default:
                return '';
        }
    };
    
    // Get status text
    const getStatusText = (status) => {
        switch (status.toLowerCase()) {
            case 'confirmed':
                return 'Đã xác nhận';
            case 'pending':
                return 'Đang chờ';
            case 'cancelled':
                return 'Đã hủy';
            default:
                return status;
        }
    };
    
    // Create booking card
    const createBookingCard = (booking) => {
        const card = document.createElement('div');
        card.className = 'booking-card';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'booking-header';
        header.innerHTML = `
            <div class="booking-number">Mã đặt chỗ: ${booking.bookingNumber}</div>
            <div class="booking-status ${getStatusClass(booking.status)}">${getStatusText(booking.status)}</div>
        `;
        card.appendChild(header);
        
        // Create details
        const details = document.createElement('div');
        details.className = 'booking-details';
        
        // Add outbound flight
        const outboundFlight = booking.flights.find(f => f.type === 'outbound');
        if (outboundFlight) {
            const flightInfo = document.createElement('div');
            flightInfo.className = 'flight-info';
            flightInfo.innerHTML = `
                <div class="flight-route">
                    <div class="airport">
                        <div class="airport-code">${outboundFlight.departureCode}</div>
                        <div class="airport-name">${getAirportName(outboundFlight.departureCode)}</div>
                    </div>
                    <div class="flight-arrow">
                        <i class="fas fa-plane"></i>
                    </div>
                    <div class="airport">
                        <div class="airport-code">${outboundFlight.arrivalCode}</div>
                        <div class="airport-name">${getAirportName(outboundFlight.arrivalCode)}</div>
                    </div>
                </div>
                <div class="flight-date">
                    <div class="date">${formatDate(outboundFlight.departureTime)}</div>
                    <div class="flight-number">${outboundFlight.flightNumber}</div>
                </div>
            `;
            details.appendChild(flightInfo);
        }
        
        // Add return flight if exists
        const returnFlight = booking.flights.find(f => f.type === 'return');
        if (returnFlight) {
            const flightInfo = document.createElement('div');
            flightInfo.className = 'flight-info';
            flightInfo.innerHTML = `
                <div class="flight-route">
                    <div class="airport">
                        <div class="airport-code">${returnFlight.departureCode}</div>
                        <div class="airport-name">${getAirportName(returnFlight.departureCode)}</div>
                    </div>
                    <div class="flight-arrow">
                        <i class="fas fa-plane fa-flip-horizontal"></i>
                    </div>
                    <div class="airport">
                        <div class="airport-code">${returnFlight.arrivalCode}</div>
                        <div class="airport-name">${getAirportName(returnFlight.arrivalCode)}</div>
                    </div>
                </div>
                <div class="flight-date">
                    <div class="date">${formatDate(returnFlight.departureTime)}</div>
                    <div class="flight-number">${returnFlight.flightNumber}</div>
                </div>
            `;
            details.appendChild(flightInfo);
        }
        
        // Add passenger info
        const passengerInfo = document.createElement('div');
        passengerInfo.className = 'passenger-info';
        passengerInfo.innerHTML = `
            <div>Hành khách: ${booking.passengers.length} người</div>
        `;
        details.appendChild(passengerInfo);
        
        card.appendChild(details);
        
        // Create footer
        const footer = document.createElement('div');
        footer.className = 'booking-footer';
        
        // Add booking date and price
        footer.innerHTML = `
            <div class="booking-info">
                <div>Ngày đặt: ${formatDate(booking.bookingDate)}</div>
                <div class="booking-price">${formatCurrency(booking.totalPrice)}</div>
            </div>
            <div class="booking-actions">
                <button class="btn-view" data-booking-id="${booking.id}">Xem chi tiết</button>
                ${booking.status.toLowerCase() !== 'cancelled' ? 
                    `<button class="btn-cancel" data-booking-id="${booking.id}">Hủy đặt chỗ</button>` : ''}
            </div>
        `;
        card.appendChild(footer);
        
        return card;
    };
    
    // Fetch bookings from API
    const fetchUserBookings = async () => {
        const sessionId = checkAuth();
        if (!sessionId) return;
        
        try {
            bookingsLoading.style.display = 'block';
            bookingsList.style.display = 'none';
            noBookings.style.display = 'none';
            
            const response = await fetch(`${API_BASE_URL}/user/bookings`, {
                method: 'GET',
                headers: {
                    'Authorization': sessionId,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                allBookings = data.bookings || [];
                displayBookings(allBookings);
            } else {
                console.error('Error fetching bookings:', data.error);
                showNoBookings('Không thể tải dữ liệu đặt chỗ. Vui lòng thử lại sau.');
            }
        } catch (error) {
            console.error('Error fetching bookings:', error);
            showNoBookings('Đã xảy ra lỗi khi kết nối đến máy chủ.');
        } finally {
            bookingsLoading.style.display = 'none';
        }
    };
    
    // Display bookings
    const displayBookings = (bookings) => {
        if (bookings.length === 0) {
            bookingsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-ticket-alt"></i>
                    <p>Bạn chưa có đặt chỗ nào</p>
                    <a href="../../index.html" class="btn-primary">Tìm chuyến bay</a>
                </div>
            `;
            return;
        }
        
        bookingsList.innerHTML = '';
        
        bookings.forEach(booking => {
            // Check if departure time is within 3 hours
            let isWithin3Hours = false;
            let timeUntilDeparture = '';
            let departureTime = '';
            
            if (booking.departureFlight && booking.departureFlight.departure_time) {
                const departureDate = new Date(booking.departureFlight.departure_time);
                departureTime = formatDate(departureDate);
                const now = new Date();
                const timeDiff = departureDate.getTime() - now.getTime();
                const hoursDiff = timeDiff / (1000 * 60 * 60);
                
                if (hoursDiff < 3 && hoursDiff > 0) {
                    isWithin3Hours = true;
                    const hours = Math.floor(hoursDiff);
                    const minutes = Math.floor((hoursDiff - hours) * 60);
                    timeUntilDeparture = `${hours}h ${minutes}m`;
                }
            }
            
            const card = document.createElement('div');
            card.className = 'booking-card';
            
            // Format the date
            let bookingDate = 'N/A';
            if (booking.booking_time) {
                bookingDate = formatDate(booking.booking_time);
            }
            
            // Get airport names
            const departureAirport = booking.departureFlight ? getAirportName(booking.departureFlight.departure) : 'N/A';
            const arrivalAirport = booking.departureFlight ? getAirportName(booking.departureFlight.destination) : 'N/A';
            
            // Format status badge
            const statusClass = getStatusClass(booking.payment_status);
            const statusText = getStatusText(booking.payment_status);
            
            // Determine if cancel button should be shown
            const showCancelButton = booking.payment_status !== 'cancelled' && !isWithin3Hours;
            
            card.innerHTML = `
                <div class="booking-header">
                    <div class="booking-ref">
                        <span class="label">Mã đặt chỗ</span>
                        <span class="value">${booking.booking_id}</span>
                    </div>
                    <div class="booking-date">
                        <span class="label">Ngày đặt</span>
                        <span class="value">${bookingDate}</span>
                    </div>
                    <div class="booking-status">
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                </div>
                <div class="booking-content">
                    <div class="flight-info">
                        <div class="route">
                            <span class="departure">${departureAirport}</span>
                            <i class="fas fa-plane"></i>
                            <span class="arrival">${arrivalAirport}</span>
                        </div>
                        <div class="departure-time">
                            <span class="label">Khởi hành</span>
                            <span class="value">${departureTime}</span>
                            ${isWithin3Hours ? `<span class="time-warning">Còn ${timeUntilDeparture}</span>` : ''}
                        </div>
                    </div>
                    <div class="booking-price">
                        <span class="label">Tổng tiền</span>
                        <span class="value">${formatCurrency(booking.total_amount)}</span>
                    </div>
                </div>
                <div class="booking-actions">
                    <a href="booking-details.html?id=${booking.booking_id}" class="btn-secondary">
                        <i class="fas fa-info-circle"></i> Chi tiết
                    </a>
                    ${showCancelButton ? `
                        <button class="btn-danger cancel-booking" data-id="${booking.booking_id}">
                            <i class="fas fa-times"></i> Hủy đặt chỗ
                        </button>
                    ` : isWithin3Hours && booking.payment_status !== 'cancelled' ? `
                        <button class="btn-danger disabled" disabled title="Không thể hủy vé trong vòng 3 giờ trước khi khởi hành">
                            <i class="fas fa-clock"></i> Không thể hủy
                        </button>
                    ` : ''}
                </div>
            `;
            
            bookingsList.appendChild(card);
        });
        
        // Add cancel event listeners
        document.querySelectorAll('.cancel-booking').forEach(btn => {
            btn.addEventListener('click', () => cancelBooking(btn.dataset.id));
        });
    };
    
    // Show no bookings message
    const showNoBookings = (message = null) => {
        if (message) {
            noBookings.querySelector('h3').textContent = message;
        } else {
            noBookings.querySelector('h3').textContent = 'Bạn chưa có đặt chỗ nào';
        }
        
        bookingsList.style.display = 'none';
        noBookings.style.display = 'block';
    };
    
    // Filter bookings
    const filterBookings = () => {
        const searchTerm = bookingSearch.value.toLowerCase();
        const statusValue = statusFilter.value;
        
        let filtered = allBookings;
        
        // Filter by status
        if (statusValue !== 'all') {
            filtered = filtered.filter(booking => booking.status.toLowerCase() === statusValue);
        }
        
        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(booking => {
                // Search by booking number
                if (booking.bookingNumber.toLowerCase().includes(searchTerm)) {
                    return true;
                }
                
                // Search by airport codes or names
                for (const flight of booking.flights) {
                    if (flight.departureCode.toLowerCase().includes(searchTerm) ||
                        flight.arrivalCode.toLowerCase().includes(searchTerm) ||
                        getAirportName(flight.departureCode).toLowerCase().includes(searchTerm) ||
                        getAirportName(flight.arrivalCode).toLowerCase().includes(searchTerm)) {
                        return true;
                    }
                }
                
                // Search by passenger names
                for (const passenger of booking.passengers) {
                    if (passenger.name && passenger.name.toLowerCase().includes(searchTerm)) {
                        return true;
                    }
                }
                
                return false;
            });
        }
        
        displayBookings(filtered);
    };
    
    // View booking details
    const viewBooking = (bookingId) => {
        // Store the booking ID in session storage
        sessionStorage.setItem('viewBookingId', bookingId);
        
        // Redirect to booking details page
        window.location.href = 'booking-details.html';
    };
    
    // Cancel booking
    const cancelBooking = async (bookingId) => {
        if (!confirm('Bạn có chắc chắn muốn hủy đặt chỗ này không?')) {
            return;
        }
        
        const sessionId = checkAuth();
        if (!sessionId) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/cancel`, {
                method: 'POST',
                headers: {
                    'Authorization': sessionId,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert('Hủy đặt chỗ thành công!');
                fetchUserBookings(); // Refresh bookings list
            } else {
                // Check for time restriction error
                if (data.error && data.error.includes('Flight departs in less than 3 hours')) {
                    // Format the remaining time nicely
                    let timeMessage = '';
                    if (data.hoursRemaining) {
                        const hours = Math.floor(data.hoursRemaining);
                        const minutes = Math.floor((data.hoursRemaining - hours) * 60);
                        timeMessage = ` Thời gian còn lại đến giờ bay: ${hours} giờ ${minutes} phút.`;
                    }
                    
                    alert('Không thể hủy đặt chỗ. Chuyến bay khởi hành trong vòng 3 giờ tới.' + timeMessage + 
                          '\nChỉ có thể hủy chuyến bay trước thời gian khởi hành ít nhất 3 giờ.');
                } else {
                    alert(data.error || 'Không thể hủy đặt chỗ. Vui lòng thử lại sau.');
                }
            }
        } catch (error) {
            console.error('Error cancelling booking:', error);
            alert('Đã xảy ra lỗi khi kết nối đến máy chủ.');
        }
    };
    
    // Initialize
    const initialize = () => {
        // Setup event listeners
        bookingSearch.addEventListener('input', filterBookings);
        statusFilter.addEventListener('change', filterBookings);
        
        // Fetch bookings
        fetchUserBookings();
    };
    
    // Start the application
    initialize();
}); 