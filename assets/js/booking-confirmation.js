document.addEventListener('DOMContentLoaded', async function() {
    console.log("Booking Confirmation page loaded");

    const API_BASE_URL = 'http://localhost:3000/api';

    // Get booking ID from URL or sessionStorage
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('booking_id') || sessionStorage.getItem('bookingId');

    // Check if user is logged in and display their information
    const loggedInUser = getLoggedInUserInfo();
    if (loggedInUser) {
        console.log("User is logged in:", loggedInUser);
        const contactNameElement = document.getElementById('contact-name');
        const contactEmailElement = document.getElementById('contact-email');
        const contactPhoneElement = document.getElementById('contact-phone');
        
        if (contactNameElement) contactNameElement.textContent = loggedInUser.fullname;
        if (contactEmailElement) contactEmailElement.textContent = loggedInUser.email;
        if (contactPhoneElement) contactPhoneElement.textContent = loggedInUser.phone || 'Chưa cung cấp';
    }

    // If no booking ID, try to use session data for new booking process
    if (!bookingId) {
        console.log("No booking ID found. Checking for session data...");
        const selectedFlightData = JSON.parse(sessionStorage.getItem('selectedFlight'));
        const customerInfo = JSON.parse(sessionStorage.getItem('customerInfo'));
        const passengerData = JSON.parse(sessionStorage.getItem('passengerData'));
        
        if (selectedFlightData && customerInfo) {
            console.log("Session data found. Using for booking confirmation.");
            displayBookingFromSessionData(selectedFlightData, customerInfo, passengerData);
            return;
        } else {
            console.error("No booking ID or session data found.");
            // Redirect to an error page or home page
            alert("Không tìm thấy thông tin đặt vé.");
            window.location.href = '../../index.html';
            return;
        }
    }

    try {
        // Fetch booking details from the server
        const bookingResponse = await fetch(`${API_BASE_URL}/bookings/${bookingId}`);

        if (!bookingResponse.ok) {
            const errorData = await bookingResponse.json();
            throw new Error(`Error fetching booking details: ${errorData.error || bookingResponse.statusText}`);
        }

        const bookingData = await bookingResponse.json();
        console.log("Fetched booking data:", bookingData);

        // --- Populate Contact Information ---
        const contactNameElement = document.getElementById('contact-name');
        const contactEmailElement = document.getElementById('contact-email');
        const contactPhoneElement = document.getElementById('contact-phone');

        // Only populate contact info from booking if user is not logged in
        if (!loggedInUser) {
            if (bookingData.booking.user_id) {
                // If booking is linked to a user, fetch user profile
                const userSessionId = localStorage.getItem('userSessionId') || sessionStorage.getItem('sessionId'); // Check both storage locations

                if (userSessionId) {
                    try {
                        const userProfileResponse = await fetch(`${API_BASE_URL}/users/profile`, {
                            method: 'GET',
                            headers: {
                                'Authorization': userSessionId,
                                'Content-Type': 'application/json'
                            }
                        });

                        if (userProfileResponse.ok) {
                            const userData = await userProfileResponse.json();
                            console.log("Fetched user profile:", userData.user);
                            // Use user profile data for contact info
                            if (contactNameElement) contactNameElement.textContent = userData.user.fullname;
                            if (contactEmailElement) contactEmailElement.textContent = userData.user.email;
                            if (contactPhoneElement) contactPhoneElement.textContent = userData.user.phone;
                        } else {
                            console.warn("Failed to fetch user profile for booking owner. Using booking contact info.");
                            // Fallback to booking contact info if fetching profile fails
                            if (contactNameElement) contactNameElement.textContent = bookingData.booking.contact_name;
                            if (contactEmailElement) contactEmailElement.textContent = bookingData.booking.email;
                            if (contactPhoneElement) contactPhoneElement.textContent = bookingData.booking.phone;
                        }
                    } catch (error) {
                        console.error("Error fetching user profile:", error);
                        console.warn("Using booking contact info as fallback.");
                        // Fallback to booking contact info on error
                        if (contactNameElement) contactNameElement.textContent = bookingData.booking.contact_name;
                        if (contactEmailElement) contactEmailElement.textContent = bookingData.booking.email;
                        if (contactPhoneElement) contactPhoneElement.textContent = bookingData.booking.phone;
                    }
                } else {
                     console.warn("Booking linked to user, but no session found. Using booking contact info.");
                     // Fallback to booking contact info if no session
                     if (contactNameElement) contactNameElement.textContent = bookingData.booking.contact_name;
                     if (contactEmailElement) contactEmailElement.textContent = bookingData.booking.email;
                     if (contactPhoneElement) contactPhoneElement.textContent = bookingData.booking.phone;
                }
            } else {
                // If booking is not linked to a user (guest booking), use contact info from booking data
                console.log("Booking is not linked to a user. Using booking contact info.");
                if (contactNameElement) contactNameElement.textContent = bookingData.booking.contact_name;
                if (contactEmailElement) contactEmailElement.textContent = bookingData.booking.email;
                if (contactPhoneElement) contactPhoneElement.textContent = bookingData.booking.phone;
            }
        }

        // --- Populate Flight Details ---
        populateFlightDetails(bookingData);

        // --- Populate Passenger Information ---
        populatePassengerDetails(bookingData.passengers);

        // --- Populate Price Summary ---
        populatePriceSummary(bookingData);

        // --- Setup Payment Button ---
        const confirmBookingButton = document.getElementById('confirm-booking');
        if (confirmBookingButton) {
            confirmBookingButton.addEventListener('click', function() {
                // Redirect to payment page with booking ID
                window.location.href = `payment.html?booking_id=${bookingId}`;
            });
        }

    } catch (error) {
        console.error("Error loading booking confirmation:", error);
        alert("Không thể tải thông tin đặt vé: " + error.message);
        // Optionally redirect to an error page or home
        // window.location.href = '../../index.html';
    }
});

