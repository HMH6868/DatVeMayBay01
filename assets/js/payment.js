// Payment method tab switching
const methodTabs = document.querySelectorAll('.method-tab');
const paymentForms = {
    'credit-card': document.getElementById('credit-card-form'),
    'bank-transfer': document.getElementById('bank-transfer-form'),
    'momo': document.getElementById('momo-form')
};

function showPaymentForm(method) {
    // Hide all payment forms
    Object.values(paymentForms).forEach(form => {
        if (form) form.style.display = 'none';
    });

    // Show the selected payment form
    if (paymentForms[method]) {
        paymentForms[method].style.display = 'block';
    }
}

methodTabs.forEach(tab => {
    tab.addEventListener('click', function() {
        // Remove active class from all tabs
        methodTabs.forEach(t => t.classList.remove('active'));
        // Add active class to clicked tab
        this.classList.add('active');

        // Show the corresponding payment form
        const method = this.getAttribute('data-method');
        showPaymentForm(method);
    });
});

// Basic form validation (for demonstration purposes)
const cardNumber = document.getElementById('card-number');
if (cardNumber) {
    cardNumber.addEventListener('input', function(e) {
        // Format card number with spaces after every 4 digits
        let value = this.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        let formattedValue = '';

        for (let i = 0; i < value.length; i++) {
            if (i > 0 && i % 4 === 0) {
                formattedValue += ' ';
            }
            formattedValue += value[i];
        }

        this.value = formattedValue;
    });
}

const expiryDate = document.getElementById('expiry-date');
if (expiryDate) {
    expiryDate.addEventListener('input', function(e) {
        // Format expiry date as MM/YY
        let value = this.value.replace(/\D/g, '');

        if (value.length > 2) {
            this.value = value.substring(0, 2) + '/' + value.substring(2, 4);
        } else {
            this.value = value;
        }
    });
}

// Payment success handling
const paymentFormElements = document.querySelectorAll('form');
const API_BASE_URL = 'http://localhost:3000/api';

// Kiểm tra và lấy lại thông tin đặt vé khi trang payment được load
document.addEventListener('DOMContentLoaded', function() {
    console.log("Payment page loaded");
    
    // Kiểm tra xem đã có dữ liệu bookingData chưa
    if (!sessionStorage.getItem('bookingData')) {
        console.log("Không tìm thấy bookingData, tạo lại từ dữ liệu khác");
        
        try {
            // Lấy thông tin từ sessionStorage
            const selectedFlightData = JSON.parse(sessionStorage.getItem('selectedFlight'));
            const customerInfo = JSON.parse(sessionStorage.getItem('customerInfo'));
            const selectedServices = JSON.parse(sessionStorage.getItem('selectedServices')) || {};
            const promoCode = sessionStorage.getItem('promoCode') || '';
            
            if (selectedFlightData && customerInfo) {
                // Tạo bookingData
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
                        passengerType: passenger.type ? passenger.type.toUpperCase() : 'ADULT',
                        type: passenger.type || 'adult'
                    })) : [],
                    selectedServices: selectedServices,
                    promoCode: promoCode || null
                };
                
                // Lưu lại vào sessionStorage
                sessionStorage.setItem('bookingData', JSON.stringify(bookingData));
                console.log("Đã tạo và lưu bookingData", bookingData);
            } else {
                console.error("Thiếu thông tin cần thiết để tạo bookingData");
            }
        } catch (error) {
            console.error("Lỗi khi tạo bookingData:", error);
        }
    }
    
    // Setup event listeners for payment form
    setupBankTransferForm();
    setupMomoForm();
});

