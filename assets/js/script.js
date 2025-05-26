// Constants
const API_BASE_URL = 'http://localhost:3000/api';

// Elements
const bookingInfoElement = document.getElementById('booking-info');

document.addEventListener('DOMContentLoaded', function() {
    // Get search form element
    const searchForm = document.getElementById('search-form');
    
    // Fill search form with URL parameters if returning from flight list
    if (searchForm && window.location.search) {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Fill departure and destination
        const departure = urlParams.get('departure');
        const destination = urlParams.get('destination');
        if (departure) document.getElementById('departure').value = departure;
        if (destination) document.getElementById('destination').value = destination;
        
        // Fill dates
        const departDate = urlParams.get('depart-date');
        const returnDate = urlParams.get('return-date');
        if (departDate) document.getElementById('depart-date').value = departDate;
        if (returnDate) document.getElementById('return-date').value = returnDate;
        
        // Fill passenger counts
        const adults = urlParams.get('adults');
        const children = urlParams.get('children');
        const infants = urlParams.get('infants');
        if (adults) document.getElementById('adults').value = adults;
        if (children) document.getElementById('children').value = children;
        if (infants) document.getElementById('infants').value = infants;
        
        // Fill seat class
        const seatClass = urlParams.get('seat-class');
        if (seatClass) document.getElementById('seat-class').value = seatClass;
        
        // Handle one-way vs round-trip tabs
        if (returnDate) {
            document.querySelector('.tabs li:nth-child(2)').click(); // Click round-trip tab
        } else {
            document.querySelector('.tabs li:first-child').click(); // Click one-way tab
        }
    } else {
        // No URL params, set initial state based on default active tab
        const activeTab = document.querySelector('.tabs li.active');
        if (activeTab) {
            const activeTabId = activeTab.querySelector('a').getAttribute('href').substring(1);
            handleTabChange(activeTabId); // Ensure 'Ngày về' is hidden for default 'Một chiều'
        }
    }
    
    // Tab switching functionality
    const tabs = document.querySelectorAll('.tabs li');
    tabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            e.preventDefault();
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Handle tab-specific functionality
            const targetId = this.querySelector('a').getAttribute('href').substring(1);
            handleTabChange(targetId);
        });
    });
    
    // Date input validation
    const departDate = document.getElementById('depart-date');
    const returnDate = document.getElementById('return-date');
    
    if (departDate && returnDate) {
        // Set min date to today
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayString = `${yyyy}-${mm}-${dd}`;
        
        departDate.setAttribute('min', todayString);
        returnDate.setAttribute('min', todayString);
        
        // Update return date min value when depart date changes
        departDate.addEventListener('change', function() {
            returnDate.setAttribute('min', this.value);
            if (returnDate.value && returnDate.value < this.value) {
                returnDate.value = this.value;
            }
        });
    }
    
    // Form validation
    if (searchForm) {
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const departure = document.getElementById('departure').value;
            const destination = document.getElementById('destination').value;
            const departDateValue = departDate ? departDate.value : null;
            
            // Simple validation
            if (!departure || !destination || !departDateValue) {
                alert('Vui lòng điền đầy đủ thông tin tìm kiếm.');
                return;
            }
            
            if (departure === destination) {
                alert('Điểm đi và điểm đến không thể giống nhau.');
                return;
            }
            
            // All validations passed, redirect to flight list page
            const formData = new FormData(searchForm);
            const params = new URLSearchParams(formData);
            window.location.href = `assets/pages/flight-list.html?${params.toString()}`;
        });
    }
    
    // Create sample flight data globally
    createSampleFlightData();
    
    // Load URL parameters if on flight list page
    const isFlightListPage = window.location.pathname.includes('flight-list.html') || 
                            window.location.pathname.endsWith('/flight-list.html');
    if (isFlightListPage) {
        console.log("On flight list page, loading flights...");
        loadFlightListPage();
    }
    
    // Load booking information if on customer info page
    if (window.location.pathname.includes('customer-info.html')) {
        loadCustomerInfoPage();
    }
    
    // Load booking summary if on confirmation page
    if (window.location.pathname.includes('booking-confirmation.html')) {
        loadBookingConfirmationPage();
    }
    
    // Load payment information if on payment page
    if (window.location.pathname.includes('payment.html')) {
        loadPaymentPage();
    }

    // Load ticket preview if on ticket preview page
    if (window.location.pathname.includes('ticket-preview.html')) {
        loadTicketPreviewPage();
    }
});

// Update the API base URL based on your configuration
// API_BASE_URL already defined at the top of the file

// Replace the createSampleFlightData function with a fetch from API
function createSampleFlightData() {
    // This function is now a no-op since we'll fetch from API
    // Keep it for backwards compatibility but it doesn't create data anymore
    window.sampleFlights = []; // Initialize empty array to prevent errors
    console.log('Flight data will be fetched from API instead of local generation');
}

// Handle tab changes
function handleTabChange(tabId) {
    const returnDateInput = document.getElementById('return-date');
    const returnDateContainer = returnDateInput.closest('.input-group');
    
    if (tabId === 'one-way') {
        returnDateContainer.style.display = 'none';
        returnDateInput.removeAttribute('required');
    } else if (tabId === 'round-trip') {
        returnDateContainer.style.display = 'block';
        returnDateInput.setAttribute('required', 'required');
    }
}

// Format price as Vietnamese currency
function formatCurrency(price) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

// Load flight list page content based on URL parameters
function loadFlightListPage() {
    console.log("Loading flight list page...");
    const urlParams = new URLSearchParams(window.location.search);
    const departure = urlParams.get('departure');
    const destination = urlParams.get('destination');
    const departDate = urlParams.get('depart-date');
    const returnDate = urlParams.get('return-date');
    const adults = urlParams.get('adults') || "1";
    const children = urlParams.get('children') || "0";
    const infants = urlParams.get('infants') || "0";
    const tripType = returnDate ? 'round-trip' : 'one-way';
    const selectingReturn = urlParams.get('selecting-return') === 'true';
    
    console.log("Search parameters:", { departure, destination, departDate, returnDate, tripType, selectingReturn });
    
    // Check if we're in the process of selecting a return flight
    const selectedDepartureFlight = sessionStorage.getItem('selectedDepartureFlight');
    
    // Update page title with search parameters
    const searchSummary = document.getElementById('search-summary');
    if (searchSummary) {
        // Get city names from the URL parameters or use the codes
        const departureCity = getAirportName(departure);
        const destinationCity = getAirportName(destination);
        
        const passengerInfo = `${adults} người lớn${children > 0 ? `, ${children} trẻ em` : ''}${infants > 0 ? `, ${infants} em bé` : ''}`;
        
        if (selectingReturn && selectedDepartureFlight) {
            // We're selecting a return flight
            searchSummary.innerHTML = `
                <h2>${destinationCity} → ${departureCity}</h2>
                <p><strong>CHUYẾN VỀ:</strong> Ngày về: ${formatDate(returnDate)} | ${passengerInfo}</p>
                <p><em>Vui lòng chọn chuyến bay cho hành trình quay về</em></p>
                <button id="modify-search" class="btn-secondary">Thay đổi tìm kiếm</button>
            `;
        } else {
            // Normal display for selecting outbound flight
        searchSummary.innerHTML = `
            <h2>${departureCity} → ${destinationCity}</h2>
            <p>Ngày đi: ${formatDate(departDate)} | ${passengerInfo}</p>
            ${returnDate ? `<p>Ngày về: ${formatDate(returnDate)}</p>` : ''}
            <button id="modify-search" class="btn-secondary">Thay đổi tìm kiếm</button>
        `;
        }
        
        // Add event listener to modify search button
        const modifySearchBtn = document.getElementById('modify-search');
        if (modifySearchBtn) {
            modifySearchBtn.addEventListener('click', function() {
                // Clear any stored flight selections if modifying search
                if (selectingReturn) {
                    sessionStorage.removeItem('selectedDepartureFlight');
                }
                window.location.href = `../../index.html?${urlParams.toString()}`;
            });
        }
    } else {
        console.error("Search summary element not found!");
    }
    
    // Initialize filter handlers
    initializeFilters();
    
    // If selecting return flight, switch the origin and destination
    if (selectingReturn) {
        displayFlights(destination, departure, true);
    } else {
        displayFlights(departure, destination, false);
    }
}

// Helper function to get airport name from code
function getAirportName(code) {
    const airports = {
        'HAN': 'Hà Nội (HAN)',
        'SGN': 'Hồ Chí Minh (SGN)',
        'DAD': 'Đà Nẵng (DAD)',
        'CXR': 'Nha Trang (CXR)',
        'PQC': 'Phú Quốc (PQC)'
    };
    return airports[code] || code;
}

// Initialize flight filters
function initializeFilters() {
    console.log("Initializing filters...");
    
    // Airline filters
    const airlineCheckboxes = document.querySelectorAll('input[name="airline"]');
    if (airlineCheckboxes.length > 0) {
        airlineCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                displayFilteredFlights();
            });
        });
    } else {
        console.log("No airline checkboxes found");
    }
    
    // Departure time filters
    const timeCheckboxes = document.querySelectorAll('input[name="depart-time"]');
    if (timeCheckboxes.length > 0) {
        timeCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                displayFilteredFlights();
            });
        });
    } else {
        console.log("No time checkboxes found");
    }
    
    // Seat class filters
    const seatClassCheckboxes = document.querySelectorAll('input[name="seat-class"]');
    if (seatClassCheckboxes.length > 0) {
        seatClassCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                displayFilteredFlights();
            });
        });
    } else {
        console.log("No seat class checkboxes found");
    }
    
    // Price range filter
    const priceRange = document.getElementById('price-range');
    if (priceRange) {
        priceRange.addEventListener('change', function() {
            displayFilteredFlights();
        });
        
        // Also trigger on input for live update
        priceRange.addEventListener('input', function() {
            const priceValue = document.getElementById('price-value');
            if (priceValue) {
                priceValue.textContent = formatCurrency(this.value);
            }
        });
    } else {
        console.log("Price range element not found");
    }
    
    // Add sorting options
    const flightList = document.getElementById('flight-list');
    if (flightList && flightList.parentNode) {
        // Check if sort container already exists
        const existingSortContainer = document.querySelector('.sort-container');
        if (!existingSortContainer) {
            const sortContainer = document.createElement('div');
            sortContainer.className = 'sort-container';
            sortContainer.innerHTML = `
                <label for="sort-flights">Sắp xếp theo:</label>
                <select id="sort-flights">
                    <option value="price-asc">Giá (thấp đến cao)</option>
                    <option value="price-desc">Giá (cao đến thấp)</option>
                    <option value="time-asc">Giờ khởi hành (sớm nhất)</option>
                    <option value="time-desc">Giờ khởi hành (muộn nhất)</option>
                </select>
            `;
            
            flightList.parentNode.insertBefore(sortContainer, flightList);
            
            // Add event listener to sorting select
            const sortSelect = document.getElementById('sort-flights');
            if (sortSelect) {
                sortSelect.addEventListener('change', function() {
                    displayFilteredFlights();
                });
            }
        }
    } else {
        console.log("Flight list element or its parent not found");
    }
}

// Display flights with current filters
function displayFilteredFlights() {
    console.log("Displaying filtered flights...");
    const urlParams = new URLSearchParams(window.location.search);
    const departure = urlParams.get('departure');
    const destination = urlParams.get('destination');
    
    if (!departure || !destination) {
        console.error("Missing departure or destination in URL parameters");
        const flightList = document.getElementById('flight-list');
        if (flightList) {
            flightList.innerHTML = '<div class="no-flights">Thông tin tìm kiếm không hợp lệ. Vui lòng quay lại trang chủ và thử lại.</div>';
        }
        return;
    }
    
    displayFlights(departure, destination);
}

