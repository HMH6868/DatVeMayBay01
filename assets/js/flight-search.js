// Constants
const API_BASE_URL = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', function() {
    console.log("Flight search page loaded");
    
    // Update the UI with trip type visualization
    initializeFlightListUI();
    
    // Load flight list
    loadFlightListPage();
});

// Initialize the flight list UI elements
function initializeFlightListUI() {
    // Set up trip type indicator banner
    updateTripTypeBanner();
}

// Update the trip type banner to show one-way or round-trip
function updateTripTypeBanner() {
    const tripTypeIndicator = document.getElementById('trip-type-indicator');
    if (!tripTypeIndicator) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const returnDate = urlParams.get('return-date');
    const isRoundTrip = returnDate !== null && returnDate !== '';
    const isSelectingReturn = urlParams.get('selecting-return') === 'true';
    
    if (isRoundTrip) {
        if (isSelectingReturn) {
            tripTypeIndicator.innerHTML = `
                <div class="trip-type round-trip return-leg">
                    <div class="trip-icon"><i class="fas fa-exchange-alt"></i></div>
                    <div class="trip-info">
                        <h3>Chuyến bay khứ hồi - Đang chọn chuyến về</h3>
                        <p>Bạn đã chọn chuyến đi, hãy chọn chuyến về phù hợp</p>
                    </div>
                    <button id="change-departure-flight" class="btn-text">
                        <i class="fas fa-undo-alt"></i> Chọn lại chuyến đi
                    </button>
                </div>
            `;
            // Update trip summary box with departure flight info
            updateTripSummaryBox(true);
            
            // Add event listener for changing departure flight
            const changeDepartureBtn = document.getElementById('change-departure-flight');
            if (changeDepartureBtn) {
                changeDepartureBtn.addEventListener('click', function() {
                    // Clear selected departure flight
                    sessionStorage.removeItem('selectedDepartureFlight');
                    
                    // Redirect back to flight list without selecting-return parameter
                    const params = new URLSearchParams(urlParams);
                    params.delete('selecting-return');
                    window.location.href = `flight-list.html?${params.toString()}`;
                });
            }
        } else {
            tripTypeIndicator.innerHTML = `
                <div class="trip-type round-trip departure-leg">
                    <div class="trip-icon"><i class="fas fa-exchange-alt"></i></div>
                    <div class="trip-info">
                        <h3>Chuyến bay khứ hồi - Đang chọn chuyến đi</h3>
                        <p>Bước 1: Chọn chuyến bay đi (sau đó bạn sẽ chọn chuyến về)</p>
                    </div>
                </div>
            `;
        }
    } else {
        tripTypeIndicator.innerHTML = `
            <div class="trip-type one-way">
                <div class="trip-icon"><i class="fas fa-long-arrow-alt-right"></i></div>
                <div class="trip-info">
                    <h3>Chuyến bay một chiều</h3>
                    <p>Hãy chọn chuyến bay phù hợp với lịch trình của bạn</p>
                </div>
            </div>
        `;
    }
}