// Function to display booking information from session data
function displayBookingFromSessionData(selectedFlight, customerInfo, passengerData) {
    console.log("Displaying booking from session data:", { selectedFlight, customerInfo, passengerData });
    
    // Populate contact information
    const contactNameElement = document.getElementById('contact-name');
    const contactEmailElement = document.getElementById('contact-email');
    const contactPhoneElement = document.getElementById('contact-phone');
    
    // Check if user is logged in and use their information
    const loggedInUser = getLoggedInUserInfo();
    if (loggedInUser) {
        // Use logged-in user's information for contact details
        if (contactNameElement) contactNameElement.textContent = loggedInUser.fullname;
        if (contactEmailElement) contactEmailElement.textContent = loggedInUser.email;
        if (contactPhoneElement) contactPhoneElement.textContent = loggedInUser.phone || 'Chưa cung cấp';
        
        // Update customerInfo with logged-in user's data for API call
        customerInfo.fullName = loggedInUser.fullname;
        customerInfo.email = loggedInUser.email;
        customerInfo.phone = loggedInUser.phone || '';
    } else {
        // Use customer info from form if no logged-in user
        if (contactNameElement) contactNameElement.textContent = customerInfo.fullName || 'Không có thông tin';
        if (contactEmailElement) contactEmailElement.textContent = customerInfo.email || 'Không có thông tin';
        if (contactPhoneElement) contactPhoneElement.textContent = customerInfo.phone || 'Không có thông tin';
    }
    
    // Create a mock booking data structure to use with existing functions
    const bookingData = {
        booking: {
            travel_class: customerInfo.seatClass || 'ECONOMY',
            is_round_trip: selectedFlight.returnFlight ? 1 : 0,
            passengers_info: JSON.stringify({
                numAdults: parseInt(selectedFlight.adults) || 1,
                numChildren: parseInt(selectedFlight.children) || 0,
                numInfants: parseInt(selectedFlight.infants) || 0
            }),
            total_amount: calculateTotalAmount(selectedFlight, customerInfo, passengerData)
        },
        departureFlight: {
            airline: selectedFlight.airline,
            airline_code: selectedFlight.airlineCode || selectedFlight.airline_code,
            flight_number: selectedFlight.flight_number || selectedFlight.id.replace(/[^0-9]/g, ''),
            departure: selectedFlight.departure,
            departure_airport: getAirportName(selectedFlight.departure),
            destination: selectedFlight.destination,
            arrival_airport: getAirportName(selectedFlight.destination),
            departureTime: selectedFlight.departureTime,
            departure_time: selectedFlight.departDate + 'T' + selectedFlight.departureTime,
            arrivalTime: selectedFlight.arrivalTime,
            arrival_time: selectedFlight.departDate + 'T' + selectedFlight.arrivalTime,
            duration: selectedFlight.duration,
            price_economy: selectedFlight.price
        },
        passengers: createPassengersFromSessionData(passengerData)
    };
    
    // Add return flight if it exists
    if (selectedFlight.returnFlight) {
        bookingData.returnFlight = {
            airline: selectedFlight.returnFlight.airline,
            airline_code: selectedFlight.returnFlight.airlineCode || selectedFlight.returnFlight.airline_code,
            flight_number: selectedFlight.returnFlight.flight_number || selectedFlight.returnFlight.id.replace(/[^0-9]/g, ''),
            departure: selectedFlight.returnFlight.departure,
            departure_airport: getAirportName(selectedFlight.returnFlight.departure),
            destination: selectedFlight.returnFlight.destination,
            arrival_airport: getAirportName(selectedFlight.returnFlight.destination),
            departureTime: selectedFlight.returnFlight.departureTime,
            departure_time: selectedFlight.returnDate + 'T' + selectedFlight.returnFlight.departureTime,
            arrivalTime: selectedFlight.returnFlight.arrivalTime,
            arrival_time: selectedFlight.returnDate + 'T' + selectedFlight.returnFlight.arrivalTime,
            duration: selectedFlight.returnFlight.duration,
            price_economy: selectedFlight.returnFlight.price
        };
    }
    
    // Populate flight details
    populateFlightDetails(bookingData);
    
    // Populate passenger information
    populatePassengerDetails(bookingData.passengers);
    
    // Populate price summary
    populatePriceSummary(bookingData);
    
    // Setup payment button
    const confirmBookingButton = document.getElementById('confirm-booking');
    if (confirmBookingButton) {
        confirmBookingButton.addEventListener('click', async function() {
            // Create booking in the API
            try {
                const response = await saveBookingToAPI(selectedFlight, customerInfo, passengerData);
                if (response && response.bookingId) {
                    sessionStorage.setItem('bookingId', response.bookingId);
                    // Redirect to payment page
                    window.location.href = `payment.html?booking_id=${response.bookingId}`;
                } else {
                    throw new Error('Không nhận được mã đặt vé từ hệ thống');
                }
            } catch (error) {
                console.error('Error creating booking:', error);
                alert('Đã có lỗi xảy ra khi tạo đơn đặt vé: ' + error.message);
            }
        });
    }
}