// Modify the displayFlights function to fetch from API
function displayFlights(departure, destination, isReturnFlight = false) {
    console.log(`Displaying flights for: ${departure} to ${destination} (${isReturnFlight ? 'return flight' : 'departure flight'})`);
    
    if (!departure || !destination) {
        console.error("Invalid departure or destination");
        return;
    }
    
    const flightList = document.getElementById('flight-list');
    if (!flightList) {
        console.error("Flight list element not found!");
        return;
    }
    
    // Clear current flight list
    flightList.innerHTML = '';
    
    // Show loading state
    flightList.innerHTML = '<div class="loading">Đang tải thông tin chuyến bay...</div>';
    
    // Get filter values
    const selectedAirlines = Array.from(document.querySelectorAll('input[name="airline"]:checked')).map(cb => cb.value);
    const selectedTimes = Array.from(document.querySelectorAll('input[name="depart-time"]:checked')).map(cb => cb.value);
    const selectedSeatClasses = Array.from(document.querySelectorAll('input[name="seat-class"]:checked')).map(cb => cb.value);
    const maxPriceElement = document.getElementById('price-range');
    const maxPrice = maxPriceElement ? maxPriceElement.value : 2000000;
    const sortElement = document.getElementById('sort-flights');
    const sortOption = sortElement ? sortElement.value : 'price-asc';
    
    // Get selected seat class and date from URL parameters
    const searchParams = new URLSearchParams(window.location.search);
    const searchSeatClass = searchParams.get('seat-class') || 'ECONOMY';
    // Choose departure or return date based on which flights we're selecting
    const dateToUse = isReturnFlight ? searchParams.get('return-date') : searchParams.get('depart-date');
    
    console.log("Search parameters:", { dateToUse, searchSeatClass });
    
    // Fetch flights from API
    let apiUrl = `${API_BASE_URL}/flights?departure=${departure}&destination=${destination}`;
    
    if (dateToUse) {
        // Format date correctly for the API (YYYY-MM-DD)
        apiUrl += `&departDate=${dateToUse}`;
    }
    
    if (searchSeatClass) {
        apiUrl += `&seatClass=${searchSeatClass}`;
    }
    
    console.log("Fetching flights from:", apiUrl);
    
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(flights => {
            console.log("Received flights from API:", flights);
            
            // If flights is empty or not an array, handle the error
            if (!Array.isArray(flights) || flights.length === 0) {
                flightList.innerHTML = '<div class="no-flights">Không tìm thấy chuyến bay phù hợp với tìm kiếm của bạn. Vui lòng thử lại với các điều kiện khác.</div>';
                return;
            }
            
            console.log("Number of flights:", flights.length);
            
            // Remove loading indicator
            flightList.innerHTML = '';
            
            // Apply client-side filters (could be moved to API but keeping for now)
            let filteredFlights = flights.filter(flight => flight.price <= maxPrice);
            
            // Apply airline filter if any selected
            if (selectedAirlines.length > 0) {
                filteredFlights = filteredFlights.filter(flight => selectedAirlines.includes(flight.airlineCode));
            }
            
            // Apply time filter if any selected
            if (selectedTimes.length > 0) {
                filteredFlights = filteredFlights.filter(flight => {
                    const hour = parseInt(flight.departureTime.split(':')[0]);
                    
                    return (
                        (selectedTimes.includes('early-morning') && hour >= 0 && hour < 6) ||
                        (selectedTimes.includes('morning') && hour >= 6 && hour < 12) ||
                        (selectedTimes.includes('afternoon') && hour >= 12 && hour < 18) ||
                        (selectedTimes.includes('evening') && hour >= 18 && hour < 24)
                    );
                });
            }
            
            // Apply seat class filter if any selected
            if (selectedSeatClasses.length > 0) {
                filteredFlights = filteredFlights.filter(flight => 
                    selectedSeatClasses.some(seatClass => 
                        Array.isArray(flight.availableClasses) 
                            ? flight.availableClasses.includes(seatClass)
                            : String(flight.availableClasses).includes(seatClass)
                    )
                );
            }
            
            // If no flights found, show message
            if (filteredFlights.length === 0) {
                flightList.innerHTML = '<div class="no-flights">Không tìm thấy chuyến bay phù hợp với bộ lọc đã chọn. Vui lòng thay đổi bộ lọc và thử lại.</div>';
                return;
            }
            
            // Sort flights
            filteredFlights.sort((a, b) => {
                switch (sortOption) {
                    case 'price-asc':
                        return a.price - b.price;
                    case 'price-desc':
                        return b.price - a.price;
                    case 'time-asc':
                        return timeToMinutes(a.departureTime) - timeToMinutes(b.departureTime);
                    case 'time-desc':
                        return timeToMinutes(b.departureTime) - timeToMinutes(a.departureTime);
                    default:
                        return a.price - b.price;
                }
            });
            
            // Display filtered and sorted flights
            filteredFlights.forEach(flight => {
                const flightCard = document.createElement('div');
                flightCard.className = 'flight-card';
                
                // Get the seat class name based on the URL parameter
                const searchParams = new URLSearchParams(window.location.search);
                const selectedSeatClass = searchParams.get('seat-class') || 'ECONOMY';
                const seatClassDisplay = getSeatClassName(selectedSeatClass);
                
                let logoSrc = `../images/${flight.airlineCode.toLowerCase()}-logo.png`; // Default path
                if (flight.airlineCode === 'VJ') {
                    logoSrc = '../images/vietjet-air.jpg';
                } else if (flight.airlineCode === 'VN') {
                    logoSrc = '../images/Vietnam-Airlines.jpg';
                } else if (flight.airlineCode === 'BL') {
                    logoSrc = '../images/JETSTAR.jpg';
                } else if (flight.airlineCode === 'QH') {
                    logoSrc = '../images/BambooAirways.png';
                }

                flightCard.innerHTML = `
                    <div class="flight-header">
                        <img src="${logoSrc}" onerror="this.src='https://via.placeholder.com/60?text=${flight.airlineCode}'" alt="${flight.airline}" class="airline-logo">
                        <h3>${flight.airline}</h3>
                        <span class="flight-id">${flight.id}</span>
                    </div>
                    <div class="flight-details">
                        <div class="flight-time">
                            <div class="departure">
                                <div class="time">${flight.departureTime}</div>
                                <div class="airport">${flight.departure}</div>
                            </div>
                            <div class="duration">
                                <div class="line"></div>
                                <div class="time">${flight.duration}</div>
                            </div>
                            <div class="arrival">
                                <div class="time">${flight.arrivalTime}</div>
                                <div class="airport">${flight.destination}</div>
                            </div>
                        </div>
                        <div class="flight-info">
                            <div class="flight-class">${seatClassDisplay}</div>
                            <div class="flight-price">${formatCurrency(getPriceForSeatClass(flight.price, selectedSeatClass))}</div>
                            <button class="btn-select" data-flight-id="${flight.id}">Chọn</button>
                        </div>
                    </div>
                `;
                flightList.appendChild(flightCard);
                
                // Add event listener to the select button
                flightCard.querySelector('.btn-select').addEventListener('click', function() {
                    const flightId = this.getAttribute('data-flight-id');
                    const selectedFlight = filteredFlights.find(f => f.id === flightId);
                    const searchParams = new URLSearchParams(window.location.search);
                    const isRoundTrip = searchParams.get('return-date') !== null;
                    const isSelectingReturn = searchParams.get('selecting-return') === 'true';
                    
                    if (isRoundTrip && !isSelectingReturn) {
                        // For round trip's first leg (departure flight)
                        sessionStorage.setItem('selectedDepartureFlight', JSON.stringify({
                            ...selectedFlight,
                            departDate: searchParams.get('depart-date'),
                            adults: searchParams.get('adults') || "1",
                            children: searchParams.get('children') || "0",
                            infants: searchParams.get('infants') || "0",
                            seatClass: searchParams.get('seat-class') || "ECONOMY",
                            seatClassName: getSeatClassName(searchParams.get('seat-class') || "ECONOMY"),
                            finalPrice: getPriceForSeatClass(selectedFlight.price, searchParams.get('seat-class') || "ECONOMY")
                        }));
                        
                        // Redirect to select return flight
                        const params = new URLSearchParams(searchParams);
                        params.set('selecting-return', 'true');
                        window.location.href = `flight-list.html?${params.toString()}`;
                        
                    } else if (isRoundTrip && isSelectingReturn) {
                        // For round trip's second leg (return flight)
                        const departureFlight = JSON.parse(sessionStorage.getItem('selectedDepartureFlight'));
                        
                        if (!departureFlight) {
                            alert('Đã xảy ra lỗi khi chọn chuyến bay. Vui lòng thử lại.');
                            window.location.href = '../../index.html';
                            return;
                        }
                        
                        // Now we have both flights, combine them
                        sessionStorage.setItem('selectedFlight', JSON.stringify({
                            ...departureFlight,
                            returnDate: searchParams.get('return-date'),
                            returnFlight: {
                                ...selectedFlight,
                                departDate: searchParams.get('return-date'),
                                seatClass: searchParams.get('seat-class') || "ECONOMY",
                                seatClassName: getSeatClassName(searchParams.get('seat-class') || "ECONOMY"),
                                finalPrice: getPriceForSeatClass(selectedFlight.price, searchParams.get('seat-class') || "ECONOMY")
                            }
                        }));
                        
                        // Clear the departure flight since we've combined them
                        sessionStorage.removeItem('selectedDepartureFlight');
                        
                        // Redirect to customer info page with both flights selected
                        window.location.href = 'customer-info.html';
                        
                    } else {
                        // One-way trip
                    sessionStorage.setItem('selectedFlight', JSON.stringify({
                        ...selectedFlight,
                        departDate: searchParams.get('depart-date'),
                            returnDate: null, // Explicitly set to null for one-way
                        adults: searchParams.get('adults') || "1",
                        children: searchParams.get('children') || "0",
                        infants: searchParams.get('infants') || "0",
                        seatClass: searchParams.get('seat-class') || "ECONOMY",
                        seatClassName: getSeatClassName(searchParams.get('seat-class') || "ECONOMY"),
                        finalPrice: getPriceForSeatClass(selectedFlight.price, searchParams.get('seat-class') || "ECONOMY")
                    }));
                    
                    // Redirect to customer info page
                    window.location.href = 'customer-info.html';
                    }
                });
            });
        })
        .catch(error => {
            console.error('Error fetching flights:', error);
            flightList.innerHTML = `<div class="no-flights">Có lỗi xảy ra khi tải dữ liệu chuyến bay: ${error.message}. Vui lòng thử lại sau.</div>`;
        });
}

// Helper function to convert time string to minutes
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// Helper function to get seat class display name
function getSeatClassName(seatClass) {
    const seatClassNames = {
        'ECONOMY': 'Phổ thông',
        'PREMIUM_ECONOMY': 'Phổ thông đặc biệt',
        'BUSINESS': 'Thương gia',
        'FIRST': 'Thương gia hạng nhất'
    };
    return seatClassNames[seatClass] || 'Phổ thông';
}

// Helper function to adjust price based on seat class
function getPriceForSeatClass(flight, seatClass) {
    // If a full flight object is passed, use its price structure
    if (flight && typeof flight === 'object') {
        // First try to get from the prices object
        if (flight.prices && flight.prices[seatClass]) {
            return flight.prices[seatClass];
        }
        
        // Then try the specific price fields
        switch (seatClass) {
            case 'PREMIUM_ECONOMY':
                return flight.price_premium_economy || flight.price_economy || flight.price;
            case 'BUSINESS':
                return flight.price_business || flight.price_economy || flight.price;
            case 'FIRST':
                return flight.price_first || flight.price_economy || flight.price;
            case 'ECONOMY':
            default:
                return flight.price_economy || flight.price;
        }
    }
    
    // For backward compatibility - if just a base price was passed
    const basePrice = typeof flight === 'number' ? flight : (flight?.price || 0);
    const multipliers = {
        'ECONOMY': 1,
        'PREMIUM_ECONOMY': 1.5,
        'BUSINESS': 2.5,
        'FIRST': 4
    };
    return Math.round(basePrice * (multipliers[seatClass] || 1));
}

// Helper function to get price multiplier based on passenger type
function getPriceMultiplierForPassengerType(passengerType) {
    // Chuyển đổi sang chữ thường để xử lý đồng nhất
    const type = passengerType.toString().toLowerCase();
    
    const multipliers = {
        'adult': 1,      // Người lớn: 100% giá vé
        'child': 0.75,   // Trẻ em: 75% giá vé
        'infant': 0.1    // Em bé: 10% giá vé
    };
    
    // Thêm các trường hợp chữ hoa
    multipliers['ADULT'] = 1;
    multipliers['CHILD'] = 0.75;
    multipliers['INFANT'] = 0.1;
    
    return multipliers[type] || 1;
}

