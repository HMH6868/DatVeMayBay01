// Accordion functionality
document.addEventListener('DOMContentLoaded', function() {
    const accordionButtons = document.querySelectorAll('.accordion-button');

    accordionButtons.forEach(button => {
        button.addEventListener('click', function() {
            const content = this.parentElement.nextElementSibling;
            const isActive = this.classList.contains('active');

            // Close all accordions
            accordionButtons.forEach(btn => {
                btn.classList.remove('active');
                btn.parentElement.nextElementSibling.classList.remove('active');
            });

            // Open clicked accordion if it was closed
            if (!isActive) {
                this.classList.add('active');
                content.classList.add('active');
            }
        });
    });

    // Category filter functionality
    const categories = document.querySelectorAll('.faq-category');

    categories.forEach(category => {
        category.addEventListener('click', function() {
            categories.forEach(cat => cat.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Search functionality
    const searchInput = document.querySelector('.faq-search input');
    const accordionItems = document.querySelectorAll('.accordion-item');

    searchInput.addEventListener('input', function() {
        const searchValue = this.value.toLowerCase();

        accordionItems.forEach(item => {
            const headerText = item.querySelector('.accordion-button').textContent.toLowerCase();
            const contentText = item.querySelector('.accordion-content').textContent.toLowerCase();

            if (headerText.includes(searchValue) || contentText.includes(searchValue)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    });

    // Chat widget functionality
    const chatWidget = document.querySelector('.chat-widget');

    chatWidget.addEventListener('click', function() {
        alert('Tính năng chat đang được phát triển. Vui lòng quay lại sau!');
    });
});