// Helper function to create passengers array from session data
function createPassengersFromSessionData(passengerData) {
    if (!passengerData || !Array.isArray(passengerData)) {
        return [];
    }
    
    return passengerData.map((passenger, index) => {
        return {
            detail_id: index + 1,
            full_name: passenger.name,
            gender: passenger.gender,
            dob: passenger.dob,
            passport_number: passenger.idNumber,
            passenger_type: passenger.type.toUpperCase(),
            luggage_weight: passenger.luggage ? 23 : 0,
            insurance: passenger.insurance ? 1 : 0,
            meal: passenger.meal ? 1 : 0
        };
    });
}

// Helper function to calculate total amount
function calculateTotalAmount(selectedFlight, customerInfo, passengerData) {
    let total = 0;
    const basePrice = selectedFlight.price || 0;
    
    // Add price for each passenger
    if (passengerData && Array.isArray(passengerData)) {
        passengerData.forEach(passenger => {
            const type = passenger.type.toUpperCase();
            const multiplier = getPriceMultiplierForPassengerType(type);
            total += basePrice * multiplier;
            
            // Add service costs
            if (passenger.luggage) total += 200000; // Example cost for luggage
            if (passenger.insurance) total += 100000; // Example cost for insurance
            if (passenger.meal) total += 50000; // Example cost for meal
        });
    } else {
        // Fallback calculation if no passenger data
        const adults = parseInt(selectedFlight.adults) || 1;
        const children = parseInt(selectedFlight.children) || 0;
        const infants = parseInt(selectedFlight.infants) || 0;
        
        total += basePrice * adults;
        total += basePrice * 0.75 * children;
        total += basePrice * 0.1 * infants;
    }
    
    // Add return flight price if applicable
    if (selectedFlight.returnFlight) {
        const returnBasePrice = selectedFlight.returnFlight.price || 0;
        
        if (passengerData && Array.isArray(passengerData)) {
            passengerData.forEach(passenger => {
                const type = passenger.type.toUpperCase();
                const multiplier = getPriceMultiplierForPassengerType(type);
                total += returnBasePrice * multiplier;
            });
        } else {
            const adults = parseInt(selectedFlight.adults) || 1;
            const children = parseInt(selectedFlight.children) || 0;
            const infants = parseInt(selectedFlight.infants) || 0;
            
            total += returnBasePrice * adults;
            total += returnBasePrice * 0.75 * children;
            total += returnBasePrice * 0.1 * infants;
        }
    }
    
    return total;
}