// Load customer info page
function loadCustomerInfoPage() {
    // Get selected flight from sessionStorage
    const selectedFlightData = JSON.parse(sessionStorage.getItem('selectedFlight'));
    if (!selectedFlightData) {
        window.location.href = '../../index.html'; // Corrected path
        return;
    }

    const numAdults = parseInt(selectedFlightData.adults) || 0;
    const numChildren = parseInt(selectedFlightData.children) || 0;
    const numInfants = parseInt(selectedFlightData.infants) || 0;
    
    // Calculate base fare for each passenger type based on their multipliers
    const baseSeatPrice = getPriceForSeatClass(selectedFlightData, selectedFlightData.seatClass);
    const adultPrice = baseSeatPrice * getPriceMultiplierForPassengerType('adult');
    const childPrice = baseSeatPrice * getPriceMultiplierForPassengerType('child');
    const infantPrice = baseSeatPrice * getPriceMultiplierForPassengerType('infant');
    
    // Check if this is a round trip booking
    const isRoundTrip = selectedFlightData.isRoundTrip === true || (selectedFlightData.returnFlight && selectedFlightData.returnDate);
    let returnTotalPrice = 0;
    
    if (isRoundTrip) {
        // Calculate return flight prices
        const returnBaseSeatPrice = getPriceForSeatClass(selectedFlightData.returnFlight, selectedFlightData.returnFlight.seatClass);
        const returnAdultPrice = returnBaseSeatPrice * getPriceMultiplierForPassengerType('adult');
        const returnChildPrice = returnBaseSeatPrice * getPriceMultiplierForPassengerType('child');
        const returnInfantPrice = returnBaseSeatPrice * getPriceMultiplierForPassengerType('infant');
        
        returnTotalPrice = (returnAdultPrice * numAdults) + (returnChildPrice * numChildren) + (returnInfantPrice * numInfants);
    }
    
    // Calculate total price with correct multipliers for each passenger type
    const departTotalPrice = (adultPrice * numAdults) + (childPrice * numChildren) + (infantPrice * numInfants);
    const calculatedTotalPrice = departTotalPrice + returnTotalPrice;

    // Display flight summary
    const flightSummary = document.getElementById('flight-summary');
    if (flightSummary) {
        let summaryHTML = `
            <div class="flight-summary-header">
                <h3>${isRoundTrip ? 'CHUYẾN ĐI:' : ''} ${selectedFlightData.airline} (${selectedFlightData.id})</h3>
                <div class="flight-route">${selectedFlightData.departure} → ${selectedFlightData.destination}</div>
            </div>
            <div class="flight-summary-details">
                <div class="flight-date">${formatDate(selectedFlightData.departDate)}</div>
                <div class="flight-time">${selectedFlightData.departureTime} - ${selectedFlightData.arrivalTime}</div>
                <div class="flight-duration">${selectedFlightData.duration}</div>
                <div class="flight-class">${getSeatClassName(selectedFlightData.seatClass)}</div>
        `;
        
        if (isRoundTrip && selectedFlightData.returnFlight) {
            const returnFlight = selectedFlightData.returnFlight;
            summaryHTML += `
                </div>
                <hr>
                <div class="flight-summary-header">
                    <h3>CHUYẾN VỀ: ${returnFlight.airline} (${returnFlight.id})</h3>
                    <div class="flight-route">${returnFlight.departure} → ${returnFlight.destination}</div>
                </div>
                <div class="flight-summary-details">
                    <div class="flight-date">${formatDate(selectedFlightData.returnDate)}</div>
                    <div class="flight-time">${returnFlight.departureTime} - ${returnFlight.arrivalTime}</div>
                    <div class="flight-duration">${returnFlight.duration}</div>
                    <div class="flight-class">${returnFlight.seatClassName}</div>
            `;
        }
        
        summaryHTML += `
                <p><strong>Số lượng:</strong> ${numAdults} người lớn${numChildren > 0 ? `, ${numChildren} trẻ em` : ''}${numInfants > 0 ? `, ${numInfants} em bé` : ''}</p>
                <div class="flight-price">Tổng cộng: ${formatCurrency(calculatedTotalPrice)}</div>
            </div>
        `;
        
        flightSummary.innerHTML = summaryHTML;
    }
    
    // Store the calculated total price and the selected seat class name for later pages
    sessionStorage.setItem('calculatedTotalPrice', calculatedTotalPrice);
    sessionStorage.setItem('displaySeatClassName', getSeatClassName(selectedFlightData.seatClass)); // Store for display
    sessionStorage.setItem('isRoundTrip', isRoundTrip); // Store the round-trip status explicitly

    // Also store the individual pricing data for later reference
    sessionStorage.setItem('pricingDetails', JSON.stringify({
        baseSeatPrice: baseSeatPrice,
        adultPrice: adultPrice,
        childPrice: childPrice,
        infantPrice: infantPrice,
        numAdults: numAdults,
        numChildren: numChildren,
        numInfants: numInfants,
        isRoundTrip: isRoundTrip,
        returnBaseSeatPrice: isRoundTrip && selectedFlightData.returnFlight ? getPriceForSeatClass(selectedFlightData.returnFlight, selectedFlightData.returnFlight.seatClass) : 0,
        departTotalPrice: departTotalPrice,
        returnTotalPrice: returnTotalPrice
    }));

    // Dynamically generate passenger forms
    const passengerFormsContainer = document.getElementById('passenger-forms-container');
    if (passengerFormsContainer) {
        passengerFormsContainer.innerHTML = ''; // Clear existing forms

        // const numAdults, numChildren, numInfants already defined above
        let passengerCount = 0;

        for (let i = 0; i < numAdults; i++) {
            passengerCount++;
            passengerFormsContainer.appendChild(createPassengerForm(passengerCount, 'Người lớn'));
        }
        for (let i = 0; i < numChildren; i++) {
            passengerCount++;
            passengerFormsContainer.appendChild(createPassengerForm(passengerCount, 'Trẻ em (2-12 tuổi)'));
        }
        for (let i = 0; i < numInfants; i++) {
            passengerCount++;
            passengerFormsContainer.appendChild(createPassengerForm(passengerCount, 'Em bé (< 2 tuổi)'));
        }

        // Add age validation for all date of birth inputs
        document.querySelectorAll('input[type="date"][data-passenger-type]').forEach(input => {
            input.addEventListener('change', function() {
                validateAge(this);
            });
        });
    }
    
    // Phone number validation
    const contactPhoneInput = document.getElementById('contact-phone');
    if (contactPhoneInput) {
        contactPhoneInput.addEventListener('input', function(e) {
            // Allow only numbers and the '+' sign for international codes
            e.target.value = e.target.value.replace(/[^0-9+]/g, '');
        });
    }

    // Handle customer info form submission
    const customerForm = document.getElementById('customer-form');
    if (customerForm) {
        customerForm.addEventListener('submit', function(e) {
            e.preventDefault();

            // Validate all dates of birth before submission
            let ageValidationPassed = true;
            document.querySelectorAll('input[type="date"][data-passenger-type]').forEach(input => {
                if (!validateAge(input)) {
                    ageValidationPassed = false;
                }
            });

            if (!ageValidationPassed) {
                return; // Stop form submission if age validation fails
            }

            // Validate phone number format
            if (contactPhoneInput) {
                const phoneNumber = contactPhoneInput.value;
                // Regex for Vietnamese phone numbers: starts with 0 or +84, followed by 9 digits.
                // Examples: 0912345678, +84912345678
                const vnPhoneRegex = /^(0\d{9}|(\+84)\d{9})$/;
                if (!vnPhoneRegex.test(phoneNumber)) {
                    alert('Vui lòng nhập số điện thoại Việt Nam hợp lệ (ví dụ: 0912345678 hoặc +84912345678).');
                    contactPhoneInput.focus();
                    return;
                }
            }
            
            const formData = new FormData(customerForm);
            const customerInfo = {
                contactPerson: {
                    fullName: formData.get('contact-name'),
                    email: formData.get('contact-email'),
                    phone: formData.get('contact-phone')
                },
                passengers: []
            };

            // Lấy tất cả trường hành khách từ form
            const totalPassengerCount = numAdults + numChildren + numInfants;

            for (let i = 1; i <= totalPassengerCount; i++) {
                // Lấy loại hành khách từ trường hidden
                const passengerTypeValue = formData.get(`passenger-type-${i}`);
                let passengerType = 'adult'; // Mặc định là người lớn
                
                if (passengerTypeValue) {
                    // Sử dụng giá trị từ trường ẩn nếu có
                    passengerType = passengerTypeValue;
                } else {
                    // Fallback dựa vào vị trí
                    if (i <= numAdults) {
                        passengerType = 'adult';
                    } else if (i <= numAdults + numChildren) {
                        passengerType = 'child';
                    } else {
                        passengerType = 'infant';
                    }
                }
                
                customerInfo.passengers.push({
                    type: passengerType,
                    fullName: formData.get(`passenger-${i}-name`),
                    gender: formData.get(`passenger-${i}-gender`),
                    dob: formData.get(`passenger-${i}-dob`),
                    idNumber: formData.get(`passenger-${i}-id`)
                });
            }
            
            // Save customer info to sessionStorage
            sessionStorage.setItem('customerInfo', JSON.stringify(customerInfo));

            // Get selected additional services
            const selectedServices = {
                food: formData.has('service-food'),
                luggage: formData.has('service-luggage'),
                insurance: formData.has('service-insurance')
            };
            sessionStorage.setItem('selectedServices', JSON.stringify(selectedServices));
            
            // Redirect to booking confirmation page
            window.location.href = 'booking-confirmation.html';
        });
    }
}

// Helper function to create a single passenger form
function createPassengerForm(index, typeLabel) {
    const passengerType = typeLabel.toLowerCase().includes('trẻ em') ? 'child' : 
                         typeLabel.toLowerCase().includes('em bé') ? 'infant' : 'adult';
    
    const formDiv = document.createElement('div');
    formDiv.className = 'passenger-form';
    formDiv.id = `passenger-${index}-form-section`;
    
    // Set date constraints based on passenger type
    const today = new Date();
    let minDate = '';
    let maxDate = '';
    
    if (passengerType === 'adult') {
        // Adults: 18 years or older (max date is 18 years ago from today)
        const maxAdultDate = new Date(today);
        maxAdultDate.setFullYear(maxAdultDate.getFullYear() - 18);
        maxDate = maxAdultDate.toISOString().split('T')[0];
    } else if (passengerType === 'child') {
        // Children: between 2 and 12 years (min date is 12 years ago, max date is 2 years ago)
        const minChildDate = new Date(today);
        minChildDate.setFullYear(minChildDate.getFullYear() - 12);
        minDate = minChildDate.toISOString().split('T')[0];
        
        const maxChildDate = new Date(today);
        maxChildDate.setFullYear(maxChildDate.getFullYear() - 2);
        maxDate = maxChildDate.toISOString().split('T')[0];
    } else if (passengerType === 'infant') {
        // Infants: under 2 years (min date is 2 years ago)
        const minInfantDate = new Date(today);
        minInfantDate.setFullYear(minInfantDate.getFullYear() - 2);
        minDate = '';
        maxDate = minInfantDate.toISOString().split('T')[0];
    }
    
    formDiv.innerHTML = `
        <h4>Hành khách ${index} (${typeLabel})</h4>
        <div class="form-group">
            <label for="passenger-${index}-name" class="required">Họ tên đầy đủ (như trên CMND/Hộ chiếu)</label>
            <input type="text" id="passenger-${index}-name" name="passenger-${index}-name" required>
        </div>
        <div class="form-row">
            <div class="form-col">
                <div class="form-group">
                    <label for="passenger-${index}-gender" class="required">Giới tính</label>
                    <select id="passenger-${index}-gender" name="passenger-${index}-gender" required>
                        <option value="">Chọn giới tính</option>
                        <option value="male">Nam</option>
                        <option value="female">Nữ</option>
                    </select>
                </div>
            </div>
            <div class="form-col">
                <div class="form-group">
                    <label for="passenger-${index}-dob" class="required">Ngày sinh</label>
                    <input type="date" id="passenger-${index}-dob" name="passenger-${index}-dob" required 
                           data-passenger-type="${passengerType}"
                           ${minDate ? `min="${minDate}"` : ''} 
                           ${maxDate ? `max="${maxDate}"` : ''}>
                    <small class="form-hint">${getAgeHint(passengerType)}</small>
                </div>
            </div>
        </div>
        <div class="form-group">
            <label for="passenger-${index}-id" class="required">CCCD/Hộ chiếu</label>
            <input type="text" id="passenger-${index}-id" name="passenger-${index}-id" required>
        </div>
        <input type="hidden" id="passenger-type-${index}" name="passenger-type-${index}" value="${passengerType}">
    `;
    
    return formDiv;
}

// Helper function to get age hint text
function getAgeHint(passengerType) {
    switch(passengerType) {
        case 'adult':
            return 'Người lớn phải từ 18 tuổi trở lên';
        case 'child':
            return 'Trẻ em phải từ 2 đến 12 tuổi';
        case 'infant':
            return 'Em bé phải dưới 2 tuổi';
        default:
            return '';
    }
}

// Function to validate age based on passenger type
function validateAge(dobInput) {
    const dob = new Date(dobInput.value);
    const today = new Date();
    
    // Calculate age
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    // Adjust age if birthday hasn't occurred yet this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    
    const passengerType = dobInput.getAttribute('data-passenger-type');
    let isValid = true;
    let errorMessage = '';
    
    // Validate based on passenger type
    switch(passengerType) {
        case 'adult':
            if (age < 18) {
                isValid = false;
                errorMessage = 'Ngày sinh không hợp lệ. Người lớn phải từ 18 tuổi trở lên.';
            }
            break;
        case 'child':
            if (age < 2 || age > 12) {
                isValid = false;
                errorMessage = 'Ngày sinh không hợp lệ. Trẻ em phải từ 2 đến 12 tuổi.';
            }
            break;
        case 'infant':
            if (age >= 2) {
                isValid = false;
                errorMessage = 'Ngày sinh không hợp lệ. Em bé phải dưới 2 tuổi.';
            }
            break;
    }
    
    // Show error message if validation fails
    if (!isValid) {
        alert(errorMessage);
        dobInput.value = ''; // Clear the invalid date
    }
    
    return isValid;
}

