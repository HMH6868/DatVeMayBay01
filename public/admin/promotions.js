document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const addPromotionBtn = document.getElementById('add-promotion-btn');
    const promotionModal = new bootstrap.Modal(document.getElementById('promotion-modal'));
    const deleteModal = new bootstrap.Modal(document.getElementById('delete-modal'));
    const promotionForm = document.getElementById('promotion-form');
    const savePromotionBtn = document.getElementById('save-promotion');
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    const filterForm = document.getElementById('filter-form');
    const resetFilterBtn = document.getElementById('reset-filter');
    const promotionTableBody = document.getElementById('promotion-table-body');
    const paginationElement = document.getElementById('pagination');
    const totalPromotionsElement = document.getElementById('total-promotions');
    const loadingSpinner = document.getElementById('loading-spinner');
    const promotionTypeSelect = document.getElementById('promotion-type');
    const discountUnitElement = document.querySelector('.discount-unit');

    // Constants
    const API_URL = 'http://localhost:3000/api/promotions';
    const ITEMS_PER_PAGE = 10;
    let currentPage = 1;
    let totalPages = 1;
    let promotionsData = [];
    let selectedPromotionId = null;
    let isApiAvailable = true; // Track if API is available

    // Event Listeners
    addPromotionBtn.addEventListener('click', openAddPromotionModal);
    savePromotionBtn.addEventListener('click', savePromotion);
    confirmDeleteBtn.addEventListener('click', deletePromotion);
    filterForm.addEventListener('submit', function(event) {
        event.preventDefault();
        currentPage = 1;
        fetchPromotions();
    });
    resetFilterBtn.addEventListener('click', resetFilters);
    
    // Update discount unit when promotion type changes
    if (promotionTypeSelect) {
        promotionTypeSelect.addEventListener('change', updateDiscountUnit);
    }

    // Initialize
    fetchPromotions();

    // Function to update the discount unit display
    function updateDiscountUnit() {
        if (!discountUnitElement) return;
        
        const selectedType = promotionTypeSelect.value;
        if (selectedType === 'percentage') {
            discountUnitElement.textContent = '%';
        } else if (selectedType === 'fixed') {
            discountUnitElement.textContent = 'VND';
        } else {
            discountUnitElement.textContent = '';
        }
    }

    // Functions
    function openAddPromotionModal() {
        document.getElementById('promotion-modal-label').textContent = 'Thêm khuyến mãi mới';
        promotionForm.reset();
        document.getElementById('promotion-id').value = '';
        
        // Set default dates (today and one month from now)
        const today = new Date();
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        
        document.getElementById('promotion-start').value = formatDateTimeForInput(today);
        document.getElementById('promotion-end').value = formatDateTimeForInput(nextMonth);
        
        // Set default promotion type
        document.getElementById('promotion-type').value = 'percentage';
        updateDiscountUnit();
        
        promotionModal.show();
    }

    function openEditPromotionModal(promotionId) {
        document.getElementById('promotion-modal-label').textContent = 'Chỉnh sửa khuyến mãi';
        
        // Instead of trying to find the promotion in the local data,
        // fetch the latest data from the server
        fetchPromotionDetails(promotionId);
    }

    function savePromotion() {
        if (!promotionForm.checkValidity()) {
            promotionForm.reportValidity();
            return;
        }
        
        const promotionId = document.getElementById('promotion-id').value;
        const isNewPromotion = !promotionId;
        
        // Get UI type and map to database discount_type
        const uiType = document.getElementById('promotion-type').value;
        const discountType = uiType === 'percentage' ? 'percent' : uiType;
        
        const promotionData = {
            promo_id: promotionId || null,
            code: document.getElementById('promotion-code').value,
            name: document.getElementById('promotion-name').value,
            discount_type: discountType,
            discount_value: parseFloat(document.getElementById('promotion-value').value),
            valid_from: document.getElementById('promotion-start').value,
            valid_to: document.getElementById('promotion-end').value,
            usage_limit: document.getElementById('promotion-quantity').value ? 
                      parseInt(document.getElementById('promotion-quantity').value) : null,
            description: document.getElementById('promotion-description').value,
            status: document.getElementById('promotion-status').checked ? 'active' : 'inactive'
        };
        
        showLoading();
        
        // If API is known to be unavailable, skip the fetch and just simulate success
        if (!isApiAvailable) {
            simulateSaveSuccess(promotionData, isNewPromotion);
            return;
        }
        
        // Use a more compatible approach with POST and an action parameter
        const endpoint = isNewPromotion ? `${API_URL}/create` : `${API_URL}/update`;
        
        console.log(`${isNewPromotion ? 'Creating' : 'Updating'} promotion:`, promotionData);
        
        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(promotionData)
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 404) {
                    isApiAvailable = false;
                    throw new Error('API không khả dụng (404)');
                }
                return response.text().then(text => {
                    throw new Error(`Network response was not ok: ${text}`);
                });
            }
            return response.json().catch(() => {
                // Some APIs return empty response on success
                return { success: true, message: 'Operation completed successfully' };
            });
        })
        .then(data => {
            console.log('Save response:', data);
            promotionModal.hide();
            
            // Show success message
            showToast(
                isNewPromotion 
                    ? `Thêm khuyến mãi "${promotionData.code}" thành công!` 
                    : `Cập nhật khuyến mãi "${promotionData.code}" thành công!`, 
                'success'
            );
            
            // Reload the data to show the changes
            fetchPromotions();
        })
        .catch(error => {
            console.error('Error saving promotion:', error);
            
            if (error.message.includes('404')) {
                simulateSaveSuccess(promotionData, isNewPromotion);
            } else {
                showToast('Có lỗi xảy ra: ' + error.message, 'error');
                hideLoading();
            }
        });
    }
    
    // Helper function to simulate save success with local data
    function simulateSaveSuccess(promotionData, isNewPromotion) {
        setTimeout(() => {
            console.log('API unavailable, simulating save success with:', promotionData);
            promotionModal.hide();
            
            // Normalize the data for consistent display
            const normalizedPromotion = normalizePromotionData(promotionData);
            
            // Add the promotion to our local data if it's new
            if (isNewPromotion) {
                normalizedPromotion.id = Date.now().toString(); // Generate a temporary ID
                promotionsData.push(normalizedPromotion);
            } else {
                // Update existing promotion in local data
                const index = promotionsData.findIndex(p => 
                    String(p.id) === String(promotionData.promo_id) || 
                    String(p.promo_id) === String(promotionData.promo_id)
                );
                if (index !== -1) {
                    promotionsData[index] = normalizedPromotion;
                }
            }
            
            renderPromotionsTable(promotionsData);
            showToast(
                isNewPromotion 
                    ? `Thêm khuyến mãi "${promotionData.code}" thành công! (dữ liệu mẫu)` 
                    : `Cập nhật khuyến mãi "${promotionData.code}" thành công! (dữ liệu mẫu)`, 
                'success'
            );
            hideLoading();
        }, 500);
    }

    function openDeletePromotionModal(promotionId) {
        selectedPromotionId = promotionId;
        deleteModal.show();
    }

    function deletePromotion() {
        if (!selectedPromotionId) return;
        
        showLoading();
        
        // If API is known to be unavailable, skip the fetch and just simulate success
        if (!isApiAvailable) {
            simulateDeleteSuccess();
            return;
        }
        
        // Use POST method with a specific action parameter instead of DELETE
        // This is often more compatible with various backend setups
        fetch(`${API_URL}/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ promo_id: selectedPromotionId })
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 404) {
                    isApiAvailable = false;
                    throw new Error('API không khả dụng (404)');
                }
                return response.text().then(text => {
                    throw new Error(`Network response was not ok: ${text}`);
                });
            }
            return response.json().catch(() => ({})); // Handle empty response
        })
        .then(data => {
            console.log('Delete response:', data);
            deleteModal.hide();
            fetchPromotions();
            showToast('Xóa khuyến mãi thành công!', 'success');
        })
        .catch(error => {
            console.error('Error deleting promotion:', error);
            
            if (error.message.includes('404')) {
                simulateDeleteSuccess();
            } else {
                showToast('Có lỗi xảy ra: ' + error.message, 'error');
                hideLoading();
                selectedPromotionId = null;
            }
        });
    }
    
    // Helper function to simulate delete success with local data
    function simulateDeleteSuccess() {
        console.log('Simulating deletion success');
        deleteModal.hide();
        
        // Remove the promotion from local data
        const index = promotionsData.findIndex(p => 
            String(p.id) === String(selectedPromotionId) || 
            String(p.promo_id) === String(selectedPromotionId)
        );
        
        if (index !== -1) {
            const deletedCode = promotionsData[index].code;
            promotionsData.splice(index, 1);
            renderPromotionsTable(promotionsData);
            showToast(`Xóa khuyến mãi "${deletedCode}" thành công! (dữ liệu mẫu)`, 'success');
        } else {
            showToast('Không tìm thấy mã khuyến mãi để xóa', 'error');
        }
        
        hideLoading();
        selectedPromotionId = null;
    }

    function fetchPromotions() {
        showLoading();
        
        // Get filter values
        const filterCode = document.getElementById('filter-code').value;
        const filterStatus = document.getElementById('filter-status').value;
        const filterType = document.getElementById('filter-type').value;
        const filterDate = document.getElementById('filter-date').value;
        
        // Build query parameters
        const params = new URLSearchParams();
        if (filterCode) params.append('code', filterCode);
        if (filterStatus) params.append('status', filterStatus);
        if (filterType) params.append('type', filterType);
        if (filterDate) params.append('validUntil', filterDate);
        params.append('page', currentPage);
        params.append('limit', ITEMS_PER_PAGE);
        
        // Only attempt API call if we think it's available
        if (isApiAvailable) {
            // Use real API
            fetch(`${API_URL}?${params.toString()}`)
                .then(response => {
                    if (!response.ok) {
                        if (response.status === 404) {
                            // API endpoint not found
                            isApiAvailable = false;
                            console.error('API endpoint not found. Using mock data instead.');
                            throw new Error('API endpoint not found (404)');
                        }
                        return response.text().then(text => {
                            throw new Error(`Network response was not ok: ${text}`);
                        });
                    }
            isApiAvailable = true; // Confirm API is available
            return response.json();
        })
        .then(data => {
            console.log('API response:', data);
            
            // If API returns data in a different format, adapt accordingly
            let items, totalItems, totalPages;
            
            if (Array.isArray(data)) {
                // If API returns just an array of promotions
                items = data;
                totalItems = data.length;
                totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
            } else if (data.items) {
                // If API returns the expected format
                items = data.items;
                totalItems = data.totalItems;
                totalPages = data.totalPages;
            } else {
                // If API returns data in some other format
                items = data.promotions || data.data || data;
                totalItems = items.length;
                totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
            }
            
            // Standardize data format for consistent display
            const normalizedItems = items.map(normalizePromotionData);
            
            promotionsData = normalizedItems;
            renderPromotionsTable(normalizedItems);
            renderPagination(totalItems, totalPages);
            hideLoading();
        })
        .catch(error => {
            console.error('Error fetching promotions:', error);
            
            if (!isApiAvailable) {
                showToast('API không khả dụng. Sử dụng dữ liệu mẫu.', 'warning');
            } else {
                showToast('Không thể tải danh sách khuyến mãi. Sử dụng dữ liệu mẫu.', 'error');
            }
            
            // Fallback to mock data if API fails
            const mockData = generateMockPromotions(filterCode, filterStatus, filterType, filterDate);
            promotionsData = mockData.items;
            renderPromotionsTable(mockData.items);
            renderPagination(mockData.totalItems, mockData.totalPages);
            hideLoading();
        });
    } else {
        // Use mock data directly if we know API is unavailable
        console.log('Using mock data (API previously unavailable)');
        const mockData = generateMockPromotions(filterCode, filterStatus, filterType, filterDate);
        promotionsData = mockData.items;
        renderPromotionsTable(mockData.items);
        renderPagination(mockData.totalItems, mockData.totalPages);
        hideLoading();
    }
}

// Add this function to fetch a single promotion for editing
function fetchPromotionDetails(promotionId) {
    showLoading();
    
    if (!isApiAvailable) {
        // If API is known to be unavailable, use mock data directly
        const mockPromotion = findMockPromotionById(promotionId);
        if (mockPromotion) {
            populateEditForm(mockPromotion);
        } else {
            showToast('Không tìm thấy mã khuyến mãi', 'error');
            hideLoading();
            promotionModal.hide();
        }
        return;
    }
    
    // Since individual promotion endpoint doesn't work, get all promotions and filter
    fetch(API_URL)
        .then(response => {
            if (!response.ok) {
                throw new Error('Không thể tải danh sách khuyến mãi');
            }
            return response.json();
        })
        .then(data => {
            console.log('All promotions data:', data);
            
            // Find the promotion with matching ID
            const promotion = data.find(p => 
                String(p.promo_id) === String(promotionId) || 
                String(p.id) === String(promotionId)
            );
            
            if (promotion) {
                populateEditForm(promotion);
            } else {
                throw new Error('Không tìm thấy mã khuyến mãi');
            }
        })
        .catch(error => {
            console.error('Error fetching promotion details:', error);
            showToast('Không thể tải thông tin mã khuyến mãi: ' + error.message, 'error');
            
            // Try with mock data as fallback
            const mockPromotion = findMockPromotionById(promotionId);
            if (mockPromotion) {
                populateEditForm(mockPromotion);
                showToast('Đang sử dụng dữ liệu mẫu thay thế', 'warning');
            } else {
                hideLoading();
                promotionModal.hide();
            }
        });
}

// Helper function to find a promotion in mock data
function findMockPromotionById(promotionId) {
    // Convert to string for comparison
    const idStr = String(promotionId);
    
    // Check if we already have the promotion in our data
    let promotion = promotionsData.find(p => String(p.id) === idStr || String(p.promo_id) === idStr);
    
    if (!promotion) {
        // Generate mock data and search in it
        const mockData = generateMockPromotions('', '', '', '');
        promotion = mockData.items.find(p => String(p.id) === idStr);
    }
    
    return promotion;
}
    
// Separate function to populate the edit form
function populateEditForm(promotion) {
    // Normalize data to ensure consistent field naming
    const normalizedPromotion = normalizePromotionData(promotion);
    
    document.getElementById('promotion-id').value = normalizedPromotion.id;
    document.getElementById('promotion-code').value = normalizedPromotion.code;
    document.getElementById('promotion-name').value = normalizedPromotion.name;
    
    // Set type field based on discount_type
    let uiType = 'fixed';
    if (normalizedPromotion.type === 'percentage' || 
        normalizedPromotion.type === 'percent' || 
        promotion.discount_type === 'percent') {
        uiType = 'percentage';
    } else if (normalizedPromotion.type === 'special') {
        uiType = 'special';
    }
    document.getElementById('promotion-type').value = uiType;
    
    document.getElementById('promotion-value').value = normalizedPromotion.value;
    
    // Update the discount unit display based on promotion type
    updateDiscountUnit();
    
    try {
        // Handle date formatting safely
        const startDate = new Date(normalizedPromotion.startDate);
        const endDate = new Date(normalizedPromotion.endDate);
        
        if (!isNaN(startDate.getTime())) {
            document.getElementById('promotion-start').value = formatDateTimeForInput(startDate);
        } else {
            document.getElementById('promotion-start').value = formatDateTimeForInput(new Date());
        }
        
        if (!isNaN(endDate.getTime())) {
            document.getElementById('promotion-end').value = formatDateTimeForInput(endDate);
        } else {
            const defaultEndDate = new Date();
            defaultEndDate.setMonth(defaultEndDate.getMonth() + 1);
            document.getElementById('promotion-end').value = formatDateTimeForInput(defaultEndDate);
        }
    } catch (error) {
        console.error('Error formatting dates:', error);
        // Use current date if there's an error
        const today = new Date();
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        
        document.getElementById('promotion-start').value = formatDateTimeForInput(today);
        document.getElementById('promotion-end').value = formatDateTimeForInput(nextMonth);
    }
    
    document.getElementById('promotion-quantity').value = normalizedPromotion.quantity || '';
    document.getElementById('promotion-description').value = normalizedPromotion.description || '';
    document.getElementById('promotion-status').checked = normalizedPromotion.status === 'active';
    
    hideLoading();
    promotionModal.show();
}

// Normalize promotion data to handle different API response formats
function normalizePromotionData(promotion) {
    // Map discount_type from database to UI format
    let displayType = promotion.type || promotion.discount_type || 'percentage';
    if (displayType === 'percent') {
        displayType = 'percentage';
    }
    
    return {
        id: promotion.promo_id || promotion.id || promotion._id || '',
        code: promotion.code || '',
        name: promotion.name || '',
        type: displayType,
        value: promotion.discount_value || promotion.value || 0,
        startDate: promotion.valid_from || promotion.startDate || promotion.start_date || '',
        endDate: promotion.valid_to || promotion.endDate || promotion.end_date || '',
        quantity: (promotion.usage_limit !== undefined) ? promotion.usage_limit : 
                (promotion.quantity !== undefined) ? promotion.quantity : null,
        usedCount: promotion.used_count || promotion.usedCount || 0,
        description: promotion.description || '',
        status: promotion.status || 'inactive'
    };
}

function renderPromotionsTable(promotions) {
    promotionTableBody.innerHTML = '';
    
    if (promotions.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="10" class="text-center py-4">
                <i class="fas fa-search me-2"></i>
                Không tìm thấy khuyến mãi nào
            </td>
        `;
        promotionTableBody.appendChild(emptyRow);
        return;
    }
    
    promotions.forEach(promotion => {
        const row = document.createElement('tr');
        
        // Safely access properties with fallbacks to avoid undefined values
        const id = promotion.id || '';
        const code = promotion.code || '';
        const type = promotion.type || 'percentage';
        const value = promotion.value || 0;
        const startDate = promotion.startDate || '';
        const endDate = promotion.endDate || '';
        const quantity = (promotion.quantity !== undefined) ? promotion.quantity : null;
        const usedCount = promotion.usedCount || 0;
        const status = promotion.status || 'inactive';
        
        // Format values based on promotion type
        let valueDisplay = '';
        if (type === 'percentage' || type === 'percent') {
            valueDisplay = `${value}%`;
        } else if (type === 'fixed') {
            valueDisplay = formatCurrency(value);
        } else {
            valueDisplay = 'Khuyến mãi đặc biệt';
        }
        
        // Format status badge
        let statusBadge = '';
        switch (status) {
            case 'active':
                statusBadge = '<span class="promotion-badge badge-active">Đang hoạt động</span>';
                break;
            case 'inactive':
                statusBadge = '<span class="promotion-badge badge-inactive">Không hoạt động</span>';
                break;
            case 'expired':
                statusBadge = '<span class="promotion-badge badge-expired">Hết hạn</span>';
                break;
            case 'scheduled':
                statusBadge = '<span class="promotion-badge badge-scheduled">Lên lịch</span>';
                break;
            default:
                statusBadge = status;
        }
        
        row.innerHTML = `
            <td>${id}</td>
            <td><strong>${code}</strong></td>
            <td>${getPromotionTypeLabel(type)}</td>
            <td>${valueDisplay}</td>
            <td>${formatDateSafely(startDate)}</td>
            <td>${formatDateSafely(endDate)}</td>
            <td>${quantity !== null ? quantity : 'Không giới hạn'}</td>
            <td>${usedCount}</td>
            <td>${statusBadge}</td>
            <td>
                <div class="btn-group btn-group-sm" role="group">
                    <button type="button" class="btn btn-outline-primary edit-promotion-btn" data-id="${id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" class="btn btn-outline-danger delete-promotion-btn" data-id="${id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        promotionTableBody.appendChild(row);
    });
    
    // Add event listeners to action buttons
    document.querySelectorAll('.edit-promotion-btn').forEach(button => {
        button.addEventListener('click', () => {
            openEditPromotionModal(button.getAttribute('data-id'));
        });
    });
    
    document.querySelectorAll('.delete-promotion-btn').forEach(button => {
        button.addEventListener('click', () => {
            openDeletePromotionModal(button.getAttribute('data-id'));
        });
    });
}

function renderPagination(totalItems, totalPages) {
    totalPromotionsElement.textContent = totalItems;
    this.totalPages = totalPages;
    
    paginationElement.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Previous button
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `
        <button class="page-link" aria-label="Previous">
            <span aria-hidden="true">&laquo;</span>
        </button>
    `;
    if (currentPage > 1) {
        prevLi.querySelector('button').addEventListener('click', () => {
            currentPage--;
            fetchPromotions();
        });
    }
    paginationElement.appendChild(prevLi);
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageLi = document.createElement('li');
        pageLi.className = `page-item ${i === currentPage ? 'active' : ''}`;
        pageLi.innerHTML = `<button class="page-link">${i}</button>`;
        
        if (i !== currentPage) {
            pageLi.querySelector('button').addEventListener('click', () => {
                currentPage = i;
                fetchPromotions();
            });
        }
        
        paginationElement.appendChild(pageLi);
    }
    
    // Next button
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `
        <button class="page-link" aria-label="Next">
            <span aria-hidden="true">&raquo;</span>
        </button>
    `;
    if (currentPage < totalPages) {
        nextLi.querySelector('button').addEventListener('click', () => {
            currentPage++;
            fetchPromotions();
        });
    }
    paginationElement.appendChild(nextLi);
}

function resetFilters() {
    filterForm.reset();
    currentPage = 1;
    fetchPromotions();
}

function showLoading() {
    loadingSpinner.style.display = 'flex';
}

function hideLoading() {
    loadingSpinner.style.display = 'none';
}

function showToast(message, type = 'info') {
    // Create a Bootstrap toast notification
    const toastId = 'toast-' + Date.now();
    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-white bg-${getToastBgColor(type)} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    <i class="${getToastIcon(type)} me-2"></i>
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    // Add toast to container
    toastContainer.innerHTML += toastHTML;
    
    // Initialize and show the toast
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
    toast.show();
    
    // Remove toast element after it's hidden
    toastElement.addEventListener('hidden.bs.toast', function () {
        toastElement.remove();
    });
}
    
// Helper functions for toast notifications
function getToastBgColor(type) {
    switch (type) {
        case 'success': return 'success';
        case 'error': return 'danger';
        case 'warning': return 'warning';
        default: return 'primary';
    }
}
    
function getToastIcon(type) {
    switch (type) {
        case 'success': return 'fas fa-check-circle';
        case 'error': return 'fas fa-exclamation-circle';
        case 'warning': return 'fas fa-exclamation-triangle';
        default: return 'fas fa-info-circle';
    }
}

// Helper Functions
function formatDateSafely(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';
        
        return date.toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('Date formatting error:', error);
        return 'N/A';
    }
}

function formatDate(dateString) {
    return formatDateSafely(dateString);
}

function formatDateTimeForInput(date) {
    try {
        if (!date) return '';
        
        // If it's already a valid date string in the right format, return it
        if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
            return date;
        }
        
        // Make sure we have a valid date object
        const validDate = new Date(date);
        if (isNaN(validDate.getTime())) {
            console.warn('Invalid date provided to formatDateTimeForInput:', date);
            return '';
        }
        
        // Format to YYYY-MM-DDTHH:MM
        const year = validDate.getFullYear();
        const month = String(validDate.getMonth() + 1).padStart(2, '0');
        const day = String(validDate.getDate()).padStart(2, '0');
        const hours = String(validDate.getHours()).padStart(2, '0');
        const minutes = String(validDate.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (error) {
        console.error('Error formatting date for input:', error);
        return '';
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

function getPromotionTypeLabel(type) {
    switch (type) {
        case 'percentage':
        case 'percent':
            return 'Giảm %';
        case 'fixed':
            return 'Giảm tiền cố định';
        case 'special':
            return 'Đặc biệt';
        default:
            return type;
    }
}

// Mock Data Generator (for demo purposes)
function generateMockPromotions(filterCode, filterStatus, filterType, filterDate) {
    const mockPromotions = [
        {
            id: '1',
            code: 'SUMMER2023',
            name: 'Khuyến mãi hè 2023',
            type: 'percentage',
            value: 15,
            startDate: '2023-06-01T00:00:00',
            endDate: '2023-08-31T23:59:59',
            quantity: 1000,
            usedCount: 742,
            description: 'Khuyến mãi hè 2023 giảm 15% cho tất cả các chuyến bay',
            status: 'expired'
        },
        {
            id: '2',
            code: 'NEWYEAR2024',
            name: 'Chào Năm Mới 2024',
            type: 'percentage',
            value: 20,
            startDate: '2023-12-15T00:00:00',
            endDate: '2024-01-15T23:59:59',
            quantity: 500,
            usedCount: 213,
            description: 'Khuyến mãi đặc biệt mừng năm mới 2024',
            status: 'active'
        },
        {
            id: '3',
            code: 'WELCOME500',
            name: 'Chào mừng thành viên mới',
            type: 'fixed',
            value: 500000,
            startDate: '2023-01-01T00:00:00',
            endDate: '2024-12-31T23:59:59',
            quantity: null,
            usedCount: 1254,
            description: 'Khuyến mãi dành cho thành viên mới của FlyViet',
            status: 'active'
        },
        {
            id: '4',
            code: 'HANOI2SAIGON',
            name: 'Ưu đãi tuyến Hà Nội - HCM',
            type: 'percentage',
            value: 10,
            startDate: '2023-09-01T00:00:00',
            endDate: '2023-12-31T23:59:59',
            quantity: 200,
            usedCount: 198,
            description: 'Ưu đãi đặc biệt cho tuyến bay Hà Nội - Hồ Chí Minh',
            status: 'expired'
        },
        {
            id: '5',
            code: 'TET2024',
            name: 'Khuyến mãi Tết 2024',
            type: 'percentage',
            value: 25,
            startDate: '2024-01-20T00:00:00',
            endDate: '2024-02-20T23:59:59',
            quantity: 300,
            usedCount: 0,
            description: 'Khuyến mãi đặc biệt dịp Tết Nguyên Đán 2024',
            status: 'scheduled'
        },
        {
            id: '6',
            code: 'WEEKEND10',
            name: 'Ưu đãi cuối tuần',
            type: 'percentage',
            value: 10,
            startDate: '2023-11-01T00:00:00',
            endDate: '2024-12-31T23:59:59',
            quantity: null,
            usedCount: 87,
            description: 'Ưu đãi 10% cho chuyến bay cuối tuần',
            status: 'active'
        },
        {
            id: '7',
            code: 'VIPGUEST',
            name: 'Khách hàng VIP',
            type: 'percentage',
            value: 30,
            startDate: '2023-01-01T00:00:00',
            endDate: '2024-12-31T23:59:59',
            quantity: 50,
            usedCount: 12,
            description: 'Khuyến mãi dành cho khách hàng VIP',
            status: 'active'
        },
        {
            id: '8',
            code: 'APP1000K',
            name: 'Ưu đãi đặt qua ứng dụng',
            type: 'fixed',
            value: 1000000,
            startDate: '2023-10-01T00:00:00',
            endDate: '2024-03-31T23:59:59',
            quantity: 100,
            usedCount: 78,
            description: 'Giảm 1 triệu đồng khi đặt vé qua ứng dụng di động',
            status: 'active'
        },
        {
            id: '9',
            code: 'FLASHSALE',
            name: 'Flash Sale 12.12',
            type: 'percentage',
            value: 50,
            startDate: '2023-12-12T00:00:00',
            endDate: '2023-12-12T23:59:59',
            quantity: 50,
            usedCount: 50,
            description: 'Flash sale ngày 12.12 giảm 50% tất cả các chuyến bay',
            status: 'expired'
        },
        {
            id: '10',
            code: 'FAMILY2024',
            name: 'Ưu đãi gia đình 2024',
            type: 'special',
            value: 0,
            startDate: '2024-01-01T00:00:00',
            endDate: '2024-12-31T23:59:59',
            quantity: null,
            usedCount: 23,
            description: 'Mua 3 vé người lớn được tặng 1 vé trẻ em',
            status: 'active'
        }
    ];
    
    // Apply filters
    let filteredPromotions = [...mockPromotions];
    
    if (filterCode) {
        filteredPromotions = filteredPromotions.filter(p => 
            p.code.toLowerCase().includes(filterCode.toLowerCase()) ||
            p.name.toLowerCase().includes(filterCode.toLowerCase())
        );
    }
    
    if (filterStatus) {
        filteredPromotions = filteredPromotions.filter(p => p.status === filterStatus);
    }
    
    if (filterType) {
        filteredPromotions = filteredPromotions.filter(p => p.type === filterType);
    }
    
    if (filterDate) {
        const filterDateObj = new Date(filterDate);
        filteredPromotions = filteredPromotions.filter(p => {
            const endDate = new Date(p.endDate);
            return endDate >= filterDateObj;
        });
    }
    
    // Pagination
    const totalItems = filteredPromotions.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const paginatedPromotions = filteredPromotions.slice(start, end);
    
    return {
        items: paginatedPromotions,
        totalItems: totalItems,
        totalPages: totalPages
    };
}
}); 