// Update the trip summary box with selected flight info
function updateTripSummaryBox(show = false) {
    const tripSummaryBox = document.getElementById('trip-summary-box');
    const tripSummaryContent = document.getElementById('trip-summary-content');
    
    if (!tripSummaryBox || !tripSummaryContent) return;
    
    if (show) {
        // Get selected departure flight
        const selectedDepartureFlightData = sessionStorage.getItem('selectedDepartureFlight');
        if (!selectedDepartureFlightData) return;
        
        const departureFlight = JSON.parse(selectedDepartureFlightData);
        
        // Show departure flight summary
        tripSummaryContent.innerHTML = `
            <div class="selected-flight-summary">
                <div class="flight-direction">
                    <strong><i class="fas fa-plane-departure"></i> Chuyến đi đã chọn:</strong>
                </div>
                <div class="flight-details-summary">
                    <p class="airline-info">
                        <img src="../images/${departureFlight.airlineCode?.toLowerCase()}-logo.png" 
                             onerror="this.src='https://via.placeholder.com/30?text=${departureFlight.airlineCode}'" 
                             alt="${departureFlight.airline}" 
                             class="airline-logo-small">
                        ${departureFlight.airline} (${departureFlight.id})
                    </p>
                    <p class="route">
                        ${getAirportName(departureFlight.departure)} 
                        <i class="fas fa-arrow-right"></i> 
                        ${getAirportName(departureFlight.destination)}
                    </p>
                    <p class="time-info">
                        ${formatDate(departureFlight.departDate)} | 
                        ${departureFlight.departureTime} - ${departureFlight.arrivalTime}
                    </p>
                    <p class="price-info">
                        <strong>Giá: ${formatCurrency(departureFlight.finalPrice)}</strong>
                    </p>
                </div>
            </div>
        `;
        
        // Show the box
        tripSummaryBox.classList.remove('hidden');
    } else {
        // Hide the box
        tripSummaryBox.classList.add('hidden');
    }
}