// Load booking confirmation page
function loadBookingConfirmationPage() {
    // Get data from sessionStorage
    const selectedFlightData = JSON.parse(sessionStorage.getItem('selectedFlight'));
    const customerInfo = JSON.parse(sessionStorage.getItem('customerInfo'));

    if (!selectedFlightData || !customerInfo) {
        console.error("Booking confirmation: Essential data (selectedFlight or customerInfo) not found. Redirecting.");
        window.location.href = '../../index.html'; // Corrected path
        return;
    }

    // Now selectedFlightData is confirmed to exist and is parsed.
    const displaySeatClassNameFromStorage = sessionStorage.getItem('displaySeatClassName');
    const displaySeatClassName = displaySeatClassNameFromStorage || getSeatClassName(selectedFlightData.seatClass);
    
    const selectedServicesJSON = sessionStorage.getItem('selectedServices');
    const selectedServices = selectedServicesJSON ? JSON.parse(selectedServicesJSON) : { food: false, luggage: false, insurance: false };
    
    const numAdults = parseInt(selectedFlightData.adults) || 0;
    const numChildren = parseInt(selectedFlightData.children) || 0;
    const numInfants = parseInt(selectedFlightData.infants) || 0;
    const passengerCountString = `${numAdults} người lớn${numChildren > 0 ? `, ${numChildren} trẻ em` : ''}${numInfants > 0 ? `, ${numInfants} em bé` : ''}`;

    // Get content containers
    const flightDetailsContent = document.getElementById('flight-details-content');
    const contactDetailsContent = document.getElementById('contact-details-content');
    const passengerDetailsContent = document.getElementById('passenger-details-content');
    const priceDetailsContent = document.getElementById('price-details-content');

    // Populate Flight Details
    if (flightDetailsContent) {
        let flightDetailsHTML = `
            <div class="departure-flight">
                <h4>CHUYẾN ĐI</h4>
                <p><strong>Hành trình:</strong> <span id="flight-departure-city">${getAirportName(selectedFlightData.departure)}</span> <i class="fas fa-arrow-right"></i> <span id="flight-arrival-city">${getAirportName(selectedFlightData.destination)}</span></p>
            <p><strong>Ngày đi:</strong> <span id="flight-departure-date">${formatDate(selectedFlightData.departDate)}</span></p>
            <p><strong>Giờ cất cánh:</strong> <span id="flight-departure-time">${selectedFlightData.departureTime}</span> (Đến nơi: ${selectedFlightData.arrivalTime} - Thời gian bay: ${selectedFlightData.duration})</p>
            <p><strong>Hãng hàng không:</strong> <span id="flight-airline">${selectedFlightData.airline} (${selectedFlightData.id})</span></p>
            <p><strong>Hạng vé:</strong> ${displaySeatClassName}</p>
            </div>
        `;
        
        // Add return flight details if this is a round trip
        if (!!selectedFlightData.returnFlight && !!selectedFlightData.returnDate) {
            const returnFlight = selectedFlightData.returnFlight;
            
            flightDetailsHTML += `
                <hr>
                <div class="return-flight">
                    <h4>CHUYẾN VỀ</h4>
                    <p><strong>Hành trình:</strong> <span id="return-flight-departure-city">${getAirportName(returnFlight.departure)}</span> <i class="fas fa-arrow-right"></i> <span id="return-flight-arrival-city">${getAirportName(returnFlight.destination)}</span></p>
                <p><strong>Ngày về:</strong> <span id="return-flight-departure-date">${formatDate(selectedFlightData.returnDate)}</span></p>
                    <p><strong>Giờ cất cánh:</strong> <span id="return-flight-departure-time">${returnFlight.departureTime}</span> (Đến nơi: ${returnFlight.arrivalTime} - Thời gian bay: ${returnFlight.duration})</p>
                    <p><strong>Hãng hàng không:</strong> <span id="return-flight-airline">${returnFlight.airline} (${returnFlight.id})</span></p>
                    <p><strong>Hạng vé:</strong> ${returnFlight.seatClassName || getSeatClassName(returnFlight.seatClass)}</p>
                </div>
            `;
        }
        
        // Add passenger count
        flightDetailsHTML += `
            <p><strong>Số lượng hành khách:</strong> ${passengerCountString}</p>
        `;
        
        flightDetailsContent.innerHTML = flightDetailsHTML;
    }

    // Populate Contact Information
    if (contactDetailsContent) {
        contactDetailsContent.innerHTML = `
            <p><strong>Họ tên người liên hệ:</strong> <span id="contact-name">${customerInfo.contactPerson.fullName}</span></p>
            <p><strong>Email:</strong> <span id="contact-email">${customerInfo.contactPerson.email}</span></p>
            <p><strong>Số điện thoại:</strong> <span id="contact-phone">${customerInfo.contactPerson.phone}</span></p>
        `;
    }

    // Populate Passenger Information
    if (passengerDetailsContent) {
        passengerDetailsContent.innerHTML = customerInfo.passengers.map((passenger, index) => `
            <div class="passenger-info">
                <p><strong>Hành khách ${index + 1} (${passenger.type === 'adult' ? 'Người lớn' : passenger.type === 'child' ? 'Trẻ em' : 'Em bé'}):</strong> <span class="passenger-name">${passenger.fullName}</span></p>
                <p><strong>Giới tính:</strong> ${passenger.gender === 'male' ? 'Nam' : 'Nữ'}</p>
                <p><strong>Ngày sinh:</strong> ${formatDate(passenger.dob)}</p>
                <p><strong>CCCD/Hộ chiếu:</strong> ${passenger.idNumber}</p>
            </div>
        `).join('');
    }

    // Populate Price Summary
    if (priceDetailsContent) {
        const calculatedTotalPriceFromStorage = parseFloat(sessionStorage.getItem('calculatedTotalPrice')) || 0;
        const pricingDetailsJSON = sessionStorage.getItem('pricingDetails');
        let pricingDetails = null;
        
        try {
            if (pricingDetailsJSON) {
                pricingDetails = JSON.parse(pricingDetailsJSON);
            }
        } catch (e) {
            console.error('Error parsing pricing details:', e);
        }
        
        // Check if this is a round trip
        const isRoundTrip = !!selectedFlightData.returnFlight && !!selectedFlightData.returnDate;
        
        // Calculate base fares with detailed breakdown if available
        let baseFareHTML = '';
        let baseFareForAllPassengers = calculatedTotalPriceFromStorage;
        
        if (pricingDetails) {
            // For departure flight
            const departureSection = `<h4>CHI PHÍ CHUYẾN ĐI</h4>`;
            
            const departAdultTotal = pricingDetails.adultPrice * pricingDetails.numAdults;
            const departChildTotal = pricingDetails.childPrice * pricingDetails.numChildren;
            const departInfantTotal = pricingDetails.infantPrice * pricingDetails.numInfants;
            const departTotal = departAdultTotal + departChildTotal + departInfantTotal;
            
            baseFareHTML += departureSection;
            
            // Create detailed breakdown by passenger type for departure
            if (pricingDetails.numAdults > 0) {
                baseFareHTML += `<p>Người lớn (${pricingDetails.numAdults} x ${formatCurrency(pricingDetails.adultPrice)}): <span>${formatCurrency(departAdultTotal)}</span></p>`;
            }
            
            if (pricingDetails.numChildren > 0) {
                baseFareHTML += `<p>Trẻ em (${pricingDetails.numChildren} x ${formatCurrency(pricingDetails.childPrice)}): <span>${formatCurrency(departChildTotal)}</span></p>`;
            }
            
            if (pricingDetails.numInfants > 0) {
                baseFareHTML += `<p>Em bé (${pricingDetails.numInfants} x ${formatCurrency(pricingDetails.infantPrice)}): <span>${formatCurrency(departInfantTotal)}</span></p>`;
            }
            
            // If round trip, add return flight costs
            let returnTotal = 0;
            if (isRoundTrip) {
                const returnSection = `<h4>CHI PHÍ CHUYẾN VỀ</h4>`;
                baseFareHTML += returnSection;
                
                const returnFlight = selectedFlightData.returnFlight;
                const returnBaseSeatPrice = getPriceForSeatClass(returnFlight, returnFlight.seatClass);
                const returnAdultPrice = returnBaseSeatPrice * getPriceMultiplierForPassengerType('adult');
                const returnChildPrice = returnBaseSeatPrice * getPriceMultiplierForPassengerType('child');
                const returnInfantPrice = returnBaseSeatPrice * getPriceMultiplierForPassengerType('infant');
                
                const returnAdultTotal = returnAdultPrice * pricingDetails.numAdults;
                const returnChildTotal = returnChildPrice * pricingDetails.numChildren;
                const returnInfantTotal = returnInfantPrice * pricingDetails.numInfants;
                returnTotal = returnAdultTotal + returnChildTotal + returnInfantTotal;
                
                // Create detailed breakdown by passenger type for return
                if (pricingDetails.numAdults > 0) {
                    baseFareHTML += `<p>Người lớn (${pricingDetails.numAdults} x ${formatCurrency(returnAdultPrice)}): <span>${formatCurrency(returnAdultTotal)}</span></p>`;
                }
                
                if (pricingDetails.numChildren > 0) {
                    baseFareHTML += `<p>Trẻ em (${pricingDetails.numChildren} x ${formatCurrency(returnChildPrice)}): <span>${formatCurrency(returnChildTotal)}</span></p>`;
                }
                
                if (pricingDetails.numInfants > 0) {
                    baseFareHTML += `<p>Em bé (${pricingDetails.numInfants} x ${formatCurrency(returnInfantPrice)}): <span>${formatCurrency(returnInfantTotal)}</span></p>`;
                }
            }
            
            baseFareForAllPassengers = departTotal + (isRoundTrip ? returnTotal : 0);
            baseFareHTML += `<p><strong>Tổng giá vé cơ bản: <span>${formatCurrency(baseFareForAllPassengers)}</span></strong></p>`;
            
        } else {
            // Fallback to simple display if no detailed pricing is available
            baseFareHTML = `<p>Giá vé cơ bản (${passengerCountString}): <span id="base-fare">${formatCurrency(baseFareForAllPassengers)}</span></p>`;
        }

        const taxesAndFees = baseFareForAllPassengers * 0.1; // Assuming 10% tax for now
        
        let servicesCost = 0;
        let servicesHTML = '';

        const servicePrices = {
            food: 150000,
            luggage: 200000,
            insurance: 100000
        };

        if (selectedServices.food) {
            servicesCost += servicePrices.food;
            servicesHTML += `<p>Suất ăn đặc biệt: <span id="service-food-fee">${formatCurrency(servicePrices.food)}</span></p>`;
        }
        if (selectedServices.luggage) {
            servicesCost += servicePrices.luggage;
            servicesHTML += `<p>Hành lý ký gửi thêm: <span id="service-luggage-fee">${formatCurrency(servicePrices.luggage)}</span></p>`;
        }
        if (selectedServices.insurance) {
            servicesCost += servicePrices.insurance;
            servicesHTML += `<p>Bảo hiểm du lịch: <span id="service-insurance-fee">${formatCurrency(servicePrices.insurance)}</span></p>`;
        }

        const finalTotal = baseFareForAllPassengers + taxesAndFees + servicesCost;

        priceDetailsContent.innerHTML = `
            ${baseFareHTML}
            <hr>
            <p>Thuế và phí (10%): <span id="taxes-fees">${formatCurrency(taxesAndFees)}</span></p>
            ${servicesHTML}
            <hr>
            <p class="total-price"><strong>Tổng cộng: <span id="total-price-value">${formatCurrency(finalTotal)}</span></strong></p>
        `;
        
        // Save final calculated total price to sessionStorage for payment page
        sessionStorage.setItem('totalPriceForPayment', finalTotal);
    }
    
    // Handle confirm button
    const confirmButton = document.getElementById('confirm-booking');
    if (confirmButton) {
        confirmButton.addEventListener('click', function() {
            // Prepare booking data for API
            const selectedFlightData = JSON.parse(sessionStorage.getItem('selectedFlight'));
            const customerInfo = JSON.parse(sessionStorage.getItem('customerInfo'));
            const passengersArray = customerInfo.passengers || [];
            const selectedServicesJSON = sessionStorage.getItem('selectedServices');
            const selectedServices = selectedServicesJSON ? JSON.parse(selectedServicesJSON) : { food: false, luggage: false, insurance: false };
            const promoCode = sessionStorage.getItem('promoCode') || '';
            
            // Check if this is a round trip
            const isRoundTrip = !!selectedFlightData.returnFlight && !!selectedFlightData.returnDate;
            
            const bookingData = {
                departureFlightId: selectedFlightData.id || selectedFlightData.flight_id,
                returnFlightId: isRoundTrip ? (selectedFlightData.returnFlight.id || selectedFlightData.returnFlight.flight_id) : null,
                customerInfo: {
                    fullName: customerInfo.contactPerson ? customerInfo.contactPerson.fullName : customerInfo.fullName,
                    email: customerInfo.contactPerson ? customerInfo.contactPerson.email : customerInfo.email,
                    phone: customerInfo.contactPerson ? customerInfo.contactPerson.phone : customerInfo.phone,
                    seatClass: selectedFlightData.seatClass || 'ECONOMY'
                },
                passengers: passengersArray,
                selectedServices: selectedServices,
                promoCode: promoCode
            };
            
            // Store booking data in sessionStorage for payment page
            sessionStorage.setItem('bookingData', JSON.stringify(bookingData));
            
            // Redirect to payment page
            window.location.href = 'payment.html';
        });
    }
}