// Setup Bank Transfer Form
function setupBankTransferForm() {
    const bankTransferForm = document.getElementById('bank-transfer-form');
    if (bankTransferForm) {
        bankTransferForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get bank transfer details
            const bankTransferName = document.getElementById('bank-transfer-name').value;
            const bankName = document.getElementById('bank-name').value;
            
            if (!bankTransferName || !bankName) {
                alert('Vui lòng điền đầy đủ thông tin chuyển khoản.');
                return;
            }
            
            // Prepare transaction info
            const transactionInfo = JSON.stringify({
                senderName: bankTransferName,
                bankName: bankName,
                transferDate: new Date().toISOString()
            });
            
            // Process payment with bank transfer method
            processPayment('bank_transfer', transactionInfo);
        });
    }
}

// Setup MoMo Form
function setupMomoForm() {
    const momoForm = document.getElementById('momo-payment-form');
    if (momoForm) {
        momoForm.addEventListener('submit', function(e) {
        e.preventDefault();
            
            // Get MoMo phone number
            const momoPhone = document.getElementById('momo-phone').value;
            
            if (!momoPhone) {
                alert('Vui lòng nhập số điện thoại MoMo.');
                return;
            }
            
            // Validate phone number format (Vietnamese phone number)
            const phoneRegex = /^(0|\+84)(\d{9,10})$/;
            if (!phoneRegex.test(momoPhone)) {
                alert('Số điện thoại MoMo không hợp lệ. Vui lòng nhập đúng định dạng (VD: 0912345678).');
                return;
            }
            
            // Prepare transaction info
            const transactionInfo = JSON.stringify({
                phoneNumber: momoPhone,
                transactionDate: new Date().toISOString()
            });
            
            // Process payment with MoMo method
            processPayment('momo', transactionInfo);
        });
    }
}