// Function to get airport name from code
function getAirportName(code) {
    const airports = {
        'HAN': 'Hà Nội',
        'SGN': 'Hồ Chí Minh',
        'DAD': 'Đà Nẵng',
        'CXR': 'Nha Trang',
        'PQC': 'Phú Quốc',
        'HUI': 'Huế',
        'VCA': 'Cần Thơ',
        'VCS': 'Côn Đảo',
        'VKG': 'Rạch Giá',
        'BMV': 'Buôn Ma Thuột',
        'UIH': 'Quy Nhơn',
        'THD': 'Thanh Hóa',
        'VII': 'Vinh',
        'DLI': 'Đà Lạt',
        'PXU': 'Pleiku',
        'TBB': 'Tuy Hòa',
        'VDH': 'Đồng Hới',
        'VCL': 'Chu Lai',
        'HPH': 'Hải Phòng',
        'DIN': 'Điện Biên',
        'CAH': 'Cà Mau'
    };
    
    return airports[code] || code;
}

// Function to save booking to API
async function saveBookingToAPI(selectedFlight, customerInfo, passengerData) {
    const API_BASE_URL = 'http://localhost:3000/api';
    
    // Get user ID if logged in
    let userId = null;
    const loggedInUser = getLoggedInUserInfo();
    
    if (loggedInUser) {
        userId = loggedInUser.user_id;
        
        // Make sure we're using the logged-in user's information
        customerInfo.fullName = loggedInUser.fullname;
        customerInfo.email = loggedInUser.email;
        if (loggedInUser.phone) {
            customerInfo.phone = loggedInUser.phone;
        }
    }
    
    // Prepare passenger data
    const passengers = passengerData.map(p => ({
        fullName: p.name,
        gender: p.gender,
        dob: p.dob,
        idNumber: p.idNumber,
        type: p.type,
        passengerType: p.type.toUpperCase(),
        luggage: p.luggage,
        insurance: p.insurance,
        meal: p.meal
    }));
    
    // Prepare booking data
    const bookingData = {
        departureFlightId: selectedFlight.flight_id || selectedFlight.id,
        returnFlightId: selectedFlight.returnFlight ? (selectedFlight.returnFlight.flight_id || selectedFlight.returnFlight.id) : null,
        isRoundTrip: !!selectedFlight.returnFlight,
        customerInfo: {
            fullName: customerInfo.fullName,
            email: customerInfo.email,
            phone: customerInfo.phone,
            seatClass: customerInfo.seatClass || 'ECONOMY'
        },
        passengers: passengers,
        selectedServices: {
            luggage: passengers.some(p => p.luggage),
            insurance: passengers.some(p => p.insurance),
            meal: passengers.some(p => p.meal)
        },
        totalAmount: calculateTotalAmount(selectedFlight, customerInfo, passengerData),
        passengerCounts: {
            numAdults: passengers.filter(p => p.type.toUpperCase() === 'ADULT').length,
            numChildren: passengers.filter(p => p.type.toUpperCase() === 'CHILD').length,
            numInfants: passengers.filter(p => p.type.toUpperCase() === 'INFANT').length
        },
        userId: userId
    };
    
    console.log("Saving booking to API:", bookingData);
    
    // Send booking data to API
    const response = await fetch(`${API_BASE_URL}/bookings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(bookingData)
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create booking');
    }
    
    const result = await response.json();
    console.log("Booking created:", result);
    
    return {
        bookingId: result.bookingId,
        redirectUrl: result.redirectUrl,
        totalAmount: result.totalAmount
    };
}

// Function to get logged in user info from session storage
function getLoggedInUserInfo() {
    try {
        const userJson = sessionStorage.getItem('user');
        if (userJson) {
            return JSON.parse(userJson);
        }
        return null;
    } catch (error) {
        console.error("Error parsing user data from session storage:", error);
        return null;
    }
}

function populateFlightDetails(bookingData) {
    const departureFlight = bookingData.departureFlight;
    const returnFlight = bookingData.returnFlight;
    const booking = bookingData.booking;

    if (!departureFlight) {
        console.error("Departure flight data is missing.");
        return;
    }

    // Flight Type and Class
    const flightClassElement = document.getElementById('flight-class');
    const flightTypeElement = document.getElementById('flight-type');

    if (flightClassElement) flightClassElement.textContent = booking.travel_class || 'Phổ thông';
    if (flightTypeElement) flightTypeElement.textContent = booking.is_round_trip ? 'Khứ hồi' : 'Một chiều';

    // Departure Flight Details
    populateSingleFlightDetails(departureFlight, 'departure-flight');

    // Return Flight Details (if round trip)
    const returnFlightInfoElement = document.getElementById('return-flight-info');
    if (booking.is_round_trip && returnFlight) {
        if (returnFlightInfoElement) returnFlightInfoElement.style.display = 'block';
        populateSingleFlightDetails(returnFlight, 'return-flight-info');
    } else {
        if (returnFlightInfoElement) returnFlightInfoElement.style.display = 'none';
    }

    // Passenger Counts
    const passengerCounts = JSON.parse(booking.passengers_info || '{}');
    document.getElementById('adult-count').textContent = passengerCounts.numAdults || 0;
    const childRow = document.getElementById('child-row');
    const infantRow = document.getElementById('infant-row');

    if (passengerCounts.numChildren > 0) {
        if (childRow) childRow.style.display = 'flex';
        document.getElementById('child-count').textContent = passengerCounts.numChildren;
    } else {
        if (childRow) childRow.style.display = 'none';
    }

    if (passengerCounts.numInfants > 0) {
        if (infantRow) infantRow.style.display = 'flex';
        document.getElementById('infant-count').textContent = passengerCounts.numInfants;
    } else {
        if (infantRow) infantRow.style.display = 'none';
    }
}

function populateSingleFlightDetails(flight, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Clear existing content if needed (for return flight)
    if (containerId === 'return-flight-info') {
         container.innerHTML = `
            <div class="return-flight-label">
                <i class="fas fa-plane-arrival"></i> Chuyến về
            </div>
            <div class="airline-info">
                <div class="airline-logo">
                    <i class="fas fa-plane" style="color: #0066cc;"></i>
                </div>
                <div>
                    <div class="airline-name" id="${containerId}-airline-name"></div>
                    <div class="airline-flight" id="${containerId}-flight-number"></div>
                </div>
            </div>

            <div class="flight-route">
                <div class="flight-endpoint">
                    <div class="airport-code" id="${containerId}-departure-code"></div>
                    <div class="airport-name" id="${containerId}-departure-name"></div>
                </div>
                <div class="route-divider">
                    <div class="route-line"></div>
                    <div class="route-plane">
                        <i class="fas fa-plane" style="font-size: 12px;"></i>
                    </div>
                </div>
                <div class="flight-endpoint">
                    <div class="airport-code" id="${containerId}-arrival-code"></div>
                    <div class="airport-name" id="${containerId}-arrival-name"></div>
                </div>
            </div>

            <div class="flight-times">
                <div class="flight-time-item">
                    <div class="flight-time" id="${containerId}-departure-time"></div>
                    <div class="flight-date" id="${containerId}-departure-date"></div>
                </div>
                <div class="flight-time-item">
                    <div class="flight-detail-label">Thời gian bay</div>
                    <div id="${containerId}-flight-duration"></div>
                </div>
                <div class="flight-time-item">
                    <div class="flight-time" id="${containerId}-arrival-time"></div>
                    <div class="flight-date" id="${containerId}-arrival-date"></div>
                </div>
            </div>
         `;
    }


    document.getElementById(`${containerId}-airline-name`).textContent = flight.airline || '';
    document.getElementById(`${containerId}-flight-number`).textContent = `${flight.airline_code || ''}${flight.flight_number || ''}`;
    document.getElementById(`${containerId}-departure-code`).textContent = flight.departure || '';
    document.getElementById(`${containerId}-departure-name`).textContent = flight.departure_airport || ''; // Assuming full name is in departure_airport
    document.getElementById(`${containerId}-arrival-code`).textContent = flight.destination || '';
    document.getElementById(`${containerId}-arrival-name`).textContent = flight.arrival_airport || ''; // Assuming full name is in arrival_airport
    document.getElementById(`${containerId}-departure-time`).textContent = flight.departureTime || '';
    document.getElementById(`${containerId}-departure-date`).textContent = formatDate(flight.departure_time);
    document.getElementById(`${containerId}-arrival-time`).textContent = flight.arrivalTime || '';
    document.getElementById(`${containerId}-arrival-date`).textContent = formatDate(flight.arrival_time);
    document.getElementById(`${containerId}-flight-duration`).textContent = flight.duration || '';
}


function populatePassengerDetails(passengers) {
    const passengerDetailsContent = document.getElementById('passenger-details-content');
    if (!passengerDetailsContent) return;

    passengerDetailsContent.innerHTML = ''; // Clear existing content

    if (!passengers || passengers.length === 0) {
        passengerDetailsContent.innerHTML = '<p>Không có thông tin hành khách.</p>';
        return;
    }

    passengers.forEach(passenger => {
        const passengerDiv = document.createElement('div');
        passengerDiv.className = 'passenger-info';
        passengerDiv.innerHTML = `
            <div class="passenger-header">
                <div class="passenger-name">${passenger.full_name || 'N/A'}</div>
                <div class="passenger-type">${getPassengerTypeDisplay(passenger.passenger_type)}</div>
            </div>
            <div class="passenger-details">
                <div class="info-row">
                    <div class="info-label">Ngày sinh:</div>
                    <div class="info-value">${formatDate(passenger.dob) || 'N/A'}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Giấy tờ tùy thân:</div>
                    <div class="info-value">${passenger.passport_number || 'N/A'}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Giới tính:</div>
                    <div class="info-value">${getGenderDisplay(passenger.gender) || 'N/A'}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Dịch vụ bổ sung:</div>
                    <div class="info-value">${getPassengerServicesDisplay(passenger)}</div>
                </div>
            </div>
        `;
        passengerDetailsContent.appendChild(passengerDiv);
    });
}

function getPassengerTypeDisplay(type) {
    switch (type) {
        case 'ADULT': return 'Người lớn';
        case 'CHILD': return 'Trẻ em';
        case 'INFANT': return 'Em bé';
        default: return type || 'N/A';
    }
}

function getGenderDisplay(gender) {
    switch (gender) {
        case 'MALE': return 'Nam';
        case 'FEMALE': return 'Nữ';
        case 'OTHER': return 'Khác';
        default: return gender || 'N/A';
    }
}

function getPassengerServicesDisplay(passenger) {
    const services = [];
    if (passenger.meal) services.push('Suất ăn');
    if (passenger.luggage_weight > 0) services.push(`Hành lý ${passenger.luggage_weight}kg`);
    if (passenger.insurance) services.push('Bảo hiểm');
    return services.length > 0 ? services.join(', ') : 'Không có';
}


function populatePriceSummary(bookingData) {
    const booking = bookingData.booking;
    const departureFlight = bookingData.departureFlight;
    const returnFlight = bookingData.returnFlight;
    const passengers = bookingData.passengers;

    if (!booking || !departureFlight || !passengers) {
        console.error("Missing data for price summary.");
        return;
    }

    const baseFareElement = document.getElementById('base-fare');
    const taxesFeesElement = document.getElementById('taxes-fees');
    const extraServicesRow = document.getElementById('extra-services-row');
    const extraBaggageFeeElement = document.getElementById('extra-baggage-fee');
    const discountRow = document.getElementById('discount-row');
    const discountAmountElement = document.getElementById('discount-amount');
    const totalPriceValueElement = document.getElementById('total-price-value');

    // Calculate base fare (sum of prices for all passengers on all flights)
    let calculatedBaseFare = 0;
    const pricePerPassenger = {}; // To store price per passenger type for departure flight

    // Get base price per passenger type for departure flight
    const departureBasePrice = departureFlight.prices[booking.travel_class] || departureFlight.price_economy;
     for (const passenger of passengers) {
        const passengerType = passenger.passenger_type || 'ADULT';
        const multiplier = getPriceMultiplierForPassengerType(passengerType);
        pricePerPassenger[passenger.detail_id] = departureBasePrice * multiplier;
        calculatedBaseFare += pricePerPassenger[passenger.detail_id];
     }

    // Add return flight price if applicable
    if (booking.is_round_trip && returnFlight) {
        const returnBasePrice = returnFlight.prices[booking.travel_class] || returnFlight.price_economy;
        for (const passenger of passengers) {
             const passengerType = passenger.passenger_type || 'ADULT';
             const multiplier = getPriceMultiplierForPassengerType(passengerType);
             calculatedBaseFare += returnBasePrice * multiplier;
        }
    }


    // Calculate extra services fee (assuming a fixed fee per service per passenger for simplicity)
    // This might need adjustment based on actual service pricing logic
    let extraServicesFee = 0;
    const serviceCostPerPassenger = {
        meal: 50000, // Example cost for meal
        luggage: 200000, // Example cost for extra luggage
        insurance: 100000 // Example cost for insurance
    };

    passengers.forEach(p => {
        if (p.meal) extraServicesFee += serviceCostPerPassenger.meal;
        if (p.luggage_weight > 0) extraServicesFee += serviceCostPerPassenger.luggage;
        if (p.insurance) extraServicesFee += serviceCostPerPassenger.insurance;
    });


    // Taxes and fees (This is often a fixed percentage or amount per passenger/ticket)
    // For now, let's assume a simple calculation or use a value from booking data if available
    // If not available, calculate based on a percentage of base fare
    const taxesFees = booking.total_amount - calculatedBaseFare - extraServicesFee; // This is a simplified calculation

    // Discount amount (already calculated and stored in booking.total_amount if promo applied)
    const originalTotal = calculatedBaseFare + taxesFees + extraServicesFee;
    const discountAmount = originalTotal - booking.total_amount;


    if (baseFareElement) baseFareElement.textContent = formatCurrency(calculatedBaseFare);
    if (taxesFeesElement) taxesFeesElement.textContent = formatCurrency(taxesFees);

    if (extraServicesFee > 0) {
        if (extraServicesRow) extraServicesRow.style.display = 'flex';
        if (extraBaggageFeeElement) extraBaggageFeeElement.textContent = formatCurrency(extraServicesFee);
    } else {
        if (extraServicesRow) extraServicesRow.style.display = 'none';
    }

    if (discountAmount > 0) {
        if (discountRow) discountRow.style.display = 'flex';
        if (discountAmountElement) discountAmountElement.textContent = `- ${formatCurrency(discountAmount)}`;
    } else {
        if (discountRow) discountRow.style.display = 'none';
    }

    if (totalPriceValueElement) totalPriceValueElement.textContent = formatCurrency(booking.total_amount);
}


// Helper function to format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0
    }).format(amount);
}

// Helper function to format date
function formatDate(dateString) {
    if (!dateString) return '';

    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
             // Try to parse common date formats like DD/MM/YYYY
             if (dateString.includes('/')) {
                 const parts = dateString.split('/');
                 if (parts.length === 3) {
                     const day = parseInt(parts[0], 10);
                     const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed
                     const year = parseInt(parts[2], 10);
                     const parsedDate = new Date(year, month, day);
                     if (!isNaN(parsedDate.getTime())) {
                          return parsedDate.toLocaleDateString('vi-VN', {
                             day: '2-digit',
                             month: '2-digit',
                             year: 'numeric'
                         });
                     }
                 }
             }
            return dateString; // Return as is if parsing fails
        }

        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return dateString; // Return as is if error
    }
}

// Helper function to get price multiplier based on passenger type (copied from server.js)
function getPriceMultiplierForPassengerType(passengerType) {
    const multipliers = {
        'ADULT': 1,      // Người lớn: 100% giá vé
        'CHILD': 0.75,   // Trẻ em: 75% giá vé
        'INFANT': 0.1    // Em bé: 10% giá vé
    };
    return multipliers[passengerType] || 1;
}