// Load payment page
function loadPaymentPage() {
    console.log("Loading payment page...");
    // Get total price from sessionStorage (this should be the final calculated one)
    const totalPriceForPayment = parseFloat(sessionStorage.getItem('totalPriceForPayment')) || 0;
    if (!totalPriceForPayment) {
        // Fallback or redirect if price not found
        const pricingDetailsJSON = sessionStorage.getItem('pricingDetails');
        const calculatedTotalPrice = parseFloat(sessionStorage.getItem('calculatedTotalPrice')) || 0;
        
        if (calculatedTotalPrice > 0) {
            // Calculate with taxes
            const totalWithTaxes = calculatedTotalPrice * 1.1; // Base + 10% tax
            sessionStorage.setItem('totalPriceForPayment', totalWithTaxes);
            window.location.reload(); // Reload to recalculate
            return;
        }
        
        const selectedFlightData = JSON.parse(sessionStorage.getItem('selectedFlight'));
        if (selectedFlightData && selectedFlightData.finalPrice) {
             // This is a fallback, ideally totalPriceForPayment should always be set
            sessionStorage.setItem('totalPriceForPayment', selectedFlightData.finalPrice * 1.1);
            window.location.reload(); // Reload to recalculate if possible
            return;
        }
        window.location.href = '../../index.html'; // Corrected path
        return;
    }
    
    // Get selected flight and customer info for order summary
    const selectedFlightData = JSON.parse(sessionStorage.getItem('selectedFlight'));
    const customerInfo = JSON.parse(sessionStorage.getItem('customerInfo'));
    const selectedServices = JSON.parse(sessionStorage.getItem('selectedServices')) || {};
    const displaySeatClassNameOnPayment = sessionStorage.getItem('displaySeatClassName') || (selectedFlightData ? getSeatClassName(selectedFlightData.seatClass) : 'Phổ thông');

    // Make sure we have the meal property synchronized with food
    if (selectedServices.food === true && selectedServices.meal === undefined) {
        selectedServices.meal = true;
        sessionStorage.setItem('selectedServices', JSON.stringify(selectedServices));
    }

    const numAdults = selectedFlightData ? (parseInt(selectedFlightData.adults) || 0) : 0;
    const numChildren = selectedFlightData ? (parseInt(selectedFlightData.children) || 0) : 0;
    const numInfants = selectedFlightData ? (parseInt(selectedFlightData.infants) || 0) : 0;
    const passengerCountString = `${numAdults} người lớn${numChildren > 0 ? `, ${numChildren} trẻ em` : ''}${numInfants > 0 ? `, ${numInfants} em bé` : ''}`;

    // Display order summary
    const orderSummary = document.getElementById('order-summary');
    if (orderSummary && selectedFlightData && customerInfo) {
        orderSummary.innerHTML = `
            <div class="summary-item">
                <span>Chuyến bay:</span>
                <span>${selectedFlightData.airline} (${selectedFlightData.id})</span>
            </div>
            <div class="summary-item">
                <span>Hành trình:</span>
                <span>${selectedFlightData.departure} → ${selectedFlightData.destination}</span>
            </div>
            <div class="summary-item">
                <span>Ngày bay:</span>
                <span>${formatDate(selectedFlightData.departDate)}</span>
            </div>
            <div class="summary-item">
                <span>Hạng ghế:</span>
                <span>${displaySeatClassNameOnPayment}</span>
            </div>
            <div class="summary-item">
                <span>Số hành khách:</span>
                <span>${passengerCountString}</span>
            </div>
            <div class="summary-item total">
                <span>Tổng thanh toán:</span>
                <span>${formatCurrency(totalPriceForPayment)}</span>
            </div>
        `;
    }
    
    // Display amount to be paid
    const paymentAmount = document.getElementById('payment-amount');
    if (paymentAmount) {
        paymentAmount.textContent = formatCurrency(totalPriceForPayment);
    }
    
    // Handle payment method switching
    const methodTabs = document.querySelectorAll('.method-tab');
    const paymentForms = document.querySelectorAll('.payment-form');
    
    if (methodTabs.length > 0) {
        methodTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const method = this.getAttribute('data-method');
                
                // Hide all forms
                paymentForms.forEach(form => {
                    form.style.display = 'none';
                });
                
                // Show selected form
                const selectedForm = document.getElementById(`${method}-form`);
                if (selectedForm) {
                    selectedForm.style.display = 'block';
                }
                
                // Update active tab
                methodTabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
            });
        });
    }
    
    // Form validation and formatting
    setupCreditCardValidation();
    setupBankTransferForm();
    setupEWalletForm();
    setupMomoForm();
    
    // Add promotion code field
    addPromotionCodeField();
    
    // Handle payment form submission
    const paymentForm = document.getElementById('payment-form');
    if (paymentForm) {
        paymentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get active payment method
            const activeMethod = document.querySelector('.method-tab.active').getAttribute('data-method');
            
            // Validate based on payment method
            if (validatePaymentForm(activeMethod)) {
                // Show loading state
                const submitBtn = document.querySelector('.btn-payment');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
                }
                
                // Get promo code if entered
                const promoCodeInput = document.getElementById('promo-code');
                let promoCode = promoCodeInput ? promoCodeInput.value.trim() : '';
                
                // If no promo code entered, check if one was previously applied and stored in sessionStorage
                if (!promoCode && sessionStorage.getItem('appliedPromoCode')) {
                    promoCode = sessionStorage.getItem('appliedPromoCode');
                }
                
                // Prepare booking data
                const bookingData = {
                    flightId: selectedFlightData.id,
                    customerInfo: {
                        fullName: customerInfo.contactPerson.fullName,
                        email: customerInfo.contactPerson.email,
                        phone: customerInfo.contactPerson.phone,
                        seatClass: selectedFlightData.seatClass || 'ECONOMY'
                    },
                    passengers: customerInfo.passengers.map(passenger => ({
                        fullName: passenger.fullName,
                        gender: passenger.gender,
                        dob: passenger.dob,
                        idNumber: passenger.idNumber,
                        type: passenger.type
                    })),
                    selectedServices: selectedServices,
                    promoCode: promoCode || null
                };
                
                // Save booking to database via API
                fetch(`${API_BASE_URL}/bookings`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(bookingData)
                })
                .then(response => {
                    if (!response.ok) {
                        // Parse the error message from the response
                        return response.json().then(errorData => {
                            if (errorData.error === 'Not enough seats available') {
                                throw new Error(`Không đủ chỗ ngồi trống. Hiện tại chỉ còn ${errorData.available} chỗ trống cho ${errorData.requested} hành khách.`);
                            } else {
                                throw new Error(errorData.error || 'Network response was not ok');
                            }
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Booking created successfully:', data);
                    
                    // Save booking details to sessionStorage
                    sessionStorage.setItem('bookingNumber', data.bookingNumber);
                    sessionStorage.setItem('bookingId', data.bookingId);
                    sessionStorage.setItem('paymentMethod', activeMethod);
                    sessionStorage.setItem('paymentDate', new Date().toISOString());
                    
                    // Redirect to success page or waiting page based on API response
                    if (data.redirectUrl) {
                        // Handle redirect URL - ensure it's properly formed
                        // If it starts with http or / it's an absolute URL, otherwise it's relative to current path
                        if (data.redirectUrl.startsWith('http') || data.redirectUrl.startsWith('/')) {
                            window.location.href = data.redirectUrl;
                        } else {
                            // For relative URLs, make sure we're in the right directory
                            // Check if we're already in assets/pages
                            if (window.location.pathname.includes('assets/pages/')) {
                                window.location.href = data.redirectUrl;
                            } else {
                                window.location.href = `assets/pages/${data.redirectUrl}`;
                            }
                        }
                    } else {
                    // Update payment status in database
                    return fetch(`${API_BASE_URL}/bookings/${data.bookingId}/payment`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            paymentStatus: 'paid'
                        })
                    });
                    }
                })
                .then(response => {
                    if (response && !response.ok) {
                        console.warn('Payment status update failed, but continuing with booking process');
                    }
                    // Redirect to success page if we haven't already redirected
                    if (!window.location.href.includes('payment-waiting.html')) {
                    window.location.href = 'payment-success.html';
                    }
                })
                .catch(error => {
                    console.error('Error creating booking:', error);
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Xác nhận thanh toán';
                    alert(error.message || 'Có lỗi xảy ra khi xử lý thanh toán. Vui lòng thử lại sau.');
                });
            }
        });
    }
}

// Add promotion code field to payment form
function addPromotionCodeField() {
    const paymentForm = document.getElementById('payment-form');
    if (!paymentForm) return;
    
    // Check if promo code field already exists
    if (document.getElementById('promo-code-container')) return;
    
    const promoContainer = document.createElement('div');
    promoContainer.id = 'promo-code-container';
    promoContainer.className = 'promo-code-container';
    promoContainer.innerHTML = `
        <div class="form-group">
            <label for="promo-code">Mã khuyến mãi (nếu có)</label>
            <div class="promo-input-group">
                <input type="text" id="promo-code" name="promo-code" placeholder="Nhập mã khuyến mãi">
                <button type="button" id="apply-promo" class="btn-apply-promo">Áp dụng</button>
            </div>
            <div id="promo-message" class="promo-message"></div>
        </div>
    `;
    
    // Find position to insert promo code field (before submit button or after order summary)
    const submitButton = paymentForm.querySelector('.btn-payment');
    const insertBeforeElement = submitButton ? submitButton.closest('.action-buttons') : null;
    
    if (insertBeforeElement) {
        paymentForm.insertBefore(promoContainer, insertBeforeElement);
    } else {
        // Fallback if action-buttons not found
        paymentForm.appendChild(promoContainer);
    }
    
    // Add event listener to apply promo button
    const applyPromoButton = document.getElementById('apply-promo');
    if (applyPromoButton) {
        applyPromoButton.addEventListener('click', validatePromoCode);
    }
    
    // Add some styles for promotion code
    const style = document.createElement('style');
    style.textContent = `
        .promo-code-container {
            margin: 20px 0;
        }
        
        .promo-input-group {
            display: flex;
            gap: 10px;
        }
        
        .promo-input-group input {
            flex: 1;
            padding: 10px;
            border: 1px solid #ced4da;
            border-radius: 4px;
        }
        
        .btn-apply-promo {
            background-color: #6c757d;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 10px 15px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .btn-apply-promo:hover {
            background-color: #5a6268;
        }
        
        .promo-message {
            margin-top: 8px;
            font-size: 14px;
        }
        
        .promo-message.success {
            color: #28a745;
        }
        
        .promo-message.error {
            color: #dc3545;
        }
    `;
    document.head.appendChild(style);
}

