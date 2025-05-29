document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const customerTableBody = document.getElementById('customer-table-body');
    const totalCustomersEl = document.getElementById('total-customers');
    const paginationEl = document.getElementById('pagination');
    const filterForm = document.getElementById('filter-form');
    const resetFilterBtn = document.getElementById('reset-filter');
    const customerModal = new bootstrap.Modal(document.getElementById('customer-modal'));
    const deleteModal = new bootstrap.Modal(document.getElementById('delete-modal'));
    const saveCustomerBtn = document.getElementById('save-customer');
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    // State variables
    let currentPage = 1;
    let totalPages = 1;
    let customerId = null;
    let isEditMode = false;
    
    // Pagination settings
    const itemsPerPage = 10;
    
    // API base URL
    const API_BASE_URL = 'http://localhost:3000';
    
    // Initialize the page
    init();
    
    function init() {
        // Load initial customers
        loadCustomers();
        
        // Set up event listeners
        filterForm.addEventListener('submit', handleFilterSubmit);
        resetFilterBtn.addEventListener('click', resetFilters);
        saveCustomerBtn.addEventListener('click', saveCustomer);
        confirmDeleteBtn.addEventListener('click', deleteCustomer);
    }
    
    // API Functions
    async function loadCustomers(filters = {}, page = 1) {
        showLoading(true);
        
        try {
            let url = `${API_BASE_URL}/api/admin/customers`;
            
            // Add query parameters based on filters
            const queryParams = new URLSearchParams();
            queryParams.append('page', page);
            queryParams.append('limit', itemsPerPage);
            
            if (filters.name) queryParams.append('name', filters.name);
            if (filters.email) queryParams.append('email', filters.email);
            if (filters.phone) queryParams.append('phone', filters.phone);
            
            url += '?' + queryParams.toString();
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Failed to fetch customers');
            }
            
            const data = await response.json();
            
            // Update table and pagination
            renderTable(data.customers);
            renderPagination(data.pagination);
            totalCustomersEl.textContent = data.pagination.total;
            currentPage = data.pagination.page;
            totalPages = data.pagination.pages;
        } catch (error) {
            console.error('Error loading customers:', error);
            showAlert('Không thể tải danh sách khách hàng. Vui lòng thử lại sau.', 'danger');
        } finally {
            showLoading(false);
        }
    }
    
    async function loadCustomerDetails(customerId) {
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/customers/${customerId}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch customer details');
            }
            
            const data = await response.json();
            populateCustomerForm(data.customer);
            
            customerModal.show();
        } catch (error) {
            console.error('Error loading customer details:', error);
            showAlert('Không thể tải chi tiết khách hàng. Vui lòng thử lại sau.', 'danger');
        } finally {
            showLoading(false);
        }
    }
    
    async function saveCustomer() {
        const customerData = getCustomerFormData();
        
        if (!validateCustomerData(customerData)) {
            return;
        }
        
        showLoading(true);
        
        try {
            let url = `${API_BASE_URL}/api/admin/customers/${customerId}`;
            let method = 'PUT';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(customerData)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Failed to update customer: ${errorData.error || response.statusText}`);
            }
            
            customerModal.hide();
            showAlert('Khách hàng đã được cập nhật thành công', 'success');
            loadCustomers(getFilterValues(), currentPage);
        } catch (error) {
            console.error('Error saving customer:', error);
            showAlert(`Không thể cập nhật khách hàng. ${error.message}`, 'danger');
        } finally {
            showLoading(false);
        }
    }
    
    async function deleteCustomer() {
        if (!customerId) return;
        
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/customers/${customerId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Failed to delete customer: ${errorData.error || response.statusText}`);
            }
            
            const result = await response.json();
            
            deleteModal.hide();
            showAlert(result.message, 'success');
            loadCustomers(getFilterValues(), currentPage);
        } catch (error) {
            console.error('Error deleting customer:', error);
            showAlert(`Không thể xóa khách hàng. ${error.message}`, 'danger');
        } finally {
            showLoading(false);
            customerId = null;
        }
    }
    
    // UI Functions
    function renderTable(customers) {
        customerTableBody.innerHTML = '';
        
        if (!customers || customers.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="7" class="text-center">Không có khách hàng nào</td>`;
            customerTableBody.appendChild(tr);
            return;
        }
        
        customers.forEach(customer => {
            const tr = document.createElement('tr');
            
            // Format registration date
            const registrationDate = new Date(customer.created_at);
            const formattedRegistrationDate = !isNaN(registrationDate) ? formatDateTime(registrationDate) : 'N/A';
            
            tr.innerHTML = `
                <td>${customer.user_id}</td>
                <td>${customer.fullname}</td>
                <td>${customer.email}</td>
                <td>${customer.phone || 'N/A'}</td>
                <td>${formattedRegistrationDate}</td>
                <td>${customer.total_bookings || 0}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary edit-customer" data-id="${customer.user_id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-customer" data-id="${customer.user_id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            customerTableBody.appendChild(tr);
        });
        
        // Add event listeners for edit and delete buttons
        document.querySelectorAll('.edit-customer').forEach(btn => {
            btn.addEventListener('click', () => showEditCustomerModal(btn.dataset.id));
        });
        
        document.querySelectorAll('.delete-customer').forEach(btn => {
            btn.addEventListener('click', () => showDeleteModal(btn.dataset.id));
        });
    }
    
    function renderPagination(pagination) {
        paginationEl.innerHTML = '';
        
        if (!pagination || pagination.total <= pagination.limit) {
            return;
        }
        
        // Previous button
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${pagination.page === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `<a class="page-link" href="#" aria-label="Previous">
            <span aria-hidden="true">&laquo;</span>
        </a>`;
        prevLi.addEventListener('click', (e) => {
            e.preventDefault();
            if (pagination.page > 1) {
                loadCustomers(getFilterValues(), pagination.page - 1);
            }
        });
        paginationEl.appendChild(prevLi);
        
        // Page numbers
        const startPage = Math.max(1, pagination.page - 2);
        const endPage = Math.min(pagination.pages, pagination.page + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            const pageLi = document.createElement('li');
            pageLi.className = `page-item ${i === pagination.page ? 'active' : ''}`;
            pageLi.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            pageLi.addEventListener('click', (e) => {
                e.preventDefault();
                loadCustomers(getFilterValues(), i);
            });
            paginationEl.appendChild(pageLi);
        }
        
        // Next button
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${pagination.page === pagination.pages ? 'disabled' : ''}`;
        nextLi.innerHTML = `<a class="page-link" href="#" aria-label="Next">
            <span aria-hidden="true">&raquo;</span>
        </a>`;
        nextLi.addEventListener('click', (e) => {
            e.preventDefault();
            if (pagination.page < pagination.pages) {
                loadCustomers(getFilterValues(), pagination.page + 1);
            }
        });
        paginationEl.appendChild(nextLi);
    }
    
    function showEditCustomerModal(id) {
        isEditMode = true;
        customerId = id;
        document.getElementById('customer-modal-label').textContent = 'Chỉnh sửa thông tin khách hàng';
        loadCustomerDetails(id);
    }
    
    function populateCustomerForm(customer) {
        document.getElementById('customer-id').value = customer.user_id;
        document.getElementById('full-name').value = customer.fullname;
        document.getElementById('email').value = customer.email;
        document.getElementById('phone').value = customer.phone || '';
    }
    
    function showDeleteModal(id) {
        customerId = id;
        deleteModal.show();
    }
    
    function resetCustomerForm() {
        document.getElementById('customer-id').value = '';
        document.getElementById('full-name').value = '';
        document.getElementById('email').value = '';
        document.getElementById('phone').value = '';
    }
    
    function handleFilterSubmit(event) {
        event.preventDefault();
        loadCustomers(getFilterValues(), 1);
    }
    
    function resetFilters() {
        filterForm.reset();
        loadCustomers({}, 1);
    }
    
    function getFilterValues() {
        return {
            name: document.getElementById('filter-name').value,
            email: document.getElementById('filter-email').value,
            phone: document.getElementById('filter-phone').value
        };
    }
    
    function getCustomerFormData() {
        return {
            fullname: document.getElementById('full-name').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value
        };
    }
    
    function validateCustomerData(customerData) {
        if (!customerData.fullname) {
            showAlert('Vui lòng nhập họ tên khách hàng', 'warning');
            return false;
        }
        
        if (!customerData.email) {
            showAlert('Vui lòng nhập email khách hàng', 'warning');
            return false;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerData.email)) {
            showAlert('Email không hợp lệ', 'warning');
            return false;
        }
        
        return true;
    }
    
    function showLoading(show) {
        loadingSpinner.style.display = show ? 'flex' : 'none';
    }
    
    function showAlert(message, type = 'info') {
        const alertContainer = document.createElement('div');
        alertContainer.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
        alertContainer.setAttribute('role', 'alert');
        alertContainer.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        document.body.appendChild(alertContainer);
        
        // Auto dismiss after 5 seconds
        setTimeout(() => {
            alertContainer.classList.remove('show');
            setTimeout(() => {
                alertContainer.remove();
            }, 300);
        }, 5000);
    }
    
    function formatDateTime(date) {
        if (!date || isNaN(date)) return 'N/A';
        
        return new Intl.DateTimeFormat('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }
});
