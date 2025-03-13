const backendURL = "http://localhost:5000";

// Utility Functions
const showAlert = (message, type = 'error') => {
    const container = document.getElementById('alertContainer');
    container.innerHTML = `
        <div class="alert alert-${type}">
            ${message}
        </div>
    `;

    // Auto-hide alert after 5 seconds
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
};

const setLoading = (isLoading) => {
    const button = document.getElementById('loginButton');
    if (isLoading) {
        button.classList.add('btn-loading');
        button.disabled = true;
    } else {
        button.classList.remove('btn-loading');
        button.disabled = false;
    }
};

const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Setup form validation
const setupFormValidation = () => {
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const submitButton = document.getElementById('loginButton');

    const validateForm = () => {
        const isEmailValid = validateEmail(emailInput.value);
        const isPasswordValid = passwordInput.value.length >= 8;
        submitButton.disabled = !(isEmailValid && isPasswordValid);
    };

    emailInput.addEventListener('input', () => {
        if (!validateEmail(emailInput.value)) {
            emailInput.classList.add('error');
            emailInput.title = 'Please enter a valid email address';
        } else {
            emailInput.classList.remove('error');
            emailInput.title = '';
        }
        validateForm();
    });

    passwordInput.addEventListener('input', () => {
        if (passwordInput.value.length < 8) {
            passwordInput.classList.add('error');
            passwordInput.title = 'Password must be at least 8 characters';
        } else {
            passwordInput.classList.remove('error');
            passwordInput.title = '';
        }
        validateForm();
    });
};

// Handle Login
const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    // Basic validation
    if (!validateEmail(email)) {
        showAlert('Please enter a valid email address');
        setLoading(false);
        return;
    }

    if (password.length < 8) {
        showAlert('Password must be at least 8 characters');
        setLoading(false);
        return;
    }

    try {
        const response = await fetch(`${backendURL}/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }

        if (data.token) {
            // Store user data securely
            localStorage.setItem('token', data.token);
            if (data.user) {
                localStorage.setItem('user', JSON.stringify({
                    id: data.user.id,
                    email: data.user.email,
                    name: data.user.name,
                    role: data.user.role
                }));
            }

            // Show success message before redirect
            showAlert('Login successful! Redirecting...', 'success');
            
            // Clear form
            document.getElementById('login-email').value = '';
            document.getElementById('login-password').value = '';
            
            // Use replace instead of href to prevent back button issues
            setTimeout(() => {
                window.location.replace('dashboard.html');
            }, 1000);
        } else {
            throw new Error('Invalid credentials');
        }
    } catch (error) {
        showAlert(error.message);
    } finally {
        setLoading(false);
    }
};

// Handle "Enter" key press
const handleEnterKey = (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        document.getElementById('loginButton').click();
    }
};

// Check if user is already logged in
const checkAuth = () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        try {
            const userData = JSON.parse(user);
            if (userData.email && userData.id) {
                // Only redirect if we're on the login page
                if (window.location.pathname.endsWith('login.html')) {
                    window.location.replace('dashboard.html');
                }
                return true;
            }
        } catch (error) {
            console.error('Invalid user data:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    }
    return false;
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Clear any existing redirect flag
    sessionStorage.removeItem('redirecting');
    
    // Only check auth if we're on the login page
    if (window.location.pathname.endsWith('login.html')) {
        checkAuth();
    }
    
    setupFormValidation();
    
    // Add form submit event listener
    document.querySelector('form').addEventListener('submit', handleLogin);
    
    // Add enter key listener to password field
    document.getElementById('login-password').addEventListener('keypress', handleEnterKey);
}); 