// Validate promotion code
function validatePromoCode() {
    const promoCode = document.getElementById('promo-code').value.trim();
    const promoMessage = document.getElementById('promo-message');
    
    if (!promoCode) {
        promoMessage.innerHTML = '<span class="error">Vui lòng nhập mã khuyến mãi</span>';
        promoMessage.className = 'promo-message error';
        return;
    }
    
    // Show loading message
    promoMessage.innerHTML = 'Đang kiểm tra mã khuyến mãi...';
    promoMessage.className = 'promo-message';
    
    // Validate promo code via API
    fetch(`${API_BASE_URL}/promotions/validate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: promoCode })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Invalid promotion code');
        }
        return response.json();
    })
    .then(data => {
        if (data.valid) {
            const totalPriceForPayment = parseFloat(sessionStorage.getItem('totalPriceForPayment')) || 0;
            let discount = 0;
            
            if (data.promo.discountType === 'percent') {
                discount = totalPriceForPayment * (data.promo.discountValue / 100);
            } else {
                discount = data.promo.discountValue;
            }
            
            const discountedPrice = totalPriceForPayment - discount;
            
            // Update displayed price
            const paymentAmount = document.getElementById('payment-amount');
            if (paymentAmount) {
                paymentAmount.innerHTML = `
                    <span style="text-decoration: line-through; color: #888; font-size: 0.9em;">${formatCurrency(totalPriceForPayment)}</span>
                    ${formatCurrency(discountedPrice)}
                `;
            }
            
            // Update order summary if it exists
            const orderSummaryTotal = document.querySelector('.summary-item.total span:last-child');
            if (orderSummaryTotal) {
                orderSummaryTotal.innerHTML = `
                    <span style="text-decoration: line-through; color: #888; font-size: 0.9em;">${formatCurrency(totalPriceForPayment)}</span>
                    ${formatCurrency(discountedPrice)}
                `;
            }
            
            // Show success message
            promoMessage.innerHTML = `<span class="success">Mã giảm giá đã được áp dụng: ${formatCurrency(discount)}</span>`;
            promoMessage.className = 'promo-message success';
            
            // Update the total price for payment
            sessionStorage.setItem('discountedTotalPrice', discountedPrice);
            sessionStorage.setItem('appliedDiscount', discount);
            sessionStorage.setItem('finalPriceAfterDiscount', discountedPrice);
            sessionStorage.setItem('appliedPromoCode', promoCode);
        } else {
            promoMessage.innerHTML = '<span class="error">Mã khuyến mãi không hợp lệ</span>';
            promoMessage.className = 'promo-message error';
        }
    })
    .catch(error => {
        console.error('Error validating promo code:', error);
        promoMessage.innerHTML = '<span class="error">Mã khuyến mãi không hợp lệ hoặc đã hết hạn</span>';
        promoMessage.className = 'promo-message error';
    });
}

// Credit card validation and formatting
function setupCreditCardValidation() {
    const cardNumber = document.getElementById('card-number');
    const expiryDate = document.getElementById('expiry-date');
    const cvv = document.getElementById('cvv');
    
    if (cardNumber) {
        // Format card number with spaces
        cardNumber.addEventListener('input', function() {
            let value = this.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
            if (value.length > 16) value = value.substr(0, 16);
            
            let formattedValue = '';
            for (let i = 0; i < value.length; i++) {
                if (i > 0 && i % 4 === 0) formattedValue += ' ';
                formattedValue += value[i];
            }
            
            this.value = formattedValue;
        });
    }
    
    if (expiryDate) {
        // Format expiry date (MM/YY)
        expiryDate.addEventListener('input', function() {
            let value = this.value.replace(/\D/g, '');
            if (value.length > 4) value = value.substr(0, 4);
            
            if (value.length > 2) {
                this.value = value.substring(0, 2) + '/' + value.substring(2);
            } else {
                this.value = value;
            }
            
            // Validate month
            if (value.length >= 2) {
                const month = parseInt(value.substring(0, 2));
                if (month < 1 || month > 12) {
                    this.setCustomValidity('Tháng không hợp lệ');
                } else {
                    this.setCustomValidity('');
                }
            }
        });
    }
    
    if (cvv) {
        // Allow only 3-4 digits for CVV
        cvv.addEventListener('input', function() {
            let value = this.value.replace(/\D/g, '');
            if (value.length > 4) value = value.substr(0, 4);
            this.value = value;
        });
    }
}

// Bank transfer form setup
function setupBankTransferForm() {
    const bankTransferForm = document.getElementById('bank-transfer-form');
    if (!bankTransferForm) {
        // Create bank transfer form if it doesn't exist
        const paymentMethods = document.querySelector('.payment-methods');
        if (paymentMethods) {
            const form = document.createElement('div');
            form.className = 'payment-form';
            form.id = 'bank-transfer-form';
            form.style.display = 'none';
            
            form.innerHTML = `
                <div class="bank-details">
                    <h4>Thông tin chuyển khoản</h4>
                    <p>Vui lòng chuyển khoản theo thông tin dưới đây:</p>
                    
                    <div class="bank-info">
                        <p><strong>Ngân hàng:</strong> VietComBank</p>
                        <p><strong>Số tài khoản:</strong> 1234567890</p>
                        <p><strong>Chủ tài khoản:</strong> CÔNG TY TNHH FLYVIET</p>
                        <p><strong>Nội dung chuyển khoản:</strong> FLYVIET [Số điện thoại của bạn]</p>
                    </div>
                    
                    <div class="transfer-notice">
                        <p><i class="fas fa-info-circle"></i> Sau khi chuyển khoản, vui lòng nhập thông tin bên dưới và nhấn "Xác nhận thanh toán".</p>
                    </div>
                    
                    <form id="bank-transfer-confirmation">
                        <div class="form-group">
                            <label for="transfer-amount" class="required">Số tiền đã chuyển</label>
                            <input type="text" id="transfer-amount" name="transfer-amount" required>
                        </div>
                        <div class="form-group">
                            <label for="transfer-date" class="required">Ngày chuyển khoản</label>
                            <input type="date" id="transfer-date" name="transfer-date" required>
                        </div>
                        <div class="form-group">
                            <label for="transfer-name" class="required">Tên người chuyển</label>
                            <input type="text" id="transfer-name" name="transfer-name" required>
                        </div>
                        <div class="form-group">
                            <label for="transfer-reference">Mã giao dịch (nếu có)</label>
                            <input type="text" id="transfer-reference" name="transfer-reference">
                        </div>
                        
                        <div class="action-buttons">
                            <a href="booking-confirmation.html" class="btn-back">Quay lại</a>
                            <button type="submit" class="btn-payment">Xác nhận thanh toán</button>
                        </div>
                    </form>
                </div>
            `;
            
            paymentMethods.appendChild(form);
            
            // Handle bank transfer form submission
            const bankTransferConfirmation = document.getElementById('bank-transfer-confirmation');
            if (bankTransferConfirmation) {
                bankTransferConfirmation.addEventListener('submit', function(e) {
                    e.preventDefault();
                    
                    const transferAmount = document.getElementById('transfer-amount').value;
                    const transferDate = document.getElementById('transfer-date').value;
                    const transferName = document.getElementById('transfer-name').value;
                    
                    if (!transferAmount || !transferDate || !transferName) {
                        alert('Vui lòng điền đầy đủ thông tin chuyển khoản.');
                        return;
                    }
                    
                    // Save transfer details
                    sessionStorage.setItem('transferDetails', JSON.stringify({
                        amount: transferAmount,
                        date: transferDate,
                        name: transferName,
                        reference: document.getElementById('transfer-reference').value || 'N/A'
                    }));
                    
                    // Create a booking number
                    const bookingNumber = generateBookingNumber();
                    
                    // Save booking details
                    sessionStorage.setItem('bookingNumber', bookingNumber);
                    sessionStorage.setItem('paymentMethod', 'bank-transfer');
                    sessionStorage.setItem('paymentDate', new Date().toISOString());
                    sessionStorage.setItem('paymentStatus', 'pending');
                    
                    // Show loading state
                    const submitBtn = document.querySelector('#bank-transfer-confirmation .btn-payment');
                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
                    }
                    
                    // Redirect after short delay
                    setTimeout(() => {
                        window.location.href = 'payment-success.html';
                    }, 2000);
                });
            }
        }
    }
}

// E-wallet form setup
function setupEWalletForm() {
    const eWalletForm = document.getElementById('e-wallet-form');
    if (!eWalletForm) {
        // Create e-wallet form if it doesn't exist
        const paymentMethods = document.querySelector('.payment-methods');
        if (paymentMethods) {
            const form = document.createElement('div');
            form.className = 'payment-form';
            form.id = 'e-wallet-form';
            form.style.display = 'none';
            
            form.innerHTML = `
                <div class="e-wallet-options">
                    <h4>Chọn ví điện tử</h4>
                    <div class="wallet-options">
                        <div class="wallet-option">
                            <input type="radio" id="zalopay" name="wallet" value="zalopay">
                            <label for="zalopay">
                                <img src="https://via.placeholder.com/80x40?text=ZaloPay" alt="ZaloPay">
                                <span>ZaloPay</span>
                            </label>
                        </div>
                        <div class="wallet-option">
                            <input type="radio" id="vnpay" name="wallet" value="vnpay">
                            <label for="vnpay">
                                <img src="https://via.placeholder.com/80x40?text=VNPAY" alt="VNPAY">
                                <span>VNPAY</span>
                            </label>
                        </div>
                        <div class="wallet-option">
                            <input type="radio" id="airpay" name="wallet" value="airpay">
                            <label for="airpay">
                                <img src="https://via.placeholder.com/80x40?text=ShopeePay" alt="ShopeePay">
                                <span>ShopeePay</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="wallet-instructions">
                        <p>Sau khi chọn "Tiếp tục", bạn sẽ được chuyển đến trang thanh toán của ví điện tử.</p>
                    </div>
                    
                    <div class="action-buttons">
                        <a href="booking-confirmation.html" class="btn-back">Quay lại</a>
                        <button type="button" id="wallet-continue" class="btn-payment">Tiếp tục</button>
                    </div>
                </div>
            `;
            
            paymentMethods.appendChild(form);
            
            // Add style for wallet options
            const style = document.createElement('style');
            style.textContent = `
                .wallet-options {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 20px;
                    margin: 20px 0;
                }
                
                .wallet-option {
                    flex: 1;
                    min-width: 150px;
                    text-align: center;
                }
                
                .wallet-option input {
                    display: none;
                }
                
                .wallet-option label {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 15px;
                    border: 1px solid #dee2e6;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .wallet-option label:hover {
                    border-color: #0d6efd;
                }
                
                .wallet-option input:checked + label {
                    border-color: #0d6efd;
                    background-color: rgba(13, 110, 253, 0.05);
                }
                
                .wallet-option img {
                    margin-bottom: 10px;
                }
                
                .wallet-instructions {
                    margin: 20px 0;
                    padding: 15px;
                    background-color: #f8f9fa;
                    border-radius: 4px;
                }
            `;
            document.head.appendChild(style);
            
            // Handle e-wallet selection
            const walletContinue = document.getElementById('wallet-continue');
            if (walletContinue) {
                walletContinue.addEventListener('click', function() {
                    const selectedWallet = document.querySelector('input[name="wallet"]:checked');
                    if (!selectedWallet) {
                        alert('Vui lòng chọn ví điện tử.');
                        return;
                    }
                    
                    // Save wallet selection
                    sessionStorage.setItem('paymentMethod', 'e-wallet');
                    sessionStorage.setItem('walletProvider', selectedWallet.value);
                    
                    // Create a booking number
                    const bookingNumber = generateBookingNumber();
                    sessionStorage.setItem('bookingNumber', bookingNumber);
                    sessionStorage.setItem('paymentDate', new Date().toISOString());
                    
                    // Show loading state
                    walletContinue.disabled = true;
                    walletContinue.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang chuyển hướng...';
                    
                    // Redirect after short delay
                    setTimeout(() => {
                        // In a real application, this would redirect to the e-wallet's payment page
                        window.location.href = 'payment-success.html';
                    }, 2000);
                });
            }
        }
    }
}

// MoMo form setup
function setupMomoForm() {
    const momoForm = document.getElementById('momo-form');
    if (!momoForm) {
        // Create MoMo form if it doesn't exist
        const paymentMethods = document.querySelector('.payment-methods');
        if (paymentMethods) {
            const form = document.createElement('div');
            form.className = 'payment-form';
            form.id = 'momo-form';
            form.style.display = 'none';
            
            form.innerHTML = `
                <div class="momo-payment">
                    <h4>Thanh toán bằng MoMo</h4>
                    <div class="momo-qr">
                        <div class="qr-code">
                            <img src="https://via.placeholder.com/200x200?text=MoMo+QR" alt="MoMo QR Code">
                        </div>
                        <div class="qr-instructions">
                            <p>1. Mở ứng dụng MoMo trên điện thoại</p>
                            <p>2. Chọn "Quét mã" và quét mã QR</p>
                            <p>3. Xác nhận thanh toán trên ứng dụng</p>
                            <p>4. Nhấn "Đã thanh toán" sau khi hoàn tất</p>
                        </div>
                    </div>
                    
                    <div class="momo-phone">
                        <h4>Hoặc nhập số điện thoại đăng ký MoMo</h4>
                        <div class="form-group">
                            <label for="momo-phone" class="required">Số điện thoại</label>
                            <input type="tel" id="momo-phone" name="momo-phone" placeholder="0901234567" required>
                        </div>
                    </div>
                    
                    <div class="action-buttons">
                        <a href="booking-confirmation.html" class="btn-back">Quay lại</a>
                        <button type="button" id="momo-paid" class="btn-payment">Đã thanh toán</button>
                    </div>
                </div>
            `;
            
            paymentMethods.appendChild(form);
            
            // Add style for MoMo form
            const style = document.createElement('style');
            style.textContent = `
                .momo-qr {
                    display: flex;
                    align-items: center;
                    gap: 30px;
                    margin: 30px 0;
                    padding: 20px;
                    background-color: #f8f9fa;
                    border-radius: 8px;
                }
                
                .qr-code {
                    text-align: center;
                }
                
                .qr-instructions p {
                    margin-bottom: 10px;
                }
                
                .momo-phone {
                    margin: 30px 0;
                }
                
                @media (max-width: 768px) {
                    .momo-qr {
                        flex-direction: column;
                    }
                }
            `;
            document.head.appendChild(style);
            
            // Handle MoMo payment confirmation
            const momoPaid = document.getElementById('momo-paid');
            if (momoPaid) {
                momoPaid.addEventListener('click', function() {
                    const momoPhone = document.getElementById('momo-phone').value;
                    if (!momoPhone || momoPhone.length < 10) {
                        alert('Vui lòng nhập số điện thoại hợp lệ.');
                        return;
                    }
                    
                    // Log available keys in sessionStorage for debugging
                    console.log("Các key có trong sessionStorage:", Object.keys(sessionStorage));
                    
                    // Get booking data from payment page itself
                    const bookingDataStr = sessionStorage.getItem('bookingData');
                    if (bookingDataStr) {
                        console.log("Có dữ liệu bookingData:", bookingDataStr);
                        try {
                            const bookingData = JSON.parse(bookingDataStr);
                            
                            // Show loading state
                            momoPaid.disabled = true;
                            momoPaid.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xác nhận...';
                            
                            // Save booking to database via API
                            fetch(`${API_BASE_URL}/bookings`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: bookingDataStr
                            })
                            .then(response => {
                                if (!response.ok) {
                                    // Parse the error message from the response
                                    return response.json().then(errorData => {
                                        if (errorData.error === 'Not enough seats available') {
                                            throw new Error(`Không đủ chỗ ngồi trống. Hiện tại chỉ còn ${errorData.available} chỗ trống cho ${errorData.requested} hành khách.`);
                                        } else {
                                            throw new Error(errorData.error || 'Không thể tạo đơn đặt vé');
                                        }
                                    });
                                }
                                return response.json();
                            })
                            .then(data => {
                                console.log('Booking created successfully:', data);
                                
                                // Save booking details to sessionStorage
                                sessionStorage.setItem('bookingNumber', data.bookingNumber);
                                sessionStorage.setItem('bookingId', data.bookingId);
                                sessionStorage.setItem('paymentMethod', 'momo');
                                sessionStorage.setItem('momoPhone', momoPhone);
                                sessionStorage.setItem('paymentDate', new Date().toISOString());
                                
                                // Update payment status to paid
                                return fetch(`${API_BASE_URL}/bookings/${data.bookingId}/payment`, {
                                    method: 'PATCH',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        paymentStatus: 'paid'
                                    })
                                });
                            })
                            .then(response => {
                                if (!response.ok) {
                                    console.warn('Payment status update failed, but continuing with payment process');
                                }
                                
                                // Redirect to waiting page or success page based on API response
                                if (sessionStorage.getItem('bookingId')) {
                                    const bookingId = sessionStorage.getItem('bookingId');
                                    window.location.href = `payment-waiting.html?booking_id=${bookingId}`;
                                } else {
                                    window.location.href = 'payment-success.html';
                                }
                            })
                            .catch(error => {
                                console.error('Error during payment processing:', error);
                                momoPaid.disabled = false;
                                momoPaid.innerHTML = 'Xác nhận đã thanh toán';
                                alert('Có lỗi xảy ra khi xử lý thanh toán: ' + error.message);
                            });
                            return;
                        } catch (e) {
                            console.error("Lỗi khi parse bookingData:", e);
                        }
                    } else {
                        console.log("Không tìm thấy bookingData trong sessionStorage");
                    }
                    
                    // Try to recreate booking data from individual pieces if bookingData is not available
                    try {
                        console.log("Thử lại với từng dữ liệu riêng lẻ");
                        // Get selected flight and customer info
                        const selectedFlightDataStr = sessionStorage.getItem('selectedFlight');
                        const customerInfoStr = sessionStorage.getItem('customerInfo');
                        const selectedServicesStr = sessionStorage.getItem('selectedServices');
                        
                        console.log("selectedFlight:", selectedFlightDataStr);
                        console.log("customerInfo:", customerInfoStr);
                        
                        if (!selectedFlightDataStr || !customerInfoStr) {
                            throw new Error('Không tìm thấy thông tin cần thiết');
                        }
                        
                        const selectedFlightData = JSON.parse(selectedFlightDataStr);
                        const customerInfo = JSON.parse(customerInfoStr);
                        const selectedServices = selectedServicesStr ? JSON.parse(selectedServicesStr) : {};
                        const promoCode = document.getElementById('promo-code') ? document.getElementById('promo-code').value.trim() : '';
                        
                        // Prepare booking data
                        const bookingData = {
                            flightId: selectedFlightData.id || selectedFlightData.flight_id,
                            customerInfo: {
                                fullName: customerInfo.contactPerson ? customerInfo.contactPerson.fullName : customerInfo.fullName,
                                email: customerInfo.contactPerson ? customerInfo.contactPerson.email : customerInfo.email,
                                phone: customerInfo.contactPerson ? customerInfo.contactPerson.phone : customerInfo.phone,
                                seatClass: selectedFlightData.seatClass || 'ECONOMY'
                            },
                            passengers: customerInfo.passengers ? customerInfo.passengers.map(passenger => ({
                                fullName: passenger.fullName,
                                gender: passenger.gender,
                                dob: passenger.dob,
                                idNumber: passenger.idNumber || passenger.passport_number,
                                type: passenger.type || 'adult'
                            })) : [],
                            selectedServices: selectedServices,
                            promoCode: promoCode || null
                        };
                        
                        console.log("Dữ liệu đặt vé đã tạo:", bookingData);
                        
                        // Save MoMo details
                        sessionStorage.setItem('paymentMethod', 'momo');
                        sessionStorage.setItem('momoPhone', momoPhone);
                        
                        // Show loading state
                        momoPaid.disabled = true;
                        momoPaid.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xác nhận...';
                        
                        // Save booking to database via API
                        fetch(`${API_BASE_URL}/bookings`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(bookingData)
                        })
                        .then(response => {
                            if (!response.ok) {
                                throw new Error('Không thể tạo đơn đặt vé');
                            }
                            return response.json();
                        })
                        .then(data => {
                            console.log('Booking created successfully:', data);
                            
                            // Save booking details to sessionStorage
                            sessionStorage.setItem('bookingNumber', data.bookingNumber);
                            sessionStorage.setItem('bookingId', data.bookingId);
                            sessionStorage.setItem('paymentDate', new Date().toISOString());
                            
                            // Update payment status to paid
                            return fetch(`${API_BASE_URL}/bookings/${data.bookingId}/payment`, {
                                method: 'PATCH',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    paymentStatus: 'paid'
                                })
                            });
                        })
                        .then(response => {
                            if (!response.ok) {
                                console.warn('Payment status update failed, but continuing with payment process');
                            }
                            
                            // Redirect to waiting page or success page based on API response
                            if (sessionStorage.getItem('bookingId')) {
                                const bookingId = sessionStorage.getItem('bookingId');
                                window.location.href = `payment-waiting.html?booking_id=${bookingId}`;
                            } else {
                                window.location.href = 'payment-success.html';
                            }
                        })
                        .catch(error => {
                            console.error('Error during payment processing:', error);
                            momoPaid.disabled = false;
                            momoPaid.innerHTML = 'Xác nhận đã thanh toán';
                            alert('Có lỗi xảy ra khi xử lý thanh toán: ' + error.message);
                        });
                    } catch (error) {
                        console.error('Error preparing booking data:', error);
                        alert('Không tìm thấy hoặc không thể đọc thông tin đặt vé. Vui lòng thử lại hoặc quay lại trang đặt vé.');
                        momoPaid.disabled = false;
                    }
                });
            }
        }
    }
}

// Validate payment form based on method
function validatePaymentForm(method) {
    switch (method) {
        case 'credit-card':
            const cardName = document.getElementById('card-name');
            const cardNumber = document.getElementById('card-number');
            const expiryDate = document.getElementById('expiry-date');
            const cvv = document.getElementById('cvv');
            
            if (!cardName || !cardName.value.trim()) {
                alert('Vui lòng nhập tên chủ thẻ.');
                return false;
            }
            
            if (!cardNumber || cardNumber.value.replace(/\s/g, '').length < 16) {
                alert('Vui lòng nhập số thẻ hợp lệ.');
                return false;
            }
            
            if (!expiryDate || !expiryDate.value || expiryDate.value.length < 5) {
                alert('Vui lòng nhập ngày hết hạn hợp lệ.');
                return false;
            }
            
            if (!cvv || cvv.value.length < 3) {
                alert('Vui lòng nhập mã bảo mật hợp lệ.');
                return false;
            }
            
            return true;
            
        default:
            return true;
    }
}

// Generate booking number
function generateBookingNumber() {
    const timestamp = new Date().getTime().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `FV${timestamp}${random}`;
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return '';
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('vi-VN', options);
}

// Load ticket preview page
function loadTicketPreviewPage() {
    console.log("Loading ticket preview page...");
    const selectedFlightData = JSON.parse(sessionStorage.getItem('selectedFlight'));
    const customerInfo = JSON.parse(sessionStorage.getItem('customerInfo'));
    const bookingNumber = sessionStorage.getItem('bookingNumber'); // Assuming booking number is set after payment

    if (!selectedFlightData || !customerInfo) {
        alert('Không tìm thấy thông tin đặt vé. Vui lòng thử lại.');
        window.location.href = '../../index.html'; // Corrected path
        return;
    }

    // Populate Airline and Flight Info
    const airlineLogoEl = document.querySelector('.ticket-airline-logo img');
    const airlineNameEl = document.querySelector('.ticket-airline-name');
    const flightNumberEl = document.querySelector('.ticket-flight-number');
    const bookingRefEl = document.querySelector('.ticket-booking-reference strong');

    if (airlineLogoEl) {
        let logoSrc = `../images/Vietnam-Airlines.jpg`; // Default or placeholder
        if (selectedFlightData.airlineCode === 'VJ') {
            logoSrc = '../images/vietjet-air.jpg';
        } else if (selectedFlightData.airlineCode === 'VN') {
            logoSrc = '../images/Vietnam-Airlines.jpg';
        } else if (selectedFlightData.airlineCode === 'BL') {
            logoSrc = '../images/JETSTAR.jpg';
        } else if (selectedFlightData.airlineCode === 'QH') {
            logoSrc = '../images/BambooAirways.png';
        }
        airlineLogoEl.src = logoSrc;
        airlineLogoEl.alt = selectedFlightData.airline;
    }
    if (airlineNameEl) airlineNameEl.textContent = selectedFlightData.airline;
    if (flightNumberEl) flightNumberEl.textContent = `Chuyến bay: ${selectedFlightData.id}`;
    if (bookingRefEl) bookingRefEl.textContent = bookingNumber || 'N/A'; // Display booking number

    // Populate Route Info
    const departureAirportCodeEl = document.querySelector('.flight-route .airport:first-child .airport-code');
    const departureAirportNameEl = document.querySelector('.flight-route .airport:first-child .airport-name');
    const arrivalAirportCodeEl = document.querySelector('.flight-route .airport:last-child .airport-code');
    const arrivalAirportNameEl = document.querySelector('.flight-route .airport:last-child .airport-name');

    if (departureAirportCodeEl) departureAirportCodeEl.textContent = selectedFlightData.departure;
    if (departureAirportNameEl) departureAirportNameEl.textContent = getAirportName(selectedFlightData.departure);
    if (arrivalAirportCodeEl) arrivalAirportCodeEl.textContent = selectedFlightData.destination;
    if (arrivalAirportNameEl) arrivalAirportNameEl.textContent = getAirportName(selectedFlightData.destination);

    // Populate Flight Details (Date, Time, Class)
    const flightDateEl = document.querySelector('.flight-details .flight-detail:nth-child(1) .detail-value');
    const departureTimeEl = document.querySelector('.flight-details .flight-detail:nth-child(2) .detail-value');
    const arrivalTimeEl = document.querySelector('.flight-details .flight-detail:nth-child(3) .detail-value');
    // Gate and Seat are usually assigned at check-in, so we might leave them as placeholders or hide
    const gateEl = document.querySelector('.flight-details .flight-detail:nth-child(4) .detail-value');
    const seatEl = document.querySelector('.flight-details .flight-detail:nth-child(5) .detail-value');
    const seatClassEl = document.querySelector('.flight-details .flight-detail:nth-child(6) .detail-value');

    if (flightDateEl) flightDateEl.textContent = formatDate(selectedFlightData.departDate);
    if (departureTimeEl) departureTimeEl.textContent = selectedFlightData.departureTime;
    if (arrivalTimeEl) arrivalTimeEl.textContent = selectedFlightData.arrivalTime;
    if (gateEl) gateEl.textContent = 'N/A'; // Or hide
    if (seatEl) seatEl.textContent = 'N/A'; // Or hide
    if (seatClassEl) seatClassEl.textContent = getSeatClassName(selectedFlightData.seatClass);


    // Populate Passenger Information
    const passengerDetailsContainer = document.querySelector('.passenger-details');
    if (passengerDetailsContainer) {
        passengerDetailsContainer.innerHTML = ''; // Clear placeholder
        customerInfo.passengers.forEach(passenger => {
            const passengerHTML = `
                <div class="passenger-detail">
                    <strong>Họ tên</strong>
                    <span>${passenger.fullName}</span>
                </div>
                <div class="passenger-detail">
                    <strong>Giới tính</strong>
                    <span>${passenger.gender === 'male' ? 'Nam' : 'Nữ'}</span>
                </div>
                <div class="passenger-detail">
                    <strong>Ngày sinh</strong>
                    <span>${formatDate(passenger.dob)}</span>
                </div>
                <div class="passenger-detail">
                    <strong>CCCD/Hộ chiếu</strong>
                    <span>${passenger.idNumber}</span>
                </div>
                <div class="passenger-detail">
                    <strong>Loại hành khách</strong>
                    <span>${passenger.type === 'adult' ? 'Người lớn' : passenger.type === 'child' ? 'Trẻ em' : 'Em bé'}</span>
                </div>
            `;
            // Create a wrapper for each passenger's full details if needed, or append directly
            // For simplicity, appending directly here, assuming the layout supports multiple full sets.
            // If the layout is one row per passenger with multiple fields, adjust accordingly.
            const tempDiv = document.createElement('div');
            tempDiv.style.width = '100%'; // Ensure each passenger block takes full width if needed
            tempDiv.style.display = 'flex';
            tempDiv.style.flexWrap = 'wrap';
            tempDiv.style.marginBottom = '10px'; // Add some space between passengers
            tempDiv.innerHTML = passengerHTML;
            passengerDetailsContainer.appendChild(tempDiv);
        });
    }

    // Populate Barcode (if dynamic generation is intended, otherwise placeholder is fine)
    const barcodeTextEl = document.querySelector('.barcode-text');
    if (barcodeTextEl && bookingNumber) {
        barcodeTextEl.textContent = bookingNumber; // Or a more complex barcode string
    }
}

// Load payment success page
function loadPaymentSuccessPage() {
    console.log("Loading payment success page...");
    const bookingNumber = sessionStorage.getItem('bookingNumber');
    const bookingId = sessionStorage.getItem('bookingId');
    const paymentMethod = sessionStorage.getItem('paymentMethod');
    const paymentDate = sessionStorage.getItem('paymentDate');
    
    if (!bookingNumber || !bookingId) {
        console.error("No booking information found.");
        window.location.href = '../../index.html';
        return;
    }
    
    // Display booking reference
    const bookingReference = document.getElementById('booking-reference');
    if (bookingReference) {
        bookingReference.textContent = bookingNumber;
    }
    
    // Fetch booking details from API
    fetch(`${API_BASE_URL}/bookings/${bookingId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch booking details');
            }
            return response.json();
        })
        .then(data => {
            console.log("Booking details:", data);
            
            // Display flight information
            displayFlightInfoOnSuccessPage(data.flight);
            
            // Display passenger information
            displayPassengersOnSuccessPage(data.passengers);
            
            // Display payment information
            displayPaymentInfoOnSuccessPage(data.booking, paymentMethod, paymentDate);
        })
        .catch(error => {
            console.error("Error fetching booking details:", error);
            // Try to use data from sessionStorage as fallback
            const selectedFlightData = JSON.parse(sessionStorage.getItem('selectedFlight'));
            const customerInfo = JSON.parse(sessionStorage.getItem('customerInfo'));
            
            if (selectedFlightData && customerInfo) {
                displayFlightInfoFromSessionStorage(selectedFlightData);
                displayPassengersFromSessionStorage(customerInfo.passengers);
                displayPaymentInfoFromSessionStorage(paymentMethod, paymentDate);
            } else {
                // Show error message if no data available
                const errorMessage = document.createElement('div');
                errorMessage.className = 'error-message';
                errorMessage.textContent = 'Không thể tải thông tin đặt vé. Vui lòng liên hệ bộ phận hỗ trợ.';
                
                const successContent = document.querySelector('.success-content');
                if (successContent) {
                    successContent.appendChild(errorMessage);
                }
            }
        });
        
    // Add print and email ticket buttons
    addTicketButtons();
}

