document.addEventListener('DOMContentLoaded', async () => {
    const profileInfoDiv = document.getElementById('profile-info');
    const profileErrorDiv = document.getElementById('profile-error');
    const logoutButton = document.getElementById('logout-button');

    const displayError = (message) => {
        profileErrorDiv.textContent = message;
        profileErrorDiv.style.display = 'block';
        profileInfoDiv.style.display = 'none';
    };

    const displayProfile = (user) => {
        document.getElementById('fullname').textContent = user.fullname;
        document.getElementById('email').textContent = user.email;
        document.getElementById('phone').textContent = user.phone || 'N/A';
        document.getElementById('created-at').textContent = new Date(user.created_at).toLocaleString();
        document.getElementById('last-login').textContent = user.last_login ? new Date(user.last_login).toLocaleString() : 'Chưa đăng nhập lần nào';
        profileInfoDiv.style.display = 'block';
        profileErrorDiv.style.display = 'none';
    };

    const fetchProfile = async () => {
        let sessionId = localStorage.getItem('sessionId');
        if (!sessionId) {
            sessionId = sessionStorage.getItem('sessionId');
        }

        if (!sessionId) {
            displayError('Bạn chưa đăng nhập. Vui lòng đăng nhập để xem thông tin cá nhân.');
            // Redirect to login page
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/users/profile', {
                method: 'GET',
                headers: {
                    'Authorization': sessionId,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok) {
                displayProfile(data.user);
            } else {
                displayError(data.error || 'Không thể tải thông tin cá nhân.');
                // If session is invalid/expired, clear it and redirect
                if (response.status === 401) {
                    localStorage.removeItem('sessionId');
                    localStorage.removeItem('user');
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            displayError('Đã xảy ra lỗi khi kết nối đến máy chủ.');
        }
    };

    logoutButton.addEventListener('click', async () => {
        let sessionId = localStorage.getItem('sessionId');
        if (!sessionId) {
            sessionId = sessionStorage.getItem('sessionId');
        }

        if (!sessionId) {
            displayError('Bạn chưa đăng nhập.');
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/users/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sessionId })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.removeItem('sessionId');
                localStorage.removeItem('user');
                alert('Đăng xuất thành công!');
                window.location.href = '../../index.html'; // Redirect to homepage
            } else {
                displayError(data.error || 'Đăng xuất thất bại.');
            }
        } catch (error) {
            console.error('Error logging out:', error);
            displayError('Đã xảy ra lỗi khi kết nối đến máy chủ.');
        }
    });

    fetchProfile();
});
