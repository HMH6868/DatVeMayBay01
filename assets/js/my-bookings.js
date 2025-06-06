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
            case 'paid':
                return 'status-paid';
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
            case 'paid':
                return 'Đã thanh toán';
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
        bookingsList.innerHTML = '';
        
        if (bookings.length === 0) {
            showNoBookings();
            return;
        }
        
        bookings.forEach(booking => {
            const card = createBookingCard(booking);
            bookingsList.appendChild(card);
        });
        
        bookingsList.style.display = 'block';
        noBookings.style.display = 'none';
        
        // Add event listeners to buttons
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', () => viewBooking(btn.dataset.bookingId));
        });
        
        document.querySelectorAll('.btn-cancel').forEach(btn => {
            btn.addEventListener('click', () => cancelBooking(btn.dataset.bookingId));
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
            // Show a loading indicator or disable the cancel button
            const cancelBtn = document.querySelector(`.btn-cancel[data-booking-id="${bookingId}"]`);
            if (cancelBtn) {
                cancelBtn.disabled = true;
                cancelBtn.textContent = 'Đang hủy...';
            }
            
            // Set a timeout for the fetch request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/cancel`, {
                method: 'POST',
                headers: {
                    'Authorization': sessionId,
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            const data = await response.json();
            
            if (response.ok) {
                alert('Hủy đặt chỗ thành công!');
                fetchUserBookings(); // Refresh bookings list
            } else {
                console.error('Error response:', data);
                
                if (data.error && data.error.includes('3 giờ')) {
                    // Special handling for the 3-hour restriction
                    let errorMessage = 'Không thể hủy chuyến bay. Chuyến bay chỉ có thể được hủy trước giờ khởi hành ít nhất 3 giờ.';
                    
                    if (data.hoursRemaining !== undefined) {
                        const hoursLeft = Math.max(0, parseFloat(data.hoursRemaining).toFixed(1));
                        errorMessage += `\n\nThời gian còn lại đến giờ khởi hành: ${hoursLeft} giờ.`;
                    }
                    
                    alert(errorMessage);
                } else {
                    alert(data.error || 'Không thể hủy đặt chỗ. Vui lòng thử lại sau.');
                }
            }
        } catch (error) {
            console.error('Error cancelling booking:', error);
            
            if (error.name === 'AbortError') {
                alert('Yêu cầu hủy đặt chỗ đã hết thời gian chờ. Vui lòng thử lại sau.');
            } else {
                alert('Đã xảy ra lỗi khi hủy đặt chỗ: ' + (error.message || 'Lỗi kết nối'));
            }
        } finally {
            // Re-enable the cancel button
            const cancelBtn = document.querySelector(`.btn-cancel[data-booking-id="${bookingId}"]`);
            if (cancelBtn) {
                cancelBtn.disabled = false;
                cancelBtn.textContent = 'Hủy đặt chỗ';
            }
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