// Display flight information on success page from API data
function displayFlightInfoOnSuccessPage(flight) {
    const flightInfo = document.getElementById('flight-info');
    if (!flightInfo) return;
    
    flightInfo.innerHTML = `
        <h3>Thông tin chuyến bay</h3>
        <div class="info-row">
            <div class="info-label">Chuyến bay:</div>
            <div class="info-value">${flight.airline} (${flight.id})</div>
        </div>
        <div class="info-row">
            <div class="info-label">Hành trình:</div>
            <div class="info-value">${getAirportName(flight.departure)} → ${getAirportName(flight.destination)}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Ngày bay:</div>
            <div class="info-value">${formatDate(flight.date)}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Giờ bay:</div>
            <div class="info-value">${flight.departureTime} - ${flight.arrivalTime} (${flight.duration})</div>
        </div>
        <div class="info-row">
            <div class="info-label">Trạng thái:</div>
            <div class="info-value"><span class="status confirmed">Đã xác nhận</span></div>
        </div>
    `;
}

// Display flight information from sessionStorage as fallback
function displayFlightInfoFromSessionStorage(flightData) {
    const flightInfo = document.getElementById('flight-info');
    if (!flightInfo) return;
    
    flightInfo.innerHTML = `
        <h3>Thông tin chuyến bay</h3>
        <div class="info-row">
            <div class="info-label">Chuyến bay:</div>
            <div class="info-value">${flightData.airline} (${flightData.id})</div>
        </div>
        <div class="info-row">
            <div class="info-label">Hành trình:</div>
            <div class="info-value">${getAirportName(flightData.departure)} → ${getAirportName(flightData.destination)}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Ngày bay:</div>
            <div class="info-value">${formatDate(flightData.departDate)}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Giờ bay:</div>
            <div class="info-value">${flightData.departureTime} - ${flightData.arrivalTime} (${flightData.duration})</div>
        </div>
        <div class="info-row">
            <div class="info-label">Trạng thái:</div>
            <div class="info-value"><span class="status confirmed">Đã xác nhận</span></div>
        </div>
    `;
}