// Load flight list page
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
    // Check if returnDate exists and is not empty
    const tripType = (returnDate !== null && returnDate !== '') ? 'round-trip' : 'one-way';
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
        
        // Add return-flight-mode class to body if selecting return flight
        if (selectingReturn) {
            document.body.classList.add('return-flight-mode');
            // Add flight header to indicate we're selecting a return flight
            const flightHeader = document.querySelector('.flight-list-header');
            if (flightHeader) {
                flightHeader.classList.add('return-flight-header');
            }
        }
        
        if (selectingReturn && selectedDepartureFlight) {
            // Parse the departure flight data
            const departFlightData = JSON.parse(selectedDepartureFlight);
            
            // We're selecting a return flight
            searchSummary.innerHTML = `
                <div class="selected-flights">
                    <div class="flight-direction">
                        <h2>${destinationCity} <i class="fas fa-arrow-right direction-icon"></i> ${departureCity}</h2>
                    </div>
                    <p>Ngày về: ${formatDate(returnDate)} | ${passengerInfo}</p>
                </div>
                <button id="modify-search" class="btn-secondary">Thay đổi tìm kiếm</button>
            `;
        } else {
            // Normal display for selecting outbound flight
        searchSummary.innerHTML = `
                <div class="flight-direction">
                    <h2>${departureCity} <i class="fas fa-arrow-right direction-icon"></i> ${destinationCity}</h2>
                </div>
                <p>Ngày đi: ${formatDate(departDate)} | ${passengerInfo}</p>
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
    const selectingReturn = urlParams.get('selecting-return') === 'true';
    
    if (!departure || !destination) {
        console.error("Missing departure or destination in URL parameters");
        const flightList = document.getElementById('flight-list');
        if (flightList) {
            flightList.innerHTML = '<div class="no-flights">Thông tin tìm kiếm không hợp lệ. Vui lòng quay lại trang chủ và thử lại.</div>';
        }
        return;
    }
    
    if (selectingReturn) {
        displayFlights(destination, departure, true);
    } else {
        displayFlights(departure, destination, false);
    }
}

// Display flights for a given route
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
    const maxPriceElement = document.getElementById('price-range');
    const maxPrice = maxPriceElement ? maxPriceElement.value : 2000000;
    const sortElement = document.getElementById('sort-flights');
    const sortOption = sortElement ? sortElement.value : 'price-asc';
    
    // Get selected seat class and date from URL parameters
    const searchParams = new URLSearchParams(window.location.search);
    const searchSeatClass = searchParams.get('seat-class') || 'ECONOMY';
    // Choose departure or return date based on which flights we're selecting
    const dateToUse = isReturnFlight ? searchParams.get('return-date') : searchParams.get('depart-date');
    
    // Explicitly determine if this is a round-trip booking
    const returnDate = searchParams.get('return-date');
    const isRoundTrip = returnDate !== null && returnDate !== '';
    
    console.log("Search parameters:", { dateToUse, searchSeatClass, isRoundTrip });
    
    // Fetch flights from API
    let apiUrl = `${API_BASE_URL}/flights?departure=${departure}&destination=${destination}`;
    
    if (dateToUse) {
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
            
            // Filter flights by status = "scheduled"
            let filteredFlights = flights.filter(flight => flight.status === "scheduled");
            
            // If no scheduled flights, show message
            if (filteredFlights.length === 0) {
                flightList.innerHTML = '<div class="no-flights">Không có chuyến bay nào được lên lịch cho hành trình này. Vui lòng thử lại với hành trình khác.</div>';
                return;
            }
            
            // Apply client-side filters
            filteredFlights = filteredFlights.filter(flight => flight.price <= maxPrice);
            
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
            
            // Create flight selection header
            const selectionHeader = document.createElement('div');
            selectionHeader.className = 'flight-selection-header';
            selectionHeader.innerHTML = `
                <h3>
                    ${isReturnFlight 
                        ? '<i class="fas fa-plane-arrival"></i> Chọn chuyến bay về'
                        : '<i class="fas fa-plane-departure"></i> Chọn chuyến bay đi'}
                </h3>
                <p>${filteredFlights.length} chuyến bay phù hợp với tìm kiếm của bạn</p>
            `;
            flightList.appendChild(selectionHeader);
            
            // Display filtered and sorted flights
            filteredFlights.forEach(flight => {
                const flightCard = document.createElement('div');
                flightCard.className = 'flight-card';
                
                // Add a class for styling based on whether this is for departure or return
                if (isReturnFlight) {
                    flightCard.classList.add('return-flight-card');
                } else {
                    flightCard.classList.add('departure-flight-card');
                }
                
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
                                <div class="airport">${getAirportName(flight.departure)}</div>
                                <div class="date">${formatDateShort(dateToUse)}</div>
                            </div>
                            <div class="duration">
                                <div class="line"></div>
                                <div class="time">${flight.duration}</div>
                            </div>
                            <div class="arrival">
                                <div class="time">${flight.arrivalTime}</div>
                                <div class="airport">${getAirportName(flight.destination)}</div>
                                <div class="date">${calculateArrivalDate(dateToUse, flight.departureTime, flight.arrivalTime)}</div>
                            </div>
                        </div>
                        <div class="flight-info">
                            <div class="flight-class">${seatClassDisplay}</div>
                            <div class="flight-price">${formatCurrency(getPriceForSeatClass(flight, selectedSeatClass))}</div>
                            <button class="btn-select" data-flight-id="${flight.id}">
                                ${isReturnFlight ? 'Chọn chuyến về' : 'Chọn chuyến đi'}
                            </button>
                        </div>
                    </div>
                    <div class="flight-details-expanded">
                        <div class="flight-details-row">
                            <div class="detail-item">
                                <i class="fas fa-plane"></i>
                                <span>Số hiệu: ${flight.airlineCode}${flight.flightNumber || flight.id.replace(flight.airlineCode, '')}</span>
                            </div>
                            <div class="detail-item">
                                <i class="fas fa-chair"></i>
                                <span>Ghế trống: ${getAvailableSeatsForClass(flight, selectedSeatClass)}</span>
                            </div>
                        </div>
                        <div class="flight-details-row">
                            <div class="detail-item">
                                <i class="fas fa-suitcase"></i>
                                <span>Hành lý: ${getBaggageAllowance(selectedSeatClass)}</span>
                            </div>
                            <div class="detail-item">
                                <i class="fas fa-utensils"></i>
                                <span>Bữa ăn: ${getMealInfo(selectedSeatClass)}</span>
                            </div>
                        </div>
                    </div>
                `;
                flightList.appendChild(flightCard);
                
                // Add event listener to the select button
                flightCard.querySelector('.btn-select').addEventListener('click', function() {
                    const flightId = this.getAttribute('data-flight-id');
                    const selectedFlight = filteredFlights.find(f => f.id === flightId);
                    const searchParams = new URLSearchParams(window.location.search);
                    
                    // Check if return-date exists AND is not empty
                    const returnDate = searchParams.get('return-date');
                    const isRoundTrip = returnDate !== null && returnDate !== '';
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
                            finalPrice: getPriceForSeatClass(selectedFlight, searchParams.get('seat-class') || "ECONOMY")
                        }));
                        
                        // Show selection confirmation
                        showSelectionConfirmation(selectedFlight, false);
                        
                        // Redirect to select return flight after a brief delay
                        setTimeout(() => {
                            const params = new URLSearchParams(searchParams);
                            params.set('selecting-return', 'true');
                            window.location.href = `flight-list.html?${params.toString()}`;
                        }, 1500);
                        
                    } else if (isRoundTrip && isSelectingReturn) {
                        // For round trip's second leg (return flight)
                        const departureFlight = JSON.parse(sessionStorage.getItem('selectedDepartureFlight'));
                        
                        if (!departureFlight) {
                            alert('Đã xảy ra lỗi khi chọn chuyến bay. Vui lòng thử lại.');
                            window.location.href = '../../index.html';
                            return;
                        }
                        
                        // Show selection confirmation
                        showSelectionConfirmation(selectedFlight, true);
                        
                        // Now we have both flights, combine them
                        sessionStorage.setItem('selectedFlight', JSON.stringify({
                            ...departureFlight,
                            returnDate: searchParams.get('return-date'),
                            isRoundTrip: true, // Explicitly set round-trip flag
                            returnFlight: {
                                ...selectedFlight,
                                departDate: searchParams.get('return-date'),
                                seatClass: searchParams.get('seat-class') || "ECONOMY",
                                seatClassName: getSeatClassName(searchParams.get('seat-class') || "ECONOMY"),
                                finalPrice: getPriceForSeatClass(selectedFlight, searchParams.get('seat-class') || "ECONOMY")
                            }
                        }));
                        
                        // Clear the departure flight since we've combined them
                        sessionStorage.removeItem('selectedDepartureFlight');
                        
                        // Redirect to customer info page with both flights selected after a brief delay
                        setTimeout(() => {
                            window.location.href = 'customer-info.html';
                        }, 1500);
                        
                    } else {
                        // One-way trip
                        // Show selection confirmation
                        showSelectionConfirmation(selectedFlight, false);
                        
                    sessionStorage.setItem('selectedFlight', JSON.stringify({
                        ...selectedFlight,
                        departDate: searchParams.get('depart-date'),
                            returnDate: null, // Explicitly set to null for one-way
                            isRoundTrip: false, // Explicitly set one-way flag
                        adults: searchParams.get('adults') || "1",
                        children: searchParams.get('children') || "0",
                        infants: searchParams.get('infants') || "0",
                        seatClass: searchParams.get('seat-class') || "ECONOMY",
                        seatClassName: getSeatClassName(searchParams.get('seat-class') || "ECONOMY"),
                            finalPrice: getPriceForSeatClass(selectedFlight, searchParams.get('seat-class') || "ECONOMY")
                    }));
                    
                        // Redirect directly to customer info page for one-way after a brief delay
                        setTimeout(() => {
                    window.location.href = 'customer-info.html';
                        }, 1500);
                    }
                });
            });
        })
        .catch(error => {
            console.error('Error fetching flights:', error);
            flightList.innerHTML = `<div class="no-flights">Có lỗi xảy ra khi tải dữ liệu chuyến bay: ${error.message}. Vui lòng thử lại sau.</div>`;
        });
}

