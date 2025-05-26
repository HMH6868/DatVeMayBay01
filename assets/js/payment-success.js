document.addEventListener('DOMContentLoaded', function() {
    // Load booking details from sessionStorage
    const bookingNumber = sessionStorage.getItem('bookingNumber');
    const paymentMethod = sessionStorage.getItem('paymentMethod');
    const paymentDate = sessionStorage.getItem('paymentDate');
    const selectedFlight = JSON.parse(sessionStorage.getItem('selectedFlight'));
    const customerInfo = JSON.parse(sessionStorage.getItem('customerInfo'));
    const totalPrice = JSON.parse(sessionStorage.getItem('totalPrice'));

    // If essential data is missing, redirect to home
    if (!bookingNumber || !selectedFlight || !customerInfo || !totalPrice) {
        window.location.href = 'index.html';
        return;
    }

    // Display booking number and date
    document.getElementById('booking-number').textContent = `Mã đặt vé: ${bookingNumber}`;
    document.getElementById('booking-date').textContent = `Ngày đặt: ${formatDate(new Date(paymentDate).toISOString().split('T')[0])}`;

    // Generate booking details HTML
    const bookingDetailsContent = document.getElementById('booking-details-content');
    if (bookingDetailsContent) {
        let paymentStatus = 'status-success';
        let paymentStatusText = 'Đã thanh toán';

        if (paymentMethod === 'bank-transfer') {
            paymentStatus = 'status-pending';
            paymentStatusText = 'Đang xử lý';
        }

        // Get payment method name
        let paymentMethodName = 'Thẻ tín dụng/ghi nợ';
        switch (paymentMethod) {
            case 'bank-transfer':
                paymentMethodName = 'Chuyển khoản ngân hàng';
                break;
            case 'e-wallet':
                const walletProvider = sessionStorage.getItem('walletProvider') || '';
                paymentMethodName = 'Ví điện tử ' + walletProvider.toUpperCase();
                break;
            case 'momo':
                paymentMethodName = 'MoMo';
                break;
        }

        bookingDetailsContent.innerHTML = `
            <div class="detail-section">
                <h3>Thông tin chuyến bay</h3>
                <div class="detail-row">
                    <strong>Chuyến bay:</strong>
                    <span>${selectedFlight.id}</span>
                </div>
                <div class="detail-row">
                    <strong>Hãng bay:</strong>
                    <span>${selectedFlight.airline}</span>
                </div>
                <div class="detail-row">
                    <strong>Hành trình:</strong>
                    <span>${selectedFlight.departure} → ${selectedFlight.destination}</span>
                </div>
                <div class="detail-row">
                    <strong>Ngày bay:</strong>
                    <span>${formatDate(selectedFlight.departDate)}</span>
                </div>
                <div class="detail-row">
                    <strong>Giờ bay:</strong>
                    <span>${selectedFlight.departureTime} - ${selectedFlight.arrivalTime}</span>
                </div>
                <div class="detail-row">
                    <strong>Hạng ghế:</strong>
                    <span>${selectedFlight.seatClassName || (selectedFlight.seatClass ?
                        (selectedFlight.seatClass === 'ECONOMY' ? 'Phổ thông' :
                         selectedFlight.seatClass === 'PREMIUM_ECONOMY' ? 'Phổ thông đặc biệt' :
                         selectedFlight.seatClass === 'BUSINESS' ? 'Thương gia' :
                         selectedFlight.seatClass === 'FIRST' ? 'Thương gia hạng nhất' : 'Phổ thông')
                    : 'Phổ thông')}</span>
                </div>
            </div>

            <div class="detail-section">
                <h3>Thông tin hành khách</h3>
                ${customerInfo.passengers.map(passenger => `
                    <div class="detail-row">
                        <strong>Họ tên:</strong>
                        <span>${passenger.fullName}</span>
                    </div>
                `).join('')}
            </div>

            <div class="detail-section">
                <h3>Thông tin liên hệ</h3>
                <div class="detail-row">
                    <strong>Họ tên:</strong>
                    <span>${customerInfo.contactPerson.fullName}</span>
                </div>
                <div class="detail-row">
                    <strong>Email:</strong>
                    <span>${customerInfo.contactPerson.email}</span>
                </div>
                <div class="detail-row">
                    <strong>Số điện thoại:</strong>
                    <span>${customerInfo.contactPerson.phone}</span>
                </div>
            </div>

            <div class="detail-section">
                <h3>Thông tin thanh toán</h3>
                <div class="detail-row">
                    <strong>Phương thức:</strong>
                    <span class="payment-method">${paymentMethodName}</span>
                </div>
                <div class="detail-row">
                    <strong>Tổng tiền:</strong>
                    <span>${formatCurrency(totalPrice)}</span>
                </div>
                <div class="detail-row">
                    <strong>Trạng thái:</strong>
                    <span><span class="payment-status ${paymentStatus}">${paymentStatusText}</span></span>
                </div>
            </div>
        `;
    }

    // Add print functionality
    const printButton = document.getElementById('print-ticket');
    if (printButton) {
        printButton.addEventListener('click', function() {
            window.print();
        });
    }

    // Clear booking data when returning to home
    const homeButton = document.querySelector('.btn-home');
    if (homeButton) {
        homeButton.addEventListener('click', function(e) {
            e.preventDefault();

            // Clear session storage
            sessionStorage.removeItem('selectedFlight');
            sessionStorage.removeItem('customerInfo');
            sessionStorage.removeItem('totalPrice');
            sessionStorage.removeItem('bookingNumber');
            sessionStorage.removeItem('paymentMethod');
            sessionStorage.removeItem('paymentDate');

            // Redirect to home
            window.location.href = 'index.html';
        });
    }
});

// Format date function
function formatDate(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString);

    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Format currency function
function formatCurrency(value) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(value);
}