// Display passenger information on success page from API data
function displayPassengersOnSuccessPage(passengers) {
    const passengerInfo = document.getElementById('passenger-info');
    if (!passengerInfo) return;
    
    // Try to get passenger counts from sessionStorage
    let passengerCounts = null;
    try {
        const passengerCountsJSON = sessionStorage.getItem('passengerCounts');
        if (passengerCountsJSON) {
            passengerCounts = JSON.parse(passengerCountsJSON);
        }
    } catch (e) {
        console.error('Error parsing passenger counts:', e);
    }
    
    let passengerHtml = `<h3><i class="fas fa-users"></i> Thông tin hành khách</h3>`;
    
    // Add passenger type summary if available
    if (passengerCounts) {
        passengerHtml += `
            <div class="passenger-summary">
                <p><strong>Số lượng hành khách:</strong> 
                    ${passengerCounts.numAdults > 0 ? `${passengerCounts.numAdults} người lớn` : ''}
                    ${passengerCounts.numChildren > 0 ? `, ${passengerCounts.numChildren} trẻ em` : ''}
                    ${passengerCounts.numInfants > 0 ? `, ${passengerCounts.numInfants} em bé` : ''}
                </p>
            </div>
        `;
    }
    
    // Add passenger table
    passengerHtml += `
        <div class="passenger-list">
            <table class="passenger-table">
                <thead>
                    <tr>
                        <th>Họ tên</th>
                        <th>Giới tính</th>
                        <th>Số hộ chiếu/CMND</th>
                        <th>Loại</th>
                        <th>Số ghế</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    passengers.forEach((passenger, index) => {
        let passengerType = '';
        if (passenger.type === 'adult' || passenger.passenger_type === 'ADULT') {
            passengerType = 'Người lớn';
        } else if (passenger.type === 'child' || passenger.passenger_type === 'CHILD') {
            passengerType = 'Trẻ em';
        } else if (passenger.type === 'infant' || passenger.passenger_type === 'INFANT') {
            passengerType = 'Em bé';
        } else {
            passengerType = 'Người lớn'; // Default
        }
        
        passengerHtml += `
            <tr>
                <td>${passenger.fullName || passenger.full_name}</td>
                <td>${formatGender(passenger.gender)}</td>
                <td>${passenger.idNumber || passenger.passport_number}</td>
                <td>${passengerType}</td>
                <td>N/A</td>
            </tr>
        `;
    });
    
    passengerHtml += `
                </tbody>
            </table>
        </div>
    `;
    
    passengerInfo.innerHTML = passengerHtml;
}

// Display passenger information from sessionStorage as fallback
function displayPassengersFromSessionStorage(passengers) {
    const passengerInfo = document.getElementById('passenger-info');
    if (!passengerInfo) return;
    
    // Try to get passenger counts from sessionStorage
    let passengerCounts = null;
    try {
        const passengerCountsJSON = sessionStorage.getItem('passengerCounts');
        if (passengerCountsJSON) {
            passengerCounts = JSON.parse(passengerCountsJSON);
        }
    } catch (e) {
        console.error('Error parsing passenger counts:', e);
    }
    
    let passengerHtml = `<h3><i class="fas fa-users"></i> Thông tin hành khách</h3>`;
    
    // Add passenger type summary if available
    if (passengerCounts) {
        passengerHtml += `
            <div class="passenger-summary">
                <p><strong>Số lượng hành khách:</strong> 
                    ${passengerCounts.numAdults > 0 ? `${passengerCounts.numAdults} người lớn` : ''}
                    ${passengerCounts.numChildren > 0 ? `, ${passengerCounts.numChildren} trẻ em` : ''}
                    ${passengerCounts.numInfants > 0 ? `, ${passengerCounts.numInfants} em bé` : ''}
                </p>
            </div>
        `;
    }
    
    // Add passenger table
    passengerHtml += `
        <div class="passenger-list">
            <table class="passenger-table">
                <thead>
                    <tr>
                        <th>Họ tên</th>
                        <th>Giới tính</th>
                        <th>Số hộ chiếu/CMND</th>
                        <th>Loại</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    passengers.forEach((passenger, index) => {
        let passengerType = '';
        if (passenger.type === 'adult') {
            passengerType = 'Người lớn';
        } else if (passenger.type === 'child') {
            passengerType = 'Trẻ em';
        } else if (passenger.type === 'infant') {
            passengerType = 'Em bé';
        } else {
            passengerType = 'Người lớn'; // Default
        }
        
        passengerHtml += `
            <tr>
                <td>${passenger.fullName}</td>
                <td>${formatGender(passenger.gender)}</td>
                <td>${passenger.idNumber}</td>
                <td>${passengerType}</td>
            </tr>
        `;
    });
    
    passengerHtml += `
                </tbody>
            </table>
        </div>
    `;
    
    passengerInfo.innerHTML = passengerHtml;
}

// Display payment information on success page from API data
function displayPaymentInfoOnSuccessPage(booking, paymentMethod, paymentDate) {
    const paymentInfo = document.getElementById('payment-info');
    if (!paymentInfo) return;
    
    const methodName = getPaymentMethodName(paymentMethod);
    const formattedDate = paymentDate ? new Date(paymentDate).toLocaleString('vi-VN') : 'N/A';
    
    paymentInfo.innerHTML = `
        <h3>Thông tin thanh toán</h3>
        <div class="info-row">
            <div class="info-label">Tổng tiền:</div>
            <div class="info-value">${formatCurrency(booking.total_amount)}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Phương thức:</div>
            <div class="info-value">${methodName}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Thời gian:</div>
            <div class="info-value">${formattedDate}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Trạng thái:</div>
            <div class="info-value"><span class="status ${booking.payment_status === 'paid' ? 'confirmed' : 'pending'}">${booking.payment_status === 'paid' ? 'Đã thanh toán' : 'Chờ xác nhận'}</span></div>
        </div>
        ${booking.promo_code ? `
        <div class="info-row">
            <div class="info-label">Mã khuyến mãi:</div>
            <div class="info-value">${booking.promo_code}</div>
        </div>
        ` : ''}
    `;
}

// Display payment information from sessionStorage as fallback
function displayPaymentInfoFromSessionStorage(paymentMethod, paymentDate) {
    const paymentInfo = document.getElementById('payment-info');
    if (!paymentInfo) return;
    
    const methodName = getPaymentMethodName(paymentMethod);
    const formattedDate = paymentDate ? new Date(paymentDate).toLocaleString('vi-VN') : 'N/A';
    const totalAmount = sessionStorage.getItem('discountedTotalPrice') || sessionStorage.getItem('totalPriceForPayment');
    
    paymentInfo.innerHTML = `
        <h3>Thông tin thanh toán</h3>
        <div class="info-row">
            <div class="info-label">Tổng tiền:</div>
            <div class="info-value">${formatCurrency(totalAmount)}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Phương thức:</div>
            <div class="info-value">${methodName}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Thời gian:</div>
            <div class="info-value">${formattedDate}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Trạng thái:</div>
            <div class="info-value"><span class="status confirmed">Đã thanh toán</span></div>
        </div>
    `;
}

// Get payment method display name
function getPaymentMethodName(method) {
    const methodNames = {
        'credit-card': 'Thẻ tín dụng/ghi nợ',
        'bank-transfer': 'Chuyển khoản ngân hàng',
        'e-wallet': 'Ví điện tử',
        'momo': 'MoMo'
    };
    
    return methodNames[method] || method;
}

// Add ticket buttons to success page
function addTicketButtons() {
    const buttonContainer = document.querySelector('.success-actions');
    if (!buttonContainer) return;
    
    // Clear existing buttons
    buttonContainer.innerHTML = '';
    
    // Print ticket button
    const printButton = document.createElement('button');
    printButton.className = 'btn-primary';
    printButton.innerHTML = '<i class="fas fa-print"></i> In vé';
    printButton.addEventListener('click', function() {
        window.print();
    });
    
    // View ticket button
    const viewButton = document.createElement('button');
    viewButton.className = 'btn-secondary';
    viewButton.innerHTML = '<i class="fas fa-ticket-alt"></i> Xem vé';
    viewButton.addEventListener('click', function() {
        window.location.href = 'ticket-preview.html';
    });
    
    // Email ticket button
    const emailButton = document.createElement('button');
    emailButton.className = 'btn-secondary';
    emailButton.innerHTML = '<i class="fas fa-envelope"></i> Gửi vé qua email';
    emailButton.addEventListener('click', function() {
        alert('Vé của bạn đã được gửi qua email đăng ký.');
    });
    
    // Add buttons to container
    buttonContainer.appendChild(printButton);
    buttonContainer.appendChild(viewButton);
    buttonContainer.appendChild(emailButton);
    
    // Add styles for buttons
    const style = document.createElement('style');
    style.textContent = `
        .success-actions {
            display: flex;
            gap: 10px;
            margin-top: 30px;
            justify-content: center;
        }
        
        .success-actions button {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 15px;
        }
        
        .status {
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 0.9em;
        }
        
        .status.confirmed {
            background-color: #d4edda;
            color: #155724;
        }
        
        .status.pending {
            background-color: #fff3cd;
            color: #856404;
        }
        
        .passenger-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            margin-bottom: 15px;
            overflow: hidden;
        }
        
        .passenger-header {
            background-color: #f8f9fa;
            padding: 10px 15px;
            border-bottom: 1px solid #ddd;
        }
        
        .passenger-name {
            font-weight: bold;
        }
        
        .passenger-details {
            padding: 15px;
        }
        
        .info-row {
            display: flex;
            margin-bottom: 8px;
        }
        
        .info-label {
            width: 150px;
            font-weight: 500;
            color: #666;
        }
        
        .info-value {
            flex: 1;
        }
        
        @media print {
            .success-actions {
                display: none;
            }
            
            header, footer {
                display: none;
            }
            
            body {
                background-color: white;
            }
            
            .success-content {
                box-shadow: none;
                margin: 0;
                padding: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// Make sure this function is called when the payment success page is loaded
document.addEventListener('DOMContentLoaded', function() {
    // ... existing code ...
    
    // Load payment success page if on payment-success.html
    if (window.location.pathname.includes('payment-success.html')) {
        loadPaymentSuccessPage();
    }
    
    // ... existing code ...
});

// Helper function to format gender display
function formatGender(gender) {
    if (!gender) return 'Không xác định';
    
    if (typeof gender === 'string') {
        gender = gender.toLowerCase();
        if (gender === 'male' || gender === 'm' || gender === 'nam') {
            return 'Nam';
        } else if (gender === 'female' || gender === 'f' || gender === 'nữ' || gender === 'nu') {
            return 'Nữ';
        }
    }
    
    return 'Không xác định';
}

function saveBookingToAPI() {
    const selectedFlightJSON = sessionStorage.getItem('selectedFlight');
    const customerInfoJSON = sessionStorage.getItem('customerInfo');
    const totalPrice = sessionStorage.getItem('totalPrice') || sessionStorage.getItem('calculatedTotalPrice');
    
    // Get explicit round trip flag from session storage, or determine from selectedFlight
    let isRoundTrip = sessionStorage.getItem('isRoundTrip') === 'true';
    
    if (!selectedFlightJSON || !customerInfoJSON) {
        showAlert('Lỗi', 'Không tìm thấy thông tin đặt vé', 'danger');
        return;
    }
    
    const flightData = JSON.parse(selectedFlightJSON);
    const customerData = JSON.parse(customerInfoJSON);
    
    // If not explicitly set in session storage, try to determine from flightData
    if (sessionStorage.getItem('isRoundTrip') === null) {
        isRoundTrip = flightData.isRoundTrip === true || (flightData.returnFlight && flightData.returnDate);
    }
    
    // Get promo code from sessionStorage, checking all possible keys
    const promoCode = sessionStorage.getItem('appliedPromoCode') || 
                      sessionStorage.getItem('promoCode') || null;
    
    // Determine the appropriate flight IDs
    let departureFlightId;
    if (flightData.flight_id) {
        departureFlightId = flightData.flight_id; // Use database ID if available
    } else if (flightData.id) {
        departureFlightId = flightData.id; // Use display ID if that's what we have
    } else {
        console.error('No valid departure flight ID found');
        showAlert('Lỗi', 'Không tìm thấy thông tin chuyến bay', 'danger');
        return;
    }
    
    // Get the return flight ID if this is a round trip
    let returnFlightId = null;
    if (isRoundTrip && flightData.returnFlight) {
        if (flightData.returnFlight.flight_id) {
            returnFlightId = flightData.returnFlight.flight_id;
        } else if (flightData.returnFlight.id) {
            returnFlightId = flightData.returnFlight.id;
        }
    }
    
    console.log('Flight IDs:', { departureFlightId, returnFlightId, isRoundTrip });
    
    // Ensure passengers have proper type field
    let formattedPassengers = [];
    if (customerData.passengers && Array.isArray(customerData.passengers)) {
        formattedPassengers = customerData.passengers.map(passenger => {
            // Standardize passenger type
            let passengerType = 'ADULT'; // Default
            
            if (passenger.type) {
                // If passenger.type is already set, standardize it
                if (passenger.type.toLowerCase() === 'adult') passengerType = 'ADULT';
                else if (passenger.type.toLowerCase() === 'child') passengerType = 'CHILD';
                else if (passenger.type.toLowerCase() === 'infant') passengerType = 'INFANT';
            } else if (passenger.passengerType) {
                // If passenger.passengerType is set, use that
                passengerType = passenger.passengerType.toUpperCase();
            }
            
            return {
                fullName: passenger.fullName,
                gender: passenger.gender || 'MALE', // Default
                dob: passenger.dob || null,
                idNumber: passenger.idNumber || passenger.passport_number || passenger.passportNumber || '',
                type: passengerType
            };
        });
    }
    
    // Tạo dữ liệu đặt vé
    const bookingData = {
        departureFlightId: departureFlightId,
        returnFlightId: returnFlightId,
        isRoundTrip: isRoundTrip, // Include round-trip flag
        customerInfo: {
            fullName: customerData.contactPerson ? customerData.contactPerson.fullName : customerData.fullName,
            email: customerData.contactPerson ? customerData.contactPerson.email : customerData.email,
            phone: customerData.contactPerson ? customerData.contactPerson.phone : customerData.phone,
            seatClass: flightData.seatClass || 'ECONOMY'
        },
        passengers: formattedPassengers,
        selectedServices: JSON.parse(sessionStorage.getItem('selectedServices') || '{}'),
        promoCode: promoCode,
        totalAmount: parseFloat(totalPrice) || 0,
        passengerCounts: {
            numAdults: parseInt(flightData.adults) || 0,
            numChildren: parseInt(flightData.children) || 0,
            numInfants: parseInt(flightData.infants) || 0
        }
    };
    
    // Log the booking data for debugging
    console.log('Sending booking data:', bookingData);
    
    // Lưu dữ liệu đặt vé vào sessionStorage để sử dụng ở trang thanh toán
    sessionStorage.setItem('bookingData', JSON.stringify(bookingData));
    
    // Chuyển hướng đến trang thanh toán
    window.location.href = 'assets/pages/payment.html';
}

// Confirm booking and proceed to payment
function confirmBooking() {
    try {
        // Create loading overlay
        const loadingOverlay = createLoadingOverlay();
        document.body.appendChild(loadingOverlay);
        
        setTimeout(() => {
            try {
                // Save booking information to API
                saveBookingToAPI();
            } catch (error) {
                console.error('Error confirming booking:', error);
                alert('Có lỗi xảy ra khi xác nhận đặt vé. Vui lòng thử lại.');
                
                // Remove loading overlay
                document.body.removeChild(loadingOverlay);
            }
        }, 1000);
    } catch (error) {
        console.error('Error confirming booking:', error);
        alert('Có lỗi xảy ra khi xác nhận đặt vé. Vui lòng thử lại.');
    }
}

function createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '1000';
    
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.style.border = '5px solid #f3f3f3';
    spinner.style.borderTop = '5px solid #0066cc';
    spinner.style.borderRadius = '50%';
    spinner.style.width = '50px';
    spinner.style.height = '50px';
    spinner.style.animation = 'spin 1s linear infinite';
    
    const style = document.createElement('style');
    style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
    
    overlay.appendChild(spinner);
    overlay.appendChild(style);
    
    return overlay;
}