// Show a confirmation message when a flight is selected
function showSelectionConfirmation(flight, isReturnFlight) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'selection-overlay';
    
    // Create confirmation box
    const confirmationBox = document.createElement('div');
    confirmationBox.className = 'selection-confirmation';
    
    // Set confirmation message
    confirmationBox.innerHTML = `
        <div class="confirmation-icon">
            <i class="fas fa-check-circle"></i>
        </div>
        <h3>Chuyến bay đã được chọn</h3>
        <p>
            ${isReturnFlight ? 'Chuyến về' : 'Chuyến đi'}: 
            ${flight.airline} (${flight.id})
            <br>
            ${getAirportName(flight.departure)} &rarr; ${getAirportName(flight.destination)}
        </p>
        <div class="loading-indicator">
            <div class="spinner"></div>
            <p>Đang chuyển hướng...</p>
        </div>
    `;
    
    // Add to body
    overlay.appendChild(confirmationBox);
    document.body.appendChild(overlay);
    
    // Remove after redirect
    setTimeout(() => {
        document.body.removeChild(overlay);
    }, 2000);
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

// Format date for display
function formatDate(dateString) {
    if (!dateString) return '';
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('vi-VN', options);
}

// Format price as Vietnamese currency
function formatCurrency(price) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    }
    
