const backendURL = "http://localhost:5000"; // Change after deployment

// Utility Functions
const setLoading = (buttonId, isLoading) => {
    const button = document.getElementById(buttonId);
    if (button) {
        if (isLoading) {
            button.classList.add('btn-loading');
            button.disabled = true;
        } else {
            button.classList.remove('btn-loading');
            button.disabled = false;
        }
    }
};

const showAlert = (containerId, message, type = 'error') => {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="alert alert-${type}">
                ${message}
            </div>
        `;

        setTimeout(() => {
            if (container) {
                container.innerHTML = '';
            }
        }, 5000);
    }
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

// Form Toggle Function
const toggleForms = () => {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    
    loginForm.classList.toggle('hidden');
    signupForm.classList.toggle('hidden');
    
    // Clear any existing alerts
    document.getElementById('alertContainer').innerHTML = '';
    document.getElementById('signupAlertContainer').innerHTML = '';
};

// Handle Login
const handleLogin = async (event) => {
    event.preventDefault();
    setLoading('loginButton', true);

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${backendURL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }

        // Store user data securely
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({
            id: data.user.id,
            email: data.user.email,
            name: data.user.name
        }));

        showAlert('alertContainer', 'Login successful! Redirecting...', 'success');
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);

    } catch (error) {
        showAlert('alertContainer', error.message);
    } finally {
        setLoading('loginButton', false);
    }
};

// Handle Signup
const handleSignup = async (event) => {
    event.preventDefault();
    setLoading('signupButton', true);

    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    const passwordError = validatePassword(password);
    if (passwordError) {
        showAlert('signupAlertContainer', passwordError);
        setLoading('signupButton', false);
        return;
    }

    try {
        const response = await fetch(`${backendURL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }

        showAlert('signupAlertContainer', 'Account created successfully! Redirecting to login...', 'success');
        
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
    } catch (error) {
        showAlert('signupAlertContainer', error.message);
    } finally {
        setLoading('signupButton', false);
    }
};

// Check Authentication Status
const checkAuth = () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    const currentPath = window.location.pathname;
    const isLoginPage = currentPath.includes('login.html');
    const isRegisterPage = currentPath === '/index.html' || currentPath === '/';

    // If user is logged in and tries to access login or register page
    if (token && user && (isLoginPage || isRegisterPage)) {
        window.location.href = 'dashboard.html';
        return;
    }

    // If user is not logged in and tries to access protected pages
    if ((!token || !user) && !isLoginPage && !isRegisterPage) {
        window.location.href = 'login.html';
        return;
    }
};

// Logout Function
const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('examResult');
    window.location.href = 'login.html';
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    // Add event listeners for forms if they exist
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
});

// 📌 Fetch and Display Questions
async function fetchQuestions() {
    const res = await fetch(`${backendURL}/get-questions`);
    const questions = await res.json();
    const container = document.getElementById("questions-container");

    questions.forEach(q => {
        const div = document.createElement("div");
        div.className = "card";
        div.innerHTML = `<p><strong>${q.question}</strong></p>`;
        container.appendChild(div);
    });
}

// 📌 Add Question (Admin)
async function addQuestion() {
    const question = document.getElementById("question").value;
    const options = [
        document.getElementById("option1").value,
        document.getElementById("option2").value,
        document.getElementById("option3").value,
        document.getElementById("option4").value
    ];
    const correctAnswer = document.getElementById("correct-answer").value;

    const res = await fetch(`${backendURL}/add-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, options, correctAnswer })
    });

    const data = await res.json();
    alert(data.message);
}

document.addEventListener("DOMContentLoaded", async () => {
    const questionContainer = document.getElementById("question-container");

    try {
        const response = await fetch("http://localhost:5000/get-questions"); // Backend API call
        const questions = await response.json();

        if (questions.length === 0) {
            questionContainer.innerHTML = "<p>No questions available!</p>";
            return;
        }

        // 📝 Display Questions on Page
        questions.forEach((q, index) => {
            const questionDiv = document.createElement("div");
            questionDiv.classList.add("question-box"); // CSS Styling ke liye
            questionDiv.innerHTML = `
                <h3>${index + 1}. ${q.question}</h3>
                <ul>
                    ${q.options.map(option => `<li><input type="radio" name="q${index}" value="${option}"> ${option}</li>`).join("")}
                </ul>
            `;
            questionContainer.appendChild(questionDiv);
        });
    } catch (error) {
        console.error("Error fetching questions:", error);
        questionContainer.innerHTML = "<p>Error loading questions!</p>";
    }
});

