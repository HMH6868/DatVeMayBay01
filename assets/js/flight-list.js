// Initialize price range slider
const priceRange = document.getElementById('price-range');
const priceValue = document.getElementById('price-value');

if (priceRange && priceValue) {
    priceRange.addEventListener('input', function() {
        priceValue.textContent = formatCurrency(this.value);
    });

    // Set initial value
    priceValue.textContent = formatCurrency(priceRange.value);
}

// Format currency for display
function formatCurrency(value) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

// Check if flights are loaded after page is fully loaded
window.addEventListener('load', function() {
    console.log("Window load event triggered");
    const flightList = document.getElementById('flight-list');

    // If flight list is empty (only contains the loading message)
    if (flightList && (flightList.children.length === 0 ||
        (flightList.children.length === 1 && flightList.querySelector('.loading')))) {
        console.log("Flight list is empty, attempting to load flights");

        // Check if sample flights exist
        if (!window.sampleFlights || window.sampleFlights.length === 0) {
            console.log("Creating sample flight data");
            // Make sure sample flights are created
            if (typeof createSampleFlightData === 'function') {
                createSampleFlightData();
            }
        }

        // Try to load flights again
        if (typeof loadFlightListPage === 'function') {
            console.log("Calling loadFlightListPage");
            loadFlightListPage();
        } else {
            console.error("loadFlightListPage function not found");
            flightList.innerHTML = '<div class="no-flights">Lỗi khi tải chuyến bay. Vui lòng tải lại trang.</div>';
        }
    }
});
