const backendURL = "http://localhost:5000";

// Utility Functions
const showAlert = (message, type = 'error') => {
    const container = document.getElementById('signupAlertContainer');
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
    const button = document.getElementById('signupButton');
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
    if (!emailRegex.test(email)) {
        return 'Please enter a valid email address';
    }
    return null;
};

const validateUsername = (username) => {
    if (username.length < 3) {
        return 'Username must be at least 3 characters long';
    }
    if (username.length > 50) {
        return 'Username must be less than 50 characters';
    }
    if (!/^[a-zA-Z0-9\s]+$/.test(username)) {
        return 'Username can only contain letters, numbers, and spaces';
    }
    return null;
};

const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
        return 'Password must be at least 8 characters long';
    }
    if (!hasUpperCase || !hasLowerCase) {
        return 'Password must contain both uppercase and lowercase letters';
    }
    if (!hasNumbers) {
        return 'Password must contain at least one number';
    }
    if (!hasSpecialChar) {
        return 'Password must contain at least one special character';
    }
    return null;
};

// Form input event listeners for real-time validation
const setupFormValidation = () => {
    const usernameInput = document.getElementById('signup-username');
    const emailInput = document.getElementById('signup-email');
    const passwordInput = document.getElementById('signup-password');
    const submitButton = document.getElementById('signupButton');

    const validateForm = () => {
        const isUsernameValid = !validateUsername(usernameInput.value);
        const isEmailValid = !validateEmail(emailInput.value);
        const isPasswordValid = !validatePassword(passwordInput.value);
        
        submitButton.disabled = !(isUsernameValid && isEmailValid && isPasswordValid);
    };

    usernameInput.addEventListener('input', () => {
        const error = validateUsername(usernameInput.value);
        if (error) {
            usernameInput.classList.add('error');
            usernameInput.title = error;
        } else {
            usernameInput.classList.remove('error');
            usernameInput.title = '';
        }
        validateForm();
    });

    emailInput.addEventListener('input', () => {
        const error = validateEmail(emailInput.value);
        if (error) {
            emailInput.classList.add('error');
            emailInput.title = error;
        } else {
            emailInput.classList.remove('error');
            emailInput.title = '';
        }
        validateForm();
    });

    passwordInput.addEventListener('input', () => {
        const error = validatePassword(passwordInput.value);
        if (error) {
            passwordInput.classList.add('error');
            passwordInput.title = error;
        } else {
            passwordInput.classList.remove('error');
            passwordInput.title = '';
        }
        validateForm();
    });
};

// Handle Registration
const handleRegistration = async (event) => {
    event.preventDefault();
    setLoading(true);

    const username = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;

    // Validate all fields
    const usernameError = validateUsername(username);
    if (usernameError) {
        showAlert(usernameError);
        setLoading(false);
        return;
    }

    const emailError = validateEmail(email);
    if (emailError) {
        showAlert(emailError);
        setLoading(false);
        return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
        showAlert(passwordError);
        setLoading(false);
        return;
    }

    try {
        const response = await fetch(`${backendURL}/register`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }

        // Show success message
        showAlert('Account created successfully! Redirecting to login...', 'success');
        
        // Clear form
        document.getElementById('signup-username').value = '';
        document.getElementById('signup-email').value = '';
        document.getElementById('signup-password').value = '';
        
        // Redirect to login page after a short delay
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
    } catch (error) {
        showAlert(error.message);
    } finally {
        setLoading(false);
    }
};

// Check if user is already logged in
const checkAuth = () => {
    const token = localStorage.getItem('token');
    if (token) {
        window.location.href = 'dashboard.html';
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupFormValidation();
    // Add form submit event listener
    document.querySelector('form').addEventListener('submit', handleRegistration);
}); 