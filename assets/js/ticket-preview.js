// Function to print the ticket
function printTicket() {
    window.print();
}

// For demonstration purposes
document.querySelector('.btn-download').addEventListener('click', function() {
    alert('Tính năng tải xuống PDF sẽ được cập nhật sớm!');
});

document.querySelector('.btn-email').addEventListener('click', function() {
    alert('Vé đã được gửi đến email của bạn!');
});