// Helper function to format date in a shorter format
function formatDateShort(dateString) {
    if (!dateString) return '';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('vi-VN', options);
}

// Helper function to calculate arrival date based on departure and duration
function calculateArrivalDate(departDate, departureTime, arrivalTime) {
    if (!departDate || !departureTime || !arrivalTime) return '';
    
    try {
        // Parse times into hours and minutes
        const [departHours, departMinutes] = departureTime.split(':').map(Number);
        const [arrivalHours, arrivalMinutes] = arrivalTime.split(':').map(Number);
        
        // Create date objects
        const departDateTime = new Date(departDate);
        departDateTime.setHours(departHours, departMinutes, 0);
        
        const arrivalDateTime = new Date(departDate);
        arrivalDateTime.setHours(arrivalHours, arrivalMinutes, 0);
        
        // If arrival time is earlier than departure time, it's likely the next day
        if (arrivalDateTime <= departDateTime) {
            arrivalDateTime.setDate(arrivalDateTime.getDate() + 1);
}

        // Format the date
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return arrivalDateTime.toLocaleDateString('vi-VN', options);
    } catch (error) {
        console.error('Error calculating arrival date:', error);
        return '';
    }
}

// Helper function to get baggage allowance based on seat class
function getBaggageAllowance(seatClass) {
    const baggageAllowances = {
        'ECONOMY': '15kg',
        'PREMIUM_ECONOMY': '20kg',
        'BUSINESS': '30kg',
        'FIRST': '40kg'
    };
    return baggageAllowances[seatClass] || 'N/A';
}

// Helper function to get meal information based on seat class
function getMealInfo(seatClass) {
    const mealInfos = {
        'ECONOMY': 'Không có bữa ăn',
        'PREMIUM_ECONOMY': 'Bữa ăn đơn giản',
        'BUSINESS': 'Bữa ăn đầy đủ',
        'FIRST': 'Bữa ăn đầy đủ'
    };
    return mealInfos[seatClass] || 'N/A';
}

// Helper function to get available seats for the selected seat class
function getAvailableSeatsForClass(flight, seatClass) {
    if (!flight || !seatClass) return 'N/A';
    
    // Check if we have the seats object with specific counts
    if (flight.seats && flight.seats[seatClass]) {
        return flight.seats[seatClass];
    }
    
    // Fallback to individual seat class properties
    switch(seatClass) {
        case 'PREMIUM_ECONOMY':
            return flight.seats_premium_economy || 'N/A';
        case 'BUSINESS':
            return flight.seats_business || 'N/A';
        case 'FIRST':
            return flight.seats_first || 'N/A';
        case 'ECONOMY':
        default:
            return flight.seats_economy || 'N/A';
    }
} 