document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const bookingLoading = document.getElementById('booking-loading');
    const bookingDetails = document.getElementById('booking-details');
    const bookingNumberEl = document.getElementById('booking-number');
    const bookingStatusEl = document.getElementById('booking-status');
    const flightsContainer = document.getElementById('flights-container');
    const passengersContainer = document.getElementById('passengers-container');
    const contactNameEl = document.getElementById('contact-name');
    const contactEmailEl = document.getElementById('contact-email');
    const contactPhoneEl = document.getElementById('contact-phone');
    const paymentMethodEl = document.getElementById('payment-method');
    const paymentStatusEl = document.getElementById('payment-status');
    const paymentDateEl = document.getElementById('payment-date');
    const priceDetailsEl = document.getElementById('price-details');
    const totalPriceEl = document.getElementById('total-price');
    const btnBack = document.getElementById('btn-back');
    const btnPrint = document.getElementById('btn-print');
    const btnCancel = document.getElementById('btn-cancel');
    
    // API base URL
    const API_BASE_URL = 'http://localhost:3000/api';
    
    // Current booking data
    let currentBooking = null;
    
    // Check authentication
    const checkAuth = () => {
        const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
        console.log("Session ID from storage:", sessionId ? "Found" : "Not found");
        
        // For testing purposes, if no session ID is found, use a default one
        if (!sessionId) {
            console.warn("No session ID found, using default test session ID");
            // Use a test session ID for development
            const testSessionId = '75ee91ae-2a7f-4d34-ba5a-e6971b8ee9f0';
            sessionStorage.setItem('sessionId', testSessionId);
            return testSessionId;
            
            // Comment out the redirect for testing
            // window.location.href = 'login.html?redirect=my-bookings.html';
            // return false;
        }
        return sessionId;
    };
    
    // Get booking ID from session storage or URL
    const getBookingId = () => {
        // First check if ID is in URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const idFromUrl = urlParams.get('id');
        
        // Then check session storage
        const idFromSession = sessionStorage.getItem('viewBookingId');
        
        // Use ID from URL or session storage
        const bookingId = idFromUrl || idFromSession;
        
        if (!bookingId) {
            alert('Không tìm thấy thông tin đặt chỗ.');
            window.location.href = 'my-bookings.html';
            return null;
        }
        
        return bookingId;
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
    
    // Format date without time
    const formatDateOnly = (dateString) => {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}/${month}/${year}`;
    };
    
    // Format time only
    const formatTimeOnly = (dateString) => {
        const date = new Date(dateString);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${hours}:${minutes}`;
    };
    
    // Format currency
    const formatCurrency = (price) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    };
    
    // Get status class
    const getStatusClass = (status) => {
        const statusLower = status.toLowerCase();
        if (statusLower === 'confirmed' || statusLower === 'paid') {
            return 'status-confirmed';
        } else if (statusLower === 'pending' || statusLower === 'unpaid') {
            return 'status-pending';
        } else if (statusLower === 'cancelled') {
            return 'status-cancelled';
        } else {
            return '';
        }
    };
    
    // Get status text
    const getStatusText = (status) => {
        const statusLower = status.toLowerCase();
        if (statusLower === 'confirmed' || statusLower === 'paid') {
            return 'Đã xác nhận';
        } else if (statusLower === 'pending' || statusLower === 'unpaid') {
            return 'Đang chờ';
        } else if (statusLower === 'cancelled') {
            return 'Đã hủy';
        } else {
            return status;
        }
    };
    
    // Get flight type text
    const getFlightTypeText = (type) => {
        switch (type) {
            case 'outbound':
                return 'Chuyến đi';
            case 'return':
                return 'Chuyến về';
            default:
                return type;
        }
    };
    
    // Calculate flight duration
    const calculateDuration = (departureTime, arrivalTime) => {
        const departure = new Date(departureTime);
        const arrival = new Date(arrivalTime);
        const durationMs = arrival - departure;
        
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        
        return `${hours}h ${minutes}m`;
    };
    
    // Get payment method name
    const getPaymentMethodName = (method) => {
        if (!method) return 'Không xác định';
        
        const methodLower = method.toLowerCase();
        if (methodLower === 'credit_card' || methodLower === 'credit card' || methodLower === 'creditcard') {
            return 'Thẻ tín dụng';
        } else if (methodLower === 'bank_transfer' || methodLower === 'bank transfer' || methodLower === 'banktransfer') {
            return 'Chuyển khoản ngân hàng';
        } else if (methodLower === 'momo') {
            return 'Ví MoMo';
        } else if (methodLower === 'zalopay') {
            return 'ZaloPay';
        } else if (methodLower === 'cash') {
            return 'Tiền mặt';
        } else {
            return method;
        }
    };
    
    // Get passenger type text
    const getPassengerTypeText = (type) => {
        if (!type) return 'Không xác định';
        
        const typeLower = type.toLowerCase();
        if (typeLower === 'adult' || typeLower === 'người lớn') {
            return 'Người lớn';
        } else if (typeLower === 'child' || typeLower === 'trẻ em') {
            return 'Trẻ em';
        } else if (typeLower === 'infant' || typeLower === 'em bé') {
            return 'Em bé';
        } else {
            return type;
        }
    };
    
    // Format gender
    const formatGender = (gender) => {
        if (!gender) return 'Không xác định';
        
        const genderLower = gender.toLowerCase();
        if (genderLower === 'male' || genderLower === 'nam') {
            return 'Nam';
        } else if (genderLower === 'female' || genderLower === 'nữ') {
            return 'Nữ';
        } else if (genderLower === 'other' || genderLower === 'khác') {
            return 'Khác';
        } else {
            return gender;
        }
    };
    
    // Create flight card
    const createFlightCard = (flight) => {
        const card = document.createElement('div');
        card.className = 'flight-card';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'flight-header';
        header.innerHTML = `
            <div class="flight-type">${getFlightTypeText(flight.type)}</div>
            <div class="flight-number">Chuyến bay: ${flight.flightNumber}</div>
        `;
        card.appendChild(header);
        
        // Create details
        const details = document.createElement('div');
        details.className = 'flight-details';
        
        // Add route
        const route = document.createElement('div');
        route.className = 'flight-route';
        route.innerHTML = `
            <div class="airport">
                <div class="airport-code">${flight.departureCode}</div>
                <div class="airport-name">${getAirportName(flight.departureCode)}</div>
            </div>
            <div class="flight-arrow">
                <i class="fas fa-plane"></i>
            </div>
            <div class="airport">
                <div class="airport-code">${flight.arrivalCode}</div>
                <div class="airport-name">${getAirportName(flight.arrivalCode)}</div>
            </div>
        `;
        details.appendChild(route);
        
        // Add times
        const times = document.createElement('div');
        times.className = 'flight-times';
        times.innerHTML = `
            <div class="departure-time">
                <div class="time">${formatTimeOnly(flight.departureTime)}</div>
                <div class="date">${formatDateOnly(flight.departureTime)}</div>
            </div>
            <div class="flight-duration">
                <div class="duration">${calculateDuration(flight.departureTime, flight.arrivalTime)}</div>
                <div class="line">―――――――――</div>
            </div>
            <div class="arrival-time">
                <div class="time">${formatTimeOnly(flight.arrivalTime)}</div>
                <div class="date">${formatDateOnly(flight.arrivalTime)}</div>
            </div>
        `;
        details.appendChild(times);
        
        // Add additional info
        const info = document.createElement('div');
        info.className = 'flight-additional-info';
        info.innerHTML = `
            <div class="flight-info-row">
                <div class="flight-info-label">Hãng hàng không:</div>
                <div class="flight-info-value">${flight.airline}</div>
            </div>
            <div class="flight-info-row">
                <div class="flight-info-label">Hạng ghế:</div>
                <div class="flight-info-value">${flight.seatClass}</div>
            </div>
        `;
        details.appendChild(info);
        
        card.appendChild(details);
        
        return card;
    };
    
    // Create passenger card
    const createPassengerCard = (passenger, index) => {
        const card = document.createElement('div');
        card.className = 'passenger-card';
        
        // Create passenger name
        const nameElement = document.createElement('div');
        nameElement.className = 'passenger-name';
        
        // Handle both formats (firstName/lastName or name)
        let displayName;
        if (passenger.name) {
            displayName = passenger.name;
        } else if (passenger.firstName && passenger.lastName) {
            displayName = `${passenger.firstName} ${passenger.lastName}`;
        } else {
            displayName = "Unknown";
        }
        
        nameElement.textContent = `${index + 1}. ${displayName} (${getPassengerTypeText(passenger.type)})`;
        card.appendChild(nameElement);
        
        // Create passenger info
        const info = document.createElement('div');
        info.className = 'passenger-info';
        
        // Add gender if available
        if (passenger.gender) {
            const gender = document.createElement('div');
            gender.className = 'passenger-info-item';
            gender.innerHTML = `
                <div class="passenger-info-label">Giới tính</div>
                <div class="passenger-info-value">${formatGender(passenger.gender)}</div>
            `;
            info.appendChild(gender);
        }
        
        // Add date of birth if available
        if (passenger.dateOfBirth) {
            const dob = document.createElement('div');
            dob.className = 'passenger-info-item';
            dob.innerHTML = `
                <div class="passenger-info-label">Ngày sinh</div>
                <div class="passenger-info-value">${formatDateOnly(passenger.dateOfBirth)}</div>
            `;
            info.appendChild(dob);
        }
        
        // Add nationality
        if (passenger.nationality) {
            const nationality = document.createElement('div');
            nationality.className = 'passenger-info-item';
            nationality.innerHTML = `
                <div class="passenger-info-label">Quốc tịch</div>
                <div class="passenger-info-value">${passenger.nationality}</div>
            `;
            info.appendChild(nationality);
        }
        
        // Add ID/Passport
        if (passenger.idNumber || passenger.passportNumber) {
            const id = document.createElement('div');
            id.className = 'passenger-info-item';
            id.innerHTML = `
                <div class="passenger-info-label">CMND/CCCD/Hộ chiếu</div>
                <div class="passenger-info-value">${passenger.idNumber || passenger.passportNumber || ''}</div>
            `;
            info.appendChild(id);
        }
        
        card.appendChild(info);
        
        return card;
    };
    
    // Create price details
    const createPriceDetails = (booking) => {
        const container = document.createElement('div');
        
        // Add base price
        const basePrice = document.createElement('div');
        basePrice.className = 'price-row';
        basePrice.innerHTML = `
            <div class="price-label">Giá vé cơ bản:</div>
            <div class="price-value">${formatCurrency(booking.basePrice)}</div>
        `;
        container.appendChild(basePrice);
        
        // Add taxes and fees
        const taxes = document.createElement('div');
        taxes.className = 'price-row';
        taxes.innerHTML = `
            <div class="price-label">Thuế và phí:</div>
            <div class="price-value">${formatCurrency(booking.taxesAndFees)}</div>
        `;
        container.appendChild(taxes);
        
        // Add discount if any
        if (booking.discount && booking.discount > 0) {
            const discount = document.createElement('div');
            discount.className = 'price-row';
            discount.innerHTML = `
                <div class="price-label">Giảm giá:</div>
                <div class="price-value">-${formatCurrency(booking.discount)}</div>
            `;
            container.appendChild(discount);
        }
        
        return container;
    };
    
    // Fetch booking details from API
    const fetchBookingDetails = async () => {
        const sessionId = checkAuth();
        const bookingId = getBookingId();
        
        if (!sessionId || !bookingId) return;
        
        try {
            bookingLoading.style.display = 'block';
            bookingDetails.style.display = 'none';
            
            console.log("Fetching booking details for ID:", bookingId);
            console.log("Using session ID:", sessionId);
            
            const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
                method: 'GET',
                headers: {
                    'Authorization': sessionId,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log("Response status:", response.status);
            const data = await response.json();
            console.log("API Response:", data);
            
            if (response.ok) {
                // Process the booking data from the actual API response format
                const booking = data.booking;
                const departureFlight = data.departureFlight;
                const returnFlight = data.returnFlight;
                const passengers = data.passengers || [];
                const paymentInfo = data.paymentInfo || {};
                
                if (!booking) {
                    console.error("No booking data in response");
                    throw new Error("Invalid response format - missing booking data");
                }
                
                currentBooking = {
                    id: booking.booking_id,
                    bookingNumber: booking.booking_id,
                    status: booking.payment_status,
                    bookingDate: booking.booking_time,
                    totalPrice: booking.total_amount,
                    basePrice: booking.total_amount * 0.8, // Estimate if not provided
                    taxesAndFees: booking.total_amount * 0.2, // Estimate if not provided
                    discount: 0, // Default if not provided
                    flights: [],
                    passengers: [],
                    contactInfo: {
                        name: booking.contact_name || 'N/A',
                        email: booking.email || 'N/A',
                        phone: booking.phone || 'N/A'
                    },
                    payment: {
                        method: paymentInfo.method || 'unknown',
                        status: booking.payment_status === 'paid' ? 'completed' : booking.payment_status,
                        date: paymentInfo.payment_date || booking.booking_time
                    }
                };
                
                // Add departure flight
                if (departureFlight) {
                    currentBooking.flights.push({
                        type: 'outbound',
                        flightNumber: `${departureFlight.airlineCode || ''}${departureFlight.flight_number}`,
                        airline: departureFlight.airline,
                        departureCode: departureFlight.departure_airport,
                        arrivalCode: departureFlight.arrival_airport,
                        departureTime: departureFlight.departure_time,
                        arrivalTime: departureFlight.arrival_time,
                        seatClass: booking.travel_class
                    });
                } else {
                    console.warn("No departure flight data");
                }
                
                // Add return flight if exists
                if (returnFlight) {
                    currentBooking.flights.push({
                        type: 'return',
                        flightNumber: `${returnFlight.airlineCode || ''}${returnFlight.flight_number}`,
                        airline: returnFlight.airline,
                        departureCode: returnFlight.departure_airport,
                        arrivalCode: returnFlight.arrival_airport,
                        departureTime: returnFlight.departure_time,
                        arrivalTime: returnFlight.arrival_time,
                        seatClass: booking.travel_class
                    });
                }
                
                // Add passengers
                if (passengers && Array.isArray(passengers)) {
                    currentBooking.passengers = passengers.map(passenger => ({
                        name: passenger.full_name || '',
                        type: passenger.passenger_type ? passenger.passenger_type.toLowerCase() : 'adult',
                        gender: passenger.gender || 'unknown',
                        dateOfBirth: passenger.dob,
                        nationality: passenger.nationality || '',
                        passportNumber: passenger.passport_number || ''
                    }));
                } else {
                    console.warn("No passengers data or not an array");
                }
                
                console.log("Processed booking data:", currentBooking);
                displayBookingDetails(currentBooking);
            } else {
                console.error('Error fetching booking details:', data.error);
                alert('Không thể tải thông tin đặt chỗ. Vui lòng thử lại sau.');
                window.location.href = 'my-bookings.html';
            }
        } catch (error) {
            console.error('Error fetching booking details:', error);
            alert('Đã xảy ra lỗi khi kết nối đến máy chủ.');
            window.location.href = 'my-bookings.html';
        } finally {
            bookingLoading.style.display = 'none';
        }
    };
    
    // Display booking details
    const displayBookingDetails = (booking) => {
        // Set booking number and status
        bookingNumberEl.textContent = booking.bookingNumber;
        bookingStatusEl.textContent = getStatusText(booking.status);
        bookingStatusEl.className = `booking-status ${getStatusClass(booking.status)}`;
        
        // Display flights
        flightsContainer.innerHTML = '';
        booking.flights.forEach(flight => {
            const card = createFlightCard(flight);
            flightsContainer.appendChild(card);
        });
        
        // Display passengers
        passengersContainer.innerHTML = '';
        booking.passengers.forEach((passenger, index) => {
            const card = createPassengerCard(passenger, index);
            passengersContainer.appendChild(card);
        });
        
        // Display contact info
        contactNameEl.textContent = booking.contactInfo.name;
        contactEmailEl.textContent = booking.contactInfo.email;
        contactPhoneEl.textContent = booking.contactInfo.phone;
        
        // Display payment info
        paymentMethodEl.textContent = getPaymentMethodName(booking.payment.method);
        
        // Set payment status based on booking status
        let paymentStatusText = 'Chưa thanh toán';
        if (booking.status.toLowerCase() === 'paid' || booking.payment.status === 'completed') {
            paymentStatusText = 'Đã thanh toán';
        } else if (booking.status.toLowerCase() === 'cancelled') {
            paymentStatusText = 'Đã hủy';
        }
        paymentStatusEl.textContent = paymentStatusText;
        
        paymentDateEl.textContent = booking.payment.date ? formatDate(booking.payment.date) : 'N/A';
        
        // Display price details
        priceDetailsEl.innerHTML = '';
        priceDetailsEl.appendChild(createPriceDetails(booking));
        totalPriceEl.textContent = formatCurrency(booking.totalPrice);
        
        // Show cancel button if booking is not cancelled
        if (booking.status.toLowerCase() !== 'cancelled') {
            btnCancel.style.display = 'inline-block';
        } else {
            btnCancel.style.display = 'none';
        }
        
        // Show booking details
        bookingDetails.style.display = 'block';
    };
    
    // Cancel booking
    const cancelBooking = async () => {
        if (!currentBooking) return;
        
        if (!confirm('Bạn có chắc chắn muốn hủy đặt chỗ này không?')) {
            return;
        }
        
        const sessionId = checkAuth();
        if (!sessionId) return;
        
        try {
            bookingLoading.style.display = 'block';
            bookingDetails.style.display = 'none';
            
            console.log("Cancelling booking:", currentBooking.id);
            
            const response = await fetch(`${API_BASE_URL}/bookings/${currentBooking.id}/cancel`, {
                method: 'POST',
                headers: {
                    'Authorization': sessionId,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert('Hủy đặt chỗ thành công!');
                fetchBookingDetails(); // Refresh booking details
            } else {
                console.error('Error cancelling booking:', data);
                alert(data.error || 'Không thể hủy đặt chỗ. Vui lòng thử lại sau.');
            }
        } catch (error) {
            console.error('Error cancelling booking:', error);
            alert('Đã xảy ra lỗi khi kết nối đến máy chủ.');
        } finally {
            bookingLoading.style.display = 'none';
            bookingDetails.style.display = 'block';
        }
    };
    
    // Print ticket
    const printTicket = () => {
        window.print();
    };
    
    // Initialize
    const initialize = () => {
        // Setup event listeners
        btnBack.addEventListener('click', () => {
            window.location.href = 'my-bookings.html';
        });
        
        btnPrint.addEventListener('click', printTicket);
        btnCancel.addEventListener('click', cancelBooking);
        
        // Fetch booking details
        fetchBookingDetails();
    };
    
    // Start the application
    initialize();
}); 