// General payment processing function
function processPayment(method, transactionInfo) {
    // Create loading indicator
    const loadingOverlay = createLoadingOverlay();
    document.body.appendChild(loadingOverlay);
        
        // Get booking data from sessionStorage
        const bookingData = sessionStorage.getItem('bookingData');
        
        if (!bookingData) {
            alert('Không tìm thấy thông tin đặt vé. Vui lòng thử lại.');
        document.body.removeChild(loadingOverlay);
            return;
        }
        
    // Get the final total amount including any discounts
    const finalTotalAmount = sessionStorage.getItem('finalPrice') ? 
        parseFloat(sessionStorage.getItem('finalPrice')) : 
        parseFloat(sessionStorage.getItem('totalPriceForPayment'));
    
    // Create a new booking data object with the correct structure
    const bookingDataObj = JSON.parse(bookingData);
    
    // Đảm bảo thông tin hành khách có passengerType đúng định dạng cho API
    if (bookingDataObj.passengers && bookingDataObj.passengers.length > 0) {
        bookingDataObj.passengers = bookingDataObj.passengers.map(passenger => {
            // Nếu có trường type, nhưng không có passengerType, thêm passengerType dựa vào type
            if (passenger.type && !passenger.passengerType) {
                let passengerType;
                switch(passenger.type.toLowerCase()) {
                    case 'child':
                        passengerType = 'CHILD';
                        break;
                    case 'infant':
                        passengerType = 'INFANT';
                        break;
                    default:
                        passengerType = 'ADULT';
                }
                passenger.passengerType = passengerType;
            }
            return passenger;
        });
    }
    
    // Tính toán số lượng hành khách cho từng loại
    const passengerCounts = {
        numAdults: bookingDataObj.passengers.filter(p => 
            (p.type === 'adult' || p.passengerType === 'ADULT')
        ).length,
        numChildren: bookingDataObj.passengers.filter(p => 
            (p.type === 'child' || p.passengerType === 'CHILD')
        ).length, 
        numInfants: bookingDataObj.passengers.filter(p => 
            (p.type === 'infant' || p.passengerType === 'INFANT')
        ).length
    };
    
    // Make sure selectedServices has the right structure and meal info
    // Check if food is selected and convert it to meal property
    if (bookingDataObj.selectedServices) {
        // If food is true, it means meal was selected
        const hasMeal = bookingDataObj.selectedServices.food === true;
        
        // Make sure food key is preserved for backward compatibility
        // and also add/update meal property to match server-side column name
        bookingDataObj.selectedServices = {
            ...bookingDataObj.selectedServices,
            meal: hasMeal
        };
    }
    
    // Add payment details to the booking data
    const apiPayload = {
        ...bookingDataObj,
        totalAmount: finalTotalAmount,
        promoCode: sessionStorage.getItem('appliedPromoCode') || bookingDataObj.promoCode || null,
        passengerCounts: passengerCounts,
        paymentMethod: method,
        transactionInfo: transactionInfo
    };
    
    console.log('Sending booking data with payment details:', apiPayload);
        
        // Send booking data to server
        fetch(`${API_BASE_URL}/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
        body: JSON.stringify(apiPayload)
        })
        .then(response => {
        console.log('Server response status:', response.status);
        
            if (!response.ok) {
            // Get detailed error from server
            return response.json().then(errorData => {
                throw new Error(`Error ${response.status}: ${errorData.error || 'Payment failed'}`);
            });
            }
            return response.json();
        })
        .then(data => {
            // Store booking information
            sessionStorage.setItem('bookingNumber', data.bookingNumber);
            sessionStorage.setItem('bookingId', data.bookingId);
        sessionStorage.setItem('paymentMethod', method);
            sessionStorage.setItem('paymentDate', new Date().toISOString());
        sessionStorage.setItem('totalAmount', finalTotalAmount); // Save total amount
        sessionStorage.setItem('transactionInfo', transactionInfo); // Save transaction info
        
        // Also save passenger counts for reference
        if (passengerCounts) {
            sessionStorage.setItem('passengerCounts', JSON.stringify(passengerCounts));
        }
            
            // Redirect to payment waiting page
            window.location.href = `payment-waiting.html?booking_id=${data.bookingId}`;
        })
        .catch(error => {
            console.error('Payment error:', error);
            
            // Remove loading overlay
        if (document.body.contains(loadingOverlay)) {
            document.body.removeChild(loadingOverlay);
        }
            
            // Show error message
        alert('Có lỗi xảy ra khi xử lý thanh toán: ' + error.message);
    });
}

// Loading overlay
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

// Payment processing modal
function showPaymentProcessingModal() {
    // Create modal elements
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.position = 'fixed';
    modalOverlay.style.top = '0';
    modalOverlay.style.left = '0';
    modalOverlay.style.width = '100%';
    modalOverlay.style.height = '100%';
    modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modalOverlay.style.display = 'flex';
    modalOverlay.style.justifyContent = 'center';
    modalOverlay.style.alignItems = 'center';
    modalOverlay.style.zIndex = '1000';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.backgroundColor = 'white';
    modalContent.style.padding = '40px';
    modalContent.style.borderRadius = '8px';
    modalContent.style.textAlign = 'center';
    modalContent.style.maxWidth = '500px';
    modalContent.style.width = '90%';
    modalContent.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';

    const processingIcon = document.createElement('div');
    processingIcon.innerHTML = '<i class="fas fa-paper-plane" style="font-size: 60px; color: #0066cc; margin-bottom: 20px;"></i>';

    const title = document.createElement('h2');
    title.textContent = 'Đang xử lý đơn hàng...';
    title.style.marginBottom = '15px';
    title.style.color = '#0066cc';

    const message = document.createElement('p');
    message.textContent = 'Đơn đặt vé của bạn đang được xử lý. Vui lòng đợi trong giây lát.';
    message.style.marginBottom = '30px';
    message.style.fontSize = '16px';
    message.style.lineHeight = '1.6';

    // Append elements to modal
    modalContent.appendChild(processingIcon);
    modalContent.appendChild(title);
    modalContent.appendChild(message);
    modalOverlay.appendChild(modalContent);

    // Append modal to body
    document.body.appendChild(modalOverlay);

    // Remove modal after timeout
    setTimeout(() => {
        document.body.removeChild(modalOverlay);
    }, 1500);
}
