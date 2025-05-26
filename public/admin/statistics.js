document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const dateRangeSelect = document.getElementById('date-range');
    const fromDateContainer = document.getElementById('from-date-container');
    const toDateContainer = document.getElementById('to-date-container');
    const fromDateInput = document.getElementById('from-date');
    const toDateInput = document.getElementById('to-date');
    const filterForm = document.getElementById('filter-form');
    const exportPdfBtn = document.getElementById('export-pdf');
    const exportExcelBtn = document.getElementById('export-excel');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    // Chart instances
    let revenueChart, bookingsChart, routesChart, statusChart;
    
    // State variables
    let currentDateRange = 'week';
    let stats = {
        current: {},
        previous: {}
    };
    
    // Initialize the page
    init();
    
    function init() {
        // Set up date range event listener
        dateRangeSelect.addEventListener('change', handleDateRangeChange);
        
        // Set up filter form submit
        filterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            loadStatistics();
        });
        
        // Set up export buttons
        exportPdfBtn.addEventListener('click', exportPdf);
        exportExcelBtn.addEventListener('click', exportExcel);
        
        // Set default date range (last 7 days)
        setupDefaultDateRange();
        
        // Initial statistics load
        loadStatistics();
    }
    
    function setupDefaultDateRange() {
        const today = new Date();
        
        // Set 'to' date to today
        const toDate = today.toISOString().split('T')[0];
        toDateInput.value = toDate;
        
        // Set 'from' date to 7 days ago for default view
        const fromDate = new Date();
        fromDate.setDate(today.getDate() - 7);
        fromDateInput.value = fromDate.toISOString().split('T')[0];
    }
    
    function handleDateRangeChange() {
        const selectedRange = dateRangeSelect.value;
        currentDateRange = selectedRange;
        
        // Show/hide custom date inputs
        if (selectedRange === 'custom') {
            fromDateContainer.style.display = 'block';
            toDateContainer.style.display = 'block';
        } else {
            fromDateContainer.style.display = 'none';
            toDateContainer.style.display = 'none';
            
            // Calculate and set date range based on selection
            const { fromDate, toDate } = calculateDateRange(selectedRange);
            fromDateInput.value = fromDate;
            toDateInput.value = toDate;
            
            // Auto-submit when selecting a predefined range
            loadStatistics();
        }
    }
    
    function calculateDateRange(rangeType) {
        const today = new Date();
        let fromDate = new Date(today);
        let toDate = new Date(today);
        
        // Always set time to end of day for "to" date
        toDate.setHours(23, 59, 59, 999);
        
        switch (rangeType) {
            case 'today':
                // From = start of today, To = end of today
                fromDate.setHours(0, 0, 0, 0);
                break;
                
            case 'yesterday':
                // From = start of yesterday, To = end of yesterday
                fromDate.setDate(today.getDate() - 1);
                fromDate.setHours(0, 0, 0, 0);
                toDate.setDate(today.getDate() - 1);
                break;
                
            case 'week':
                // From = 7 days ago, To = today
                fromDate.setDate(today.getDate() - 7);
                fromDate.setHours(0, 0, 0, 0);
                break;
                
            case 'month':
                // From = 30 days ago, To = today
                fromDate.setDate(today.getDate() - 30);
                fromDate.setHours(0, 0, 0, 0);
                break;
                
            case 'quarter':
                // From = start of current quarter, To = today
                const quarterMonth = Math.floor(today.getMonth() / 3) * 3;
                fromDate = new Date(today.getFullYear(), quarterMonth, 1);
                fromDate.setHours(0, 0, 0, 0);
                break;
                
            case 'year':
                // From = start of current year, To = today
                fromDate = new Date(today.getFullYear(), 0, 1);
                fromDate.setHours(0, 0, 0, 0);
                break;
        }
        
        return {
            fromDate: fromDate.toISOString().split('T')[0],
            toDate: toDate.toISOString().split('T')[0]
        };
    }
    
    // API Functions
    async function loadStatistics() {
        showLoading(true);
        
        try {
            // Get date range values
            const fromDate = fromDateInput.value;
            const toDate = toDateInput.value;
            
            // Calculate previous period (same duration, immediately before selected period)
            const currentStart = new Date(fromDate);
            const currentEnd = new Date(toDate);
            const daysDiff = Math.round((currentEnd - currentStart) / (1000 * 60 * 60 * 24));
            
            const previousEnd = new Date(currentStart);
            previousEnd.setDate(previousEnd.getDate() - 1);
            
            const previousStart = new Date(previousEnd);
            previousStart.setDate(previousStart.getDate() - daysDiff);
            
            const previousFromDate = previousStart.toISOString().split('T')[0];
            const previousToDate = previousEnd.toISOString().split('T')[0];
            
            // Initialize with default values
            stats.current = {
                totalBookings: 0,
                totalRevenue: 0,
                totalPassengers: 0,
                revenueByDate: [],
                bookingsByDate: [],
                bookingsByStatus: [],
                popularRoutes: []
            };
            
            stats.previous = {
                totalBookings: 0,
                totalRevenue: 0,
                totalPassengers: 0
            };
            
            // Use the new comparison endpoint
            try {
                const comparisonUrl = `http://localhost:3000/api/admin/statistics/compare?currentFromDate=${fromDate}&currentToDate=${toDate}&previousFromDate=${previousFromDate}&previousToDate=${previousToDate}`;
                
                const response = await fetch(comparisonUrl);
                
                if (response.ok) {
                    const comparisonData = await response.json();
                    
                    // Update our states
                    if (comparisonData.current) {
                        stats.current.totalBookings = comparisonData.current.totalBookings || 0;
                        stats.current.totalRevenue = comparisonData.current.totalRevenue || 0;
                        stats.current.totalPassengers = comparisonData.current.totalPassengers || 0;
                    }
                    
                    if (comparisonData.previous) {
                        stats.previous = comparisonData.previous;
                    }
                    
                    console.log('Comparison data loaded:', comparisonData);
                } else {
                    console.warn('Failed to fetch comparison data:', await response.text());
                }
            } catch (comparisonError) {
                console.error('Error in comparison fetch:', comparisonError);
            }
            
            // Fetch more detailed current period statistics for charts
            try {
                const detailsResponse = await fetch(`http://localhost:3000/api/admin/statistics?fromDate=${fromDate}&toDate=${toDate}`);
                
                if (detailsResponse.ok) {
                    const detailsData = await detailsResponse.json();
                    
                    // Merge the detailed data with our current stats
                    if (detailsData.revenueByDate) stats.current.revenueByDate = detailsData.revenueByDate;
                    if (detailsData.bookingsByDate) stats.current.bookingsByDate = detailsData.bookingsByDate;
                    if (detailsData.bookingsByStatus) stats.current.bookingsByStatus = detailsData.bookingsByStatus;
                    if (detailsData.popularRoutes) stats.current.popularRoutes = detailsData.popularRoutes;
                    
                    // Make sure we have the core metrics even if comparison failed
                    if (detailsData.totalBookings !== undefined) stats.current.totalBookings = detailsData.totalBookings;
                    if (detailsData.totalRevenue !== undefined) stats.current.totalRevenue = detailsData.totalRevenue;
                    if (detailsData.totalPassengers !== undefined) stats.current.totalPassengers = detailsData.totalPassengers;
                    
                    console.log('Details data loaded:', detailsData);
                } else {
                    console.warn('Failed to fetch details data:', await detailsResponse.text());
                }
            } catch (detailsError) {
                console.error('Error in details fetch:', detailsError);
            }
            
            // Update UI with the statistics
            updateStatisticCards();
            updateCharts();
            updateTopRoutesTable();
            
        } catch (error) {
            console.error('Error loading statistics:', error);
            showAlert('Không thể tải dữ liệu thống kê. Vui lòng thử lại sau.', 'danger');
            
            // Still update the UI with default values
            updateStatisticCards();
            updateCharts();
            updateTopRoutesTable();
        } finally {
            showLoading(false);
        }
    }
    
    // UI Functions
    function updateStatisticCards() {
        // Extract values
        const current = stats.current || {};
        const previous = stats.previous || {};
        
        // Check if we have the necessary data
        const totalBookings = current.totalBookings || 0;
        const totalRevenue = current.totalRevenue || 0;
        const totalPassengers = current.totalPassengers || 0;
        
        const prevTotalBookings = previous.totalBookings || 0;
        const prevTotalRevenue = previous.totalRevenue || 0;
        const prevTotalPassengers = previous.totalPassengers || 0;
        
        // Calculate percentage changes
        const bookingsChange = calculatePercentageChange(totalBookings, prevTotalBookings);
        const revenueChange = calculatePercentageChange(totalRevenue, prevTotalRevenue);
        const passengersChange = calculatePercentageChange(totalPassengers, prevTotalPassengers);
        
        // Update summary cards with default values if data is unavailable
        document.getElementById('total-bookings').textContent = formatNumber(totalBookings);
        document.getElementById('total-revenue').textContent = formatCurrency(totalRevenue);
        document.getElementById('total-passengers').textContent = formatNumber(totalPassengers);
        
        // Update comparison indicators
        updateComparisonIndicator('bookings-comparison', bookingsChange);
        updateComparisonIndicator('revenue-comparison', revenueChange);
        updateComparisonIndicator('passengers-comparison', passengersChange);
        
        console.log('Stats updated:', {
            current: {
                totalBookings,
                totalRevenue,
                totalPassengers
            },
            previous: {
                totalBookings: prevTotalBookings,
                totalRevenue: prevTotalRevenue,
                totalPassengers: prevTotalPassengers
            },
            changes: {
                bookingsChange,
                revenueChange, 
                passengersChange
            }
        });
    }
    
    function updateComparisonIndicator(elementId, percentageChange) {
        const element = document.getElementById(elementId);
        
        // Format percentage with sign and icon
        const formattedPercentage = Math.abs(percentageChange).toFixed(1) + '%';
        
        if (percentageChange > 0) {
            element.className = 'text-success';
            element.innerHTML = `<small><i class="fas fa-arrow-up"></i> ${formattedPercentage}</small>`;
        } else if (percentageChange < 0) {
            element.className = 'text-danger';
            element.innerHTML = `<small><i class="fas fa-arrow-down"></i> ${formattedPercentage}</small>`;
        } else {
            element.className = 'text-secondary';
            element.innerHTML = `<small><i class="fas fa-minus"></i> ${formattedPercentage}</small>`;
        }
    }
    
    function updateCharts() {
        // Update Revenue Chart
        updateRevenueChart();
        
        // Update Bookings Chart
        updateBookingsChart();
        
        // Update Routes Chart
        updateRoutesChart();
        
        // Update Status Chart
        updateStatusChart();
    }
    
    function updateRevenueChart() {
        const ctx = document.getElementById('revenue-chart').getContext('2d');
        
        // Destroy previous chart instance if it exists
        if (revenueChart) {
            revenueChart.destroy();
        }
        
        // Prepare data
        const revenueByDate = stats.current.revenueByDate || [];
        
        // Handle empty data
        if (revenueByDate.length === 0) {
            // Create an empty chart
            revenueChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Không có dữ liệu'],
                    datasets: [{
                        label: 'Doanh thu (VND)',
                        data: [0],
                        backgroundColor: 'rgba(40, 167, 69, 0.2)',
                        borderColor: 'rgba(40, 167, 69, 1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return formatCurrencyCompact(value);
                                }
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return formatCurrency(context.parsed.y);
                                }
                            }
                        }
                    }
                }
            });
            return;
        }
        
        const labels = revenueByDate.map(item => item.date);
        const data = revenueByDate.map(item => item.amount || 0);
        
        // Create new chart
        revenueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Doanh thu (VND)',
                    data: data,
                    backgroundColor: 'rgba(40, 167, 69, 0.2)',
                    borderColor: 'rgba(40, 167, 69, 1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrencyCompact(value);
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return formatCurrency(context.parsed.y);
                            }
                        }
                    }
                }
            }
        });
    }
    
    function updateBookingsChart() {
        const ctx = document.getElementById('bookings-chart').getContext('2d');
        
        // Destroy previous chart instance if it exists
        if (bookingsChart) {
            bookingsChart.destroy();
        }
        
        // Prepare data
        const bookingsByDate = stats.current.bookingsByDate || [];
        
        // Handle empty data
        if (bookingsByDate.length === 0) {
            // Create an empty chart
            bookingsChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Không có dữ liệu'],
                    datasets: [{
                        label: 'Số lượng đặt vé',
                        data: [0],
                        backgroundColor: 'rgba(0, 123, 255, 0.7)',
                        borderWidth: 0,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    }
                }
            });
            return;
        }
        
        const labels = bookingsByDate.map(item => item.date);
        const data = bookingsByDate.map(item => item.count || 0);
        
        // Create new chart
        bookingsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Số lượng đặt vé',
                    data: data,
                    backgroundColor: 'rgba(0, 123, 255, 0.7)',
                    borderWidth: 0,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }
    
    function updateRoutesChart() {
        const ctx = document.getElementById('routes-chart').getContext('2d');
        
        // Destroy previous chart instance if it exists
        if (routesChart) {
            routesChart.destroy();
        }
        
        // Prepare data
        const popularRoutes = stats.current.popularRoutes || [];
        
        // Handle empty data
        if (popularRoutes.length === 0) {
            // Create an empty chart
            routesChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: ['Không có dữ liệu'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['rgba(108, 117, 125, 0.7)'],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right'
                        }
                    }
                }
            });
            return;
        }
        
        // Sort by count descending and take top 5
        const sortedRoutes = [...popularRoutes].sort((a, b) => b.count - a.count).slice(0, 5);
        
        const labels = sortedRoutes.map(route => `${route.departure} → ${route.destination}`);
        const data = sortedRoutes.map(route => route.count);
        
        // Create color array
        const backgroundColors = [
            'rgba(255, 99, 132, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(153, 102, 255, 0.7)'
        ];
        
        // Create new chart
        routesChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${value} đơn (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    function updateStatusChart() {
        const ctx = document.getElementById('status-chart').getContext('2d');
        
        // Destroy previous chart instance if it exists
        if (statusChart) {
            statusChart.destroy();
        }
        
        // Prepare data
        const bookingsByStatus = stats.current.bookingsByStatus || [];
        
        // Handle empty data
        if (bookingsByStatus.length === 0) {
            // Create an empty chart
            statusChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Không có dữ liệu'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['rgba(108, 117, 125, 0.7)'],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right'
                        }
                    }
                }
            });
            return;
        }
        
        const statusLabels = {
            'paid': 'Đã thanh toán',
            'unpaid': 'Chờ xác nhận',
            'cancelled': 'Đã hủy',
            'refunded': 'Hoàn tiền'
        };
        
        const statusColors = {
            'paid': 'rgba(40, 167, 69, 0.7)',
            'unpaid': 'rgba(255, 193, 7, 0.7)',
            'cancelled': 'rgba(220, 53, 69, 0.7)',
            'refunded': 'rgba(23, 162, 184, 0.7)'
        };
        
        const labels = bookingsByStatus.map(item => statusLabels[item.status] || item.status);
        const data = bookingsByStatus.map(item => item.count);
        const backgroundColor = bookingsByStatus.map(item => statusColors[item.status] || 'rgba(108, 117, 125, 0.7)');
        
        // Create new chart
        statusChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColor,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${value} đơn (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    function updateTopRoutesTable() {
        const tableBody = document.getElementById('top-routes-table');
        tableBody.innerHTML = '';
        
        const popularRoutes = stats.current.popularRoutes || [];
        
        if (popularRoutes.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="4" class="text-center">Không có dữ liệu</td>';
            tableBody.appendChild(tr);
            return;
        }
        
        // Sort by revenue descending
        const sortedRoutes = [...popularRoutes].sort((a, b) => b.revenue - a.revenue);
        
        sortedRoutes.forEach((route, index) => {
            const tr = document.createElement('tr');
            
            // Format the airport code to full name
            const departureAirport = getAirportName(route.departure);
            const destinationAirport = getAirportName(route.destination);
            
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${departureAirport} → ${destinationAirport}</td>
                <td>${formatNumber(route.count || 0)}</td>
                <td>${formatCurrency(route.revenue || 0)}</td>
            `;
            
            tableBody.appendChild(tr);
        });
    }
    
    // Export Functions
    function exportPdf() {
        showLoading(true);
        showAlert('Đang chuẩn bị xuất báo cáo PDF...', 'info');
        
        // Get date range for filename
        const fromDate = fromDateInput.value;
        const toDate = toDateInput.value;
        
        // Use exported data to generate a client-side PDF
        fetch(`http://localhost:3000/api/admin/statistics/export?format=pdf&fromDate=${fromDate}&toDate=${toDate}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Không thể xuất dữ liệu báo cáo');
            }
            return response.json();
        })
        .then(data => {
            // Create a formatted HTML report
            const htmlContent = generateHtmlReport(data, 'PDF');
            
            // Create a new window/tab with the report
            const reportWindow = window.open('', '_blank');
            reportWindow.document.write(htmlContent);
            reportWindow.document.close();
            
            // Add a print button that automatically triggers print dialog
            setTimeout(() => {
                reportWindow.print();
            }, 500);
            
            showAlert('Báo cáo PDF đã được tạo!', 'success');
            showLoading(false);
        })
        .catch(error => {
            console.error('Error exporting PDF:', error);
            showAlert('Có lỗi khi xuất báo cáo PDF. Vui lòng thử lại sau.', 'danger');
            showLoading(false);
        });
    }
    
    function exportExcel() {
        showLoading(true);
        showAlert('Đang chuẩn bị xuất báo cáo Excel...', 'info');
        
        // Get date range for filename
        const fromDate = fromDateInput.value;
        const toDate = toDateInput.value;
        
        // Get the export data
        fetch(`http://localhost:3000/api/admin/statistics/export?format=excel&fromDate=${fromDate}&toDate=${toDate}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Không thể xuất dữ liệu báo cáo');
            }
            return response.json();
        })
        .then(data => {
            try {
                // Create a CSV file from the JSON data
                const csvContent = convertToCSV(data);
                
                // Create a download link for the CSV
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', `bao-cao-thong-ke-${fromDate}-den-${toDate}.csv`);
                link.style.display = 'none';
                
                // Add to document, click and remove
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                showAlert('Báo cáo Excel (CSV) đã được tạo và tải xuống!', 'success');
            } catch (error) {
                console.error("Error creating CSV:", error);
                showAlert('Có lỗi khi tạo file CSV. Vui lòng thử lại sau.', 'danger');
            }
            showLoading(false);
        })
        .catch(error => {
            console.error('Error exporting Excel:', error);
            showAlert('Có lỗi khi xuất báo cáo Excel. Vui lòng thử lại sau.', 'danger');
            showLoading(false);
        });
    }
    
    // Helper function to generate HTML report
    function generateHtmlReport(data, format) {
        const title = data.reportTitle || 'Báo cáo thống kê';
        const generatedDate = data.generatedDate || new Date().toLocaleString('vi-VN');
        
        // Format the popular routes
        const routesRows = data.popularRoutes.map((route, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${getAirportName(route.departure)} → ${getAirportName(route.destination)}</td>
                <td>${formatNumber(route.count)}</td>
                <td>${formatCurrency(route.revenue)}</td>
            </tr>
        `).join('');
        
        // Format booking status data
        const statusLabels = {
            'paid': 'Đã thanh toán',
            'unpaid': 'Chờ xác nhận',
            'cancelled': 'Đã hủy',
            'refunded': 'Hoàn tiền'
        };
        
        const statusRows = data.bookingsByStatus.map(status => `
            <tr>
                <td>${statusLabels[status.status] || status.status}</td>
                <td>${formatNumber(status.count)}</td>
            </tr>
        `).join('');
        
        // Format daily revenue and bookings
        const dateRows = [];
        data.revenueByDate.forEach(revItem => {
            const bookingItem = data.bookingsByDate.find(b => b.date === revItem.date) || { count: 0 };
            dateRows.push(`
                <tr>
                    <td>${revItem.date}</td>
                    <td>${formatNumber(bookingItem.count)}</td>
                    <td>${formatCurrency(revItem.amount)}</td>
                </tr>
            `);
        });
        
        return `
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 20px;
                        line-height: 1.6;
                    }
                    .report-header {
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    .section {
                        margin-bottom: 30px;
                    }
                    h1 {
                        color: #0066cc;
                    }
                    h2 {
                        color: #0066cc;
                        border-bottom: 1px solid #ddd;
                        padding-bottom: 5px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    th, td {
                        padding: 10px;
                        border: 1px solid #ddd;
                        text-align: left;
                    }
                    th {
                        background-color: #f2f2f2;
                    }
                    .summary-box {
                        background-color: #f8f9fa;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                        padding: 15px;
                        margin-bottom: 20px;
                    }
                    .summary-item {
                        margin-bottom: 10px;
                    }
                    .summary-item strong {
                        display: inline-block;
                        min-width: 200px;
                    }
                    @media print {
                        .no-print {
                            display: none;
                        }
                        body {
                            margin: 0;
                            padding: 15px;
                        }
                        h2 {
                            page-break-after: avoid;
                        }
                        table {
                            page-break-inside: avoid;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="report-header">
                    <h1>${title}</h1>
                    <p>Ngày tạo: ${generatedDate}</p>
                </div>
                
                <div class="no-print" style="text-align: center; margin-bottom: 20px;">
                    <button onclick="window.print()" style="padding: 10px 20px; background-color: #0066cc; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        In báo cáo
                    </button>
                </div>
                
                <div class="section">
                    <h2>Tổng quan</h2>
                    <div class="summary-box">
                        <div class="summary-item">
                            <strong>Khoảng thời gian:</strong> ${data.period.fromDate} đến ${data.period.toDate}
                        </div>
                        <div class="summary-item">
                            <strong>Tổng đơn đặt vé:</strong> ${formatNumber(data.coreStats.totalBookings)}
                        </div>
                        <div class="summary-item">
                            <strong>Doanh thu:</strong> ${formatCurrency(data.coreStats.totalRevenue)}
                        </div>
                        <div class="summary-item">
                            <strong>Số hành khách:</strong> ${formatNumber(data.coreStats.totalPassengers)}
                        </div>
                    </div>
                </div>
                
                <div class="section">
                    <h2>Tuyến đường phổ biến</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Tuyến đường</th>
                                <th>Số lượng đặt vé</th>
                                <th>Doanh thu</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${routesRows || '<tr><td colspan="4" style="text-align: center;">Không có dữ liệu</td></tr>'}
                        </tbody>
                    </table>
                </div>
                
                <div class="section">
                    <h2>Trạng thái đơn đặt vé</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Trạng thái</th>
                                <th>Số lượng</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${statusRows || '<tr><td colspan="2" style="text-align: center;">Không có dữ liệu</td></tr>'}
                        </tbody>
                    </table>
                </div>
                
                <div class="section">
                    <h2>Dữ liệu theo ngày</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Ngày</th>
                                <th>Số đơn đặt vé</th>
                                <th>Doanh thu</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${dateRows.join('') || '<tr><td colspan="3" style="text-align: center;">Không có dữ liệu</td></tr>'}
                        </tbody>
                    </table>
                </div>
                
                <footer style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
                    © ${new Date().getFullYear()} FlyViet Admin - Báo cáo thống kê
                </footer>
            </body>
            </html>
        `;
    }
    
    // Helper function to convert data to CSV format
    function convertToCSV(data) {
        let csv = [];
        
        // Add report title and metadata
        csv.push('"' + data.reportTitle + '"');
        csv.push('"Ngày tạo: ' + data.generatedDate + '"');
        csv.push('"Từ ngày: ' + data.period.fromDate + ' đến ngày: ' + data.period.toDate + '"');
        csv.push(''); // Empty line
        
        // Add core stats
        csv.push('"THỐNG KÊ TỔNG QUAN"');
        csv.push('"Chỉ số","Giá trị"');
        csv.push('"Tổng đơn đặt vé",' + data.coreStats.totalBookings);
        csv.push('"Doanh thu",' + data.coreStats.totalRevenue);
        csv.push('"Số hành khách",' + data.coreStats.totalPassengers);
        csv.push(''); // Empty line
        
        // Add popular routes
        csv.push('"TUYẾN ĐƯỜNG PHỔ BIẾN"');
        csv.push('"STT","Tuyến đường","Số lượng đặt vé","Doanh thu"');
        
        data.popularRoutes.forEach((route, index) => {
            const routeName = getAirportName(route.departure) + ' → ' + getAirportName(route.destination);
            csv.push(`"${index + 1}","${routeName}","${route.count}","${route.revenue}"`);
        });
        
        csv.push(''); // Empty line
        
        // Add booking status
        const statusLabels = {
            'paid': 'Đã thanh toán',
            'unpaid': 'Chờ xác nhận',
            'cancelled': 'Đã hủy',
            'refunded': 'Hoàn tiền'
        };
        
        csv.push('"TRẠNG THÁI ĐƠN ĐẶT VÉ"');
        csv.push('"Trạng thái","Số lượng"');
        
        data.bookingsByStatus.forEach(status => {
            const statusName = statusLabels[status.status] || status.status;
            csv.push(`"${statusName}","${status.count}"`);
        });
        
        csv.push(''); // Empty line
        
        // Add daily data
        csv.push('"DỮ LIỆU THEO NGÀY"');
        csv.push('"Ngày","Số đơn đặt vé","Doanh thu"');
        
        // Combine revenue and bookings by date
        const dateMap = new Map();
        
        data.revenueByDate.forEach(item => {
            dateMap.set(item.date, { date: item.date, revenue: item.amount, bookings: 0 });
        });
        
        data.bookingsByDate.forEach(item => {
            if (dateMap.has(item.date)) {
                dateMap.get(item.date).bookings = item.count;
            } else {
                dateMap.set(item.date, { date: item.date, revenue: 0, bookings: item.count });
            }
        });
        
        // Sort by date and add to CSV
        Array.from(dateMap.values())
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .forEach(item => {
                csv.push(`"${item.date}","${item.bookings}","${item.revenue}"`);
            });
        
        return csv.join('\n');
    }
    
    // Helper Functions
    function calculatePercentageChange(current, previous) {
        if (previous === 0) {
            return current > 0 ? 100 : 0;
        }
        return ((current - previous) / previous) * 100;
    }
    
    function formatNumber(value) {
        if (value === undefined || value === null) return '0';
        return new Intl.NumberFormat('vi-VN').format(value);
    }
    
    function formatCurrency(amount) {
        if (amount === undefined || amount === null) return '0 ₫';
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0
        }).format(amount);
    }
    
    function formatCurrencyCompact(amount) {
        if (amount === undefined || amount === null) return '0';
        
        if (amount >= 1000000000) {
            return (amount / 1000000000).toFixed(1) + ' tỷ ₫';
        } else if (amount >= 1000000) {
            return (amount / 1000000).toFixed(1) + ' tr ₫';
        } else if (amount >= 1000) {
            return (amount / 1000).toFixed(1) + ' k ₫';
        } else {
            return amount + ' ₫';
        }
    }
    
    function formatPercentage(value) {
        if (value === undefined || value === null) return '0%';
        return value.toFixed(1) + '%';
    }
    
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
    
    function showLoading(show) {
        loadingSpinner.style.display = show ? 'flex' : 'none';
    }
    
    function showAlert(message, type = 'info') {
        // Remove any existing alerts
        const existingAlerts = document.querySelectorAll('.alert');
        existingAlerts.forEach(alert => alert.remove());
        
        // Create new alert
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.setAttribute('role', 'alert');
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Insert at the top of main content
        const mainContent = document.querySelector('.main-content');
        mainContent.insertBefore(alertDiv, mainContent.firstChild);
        
        // Auto dismiss after 5 seconds
        setTimeout(() => {
            const bsAlert = new bootstrap.Alert(alertDiv);
            bsAlert.close();
        }, 5000);
    }
}); 