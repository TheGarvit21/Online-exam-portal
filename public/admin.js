const ADMIN_EMAIL = 'admin123@gmail.com';
const ADMIN_PASSWORD = 'admin';
const backendURL = 'http://localhost:5000';

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
    setupFormValidation();
});

// Show admin login modal if not authenticated
function checkAdminAuth() {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
        const adminLoginModal = new bootstrap.Modal(document.getElementById('adminLoginModal'));
        adminLoginModal.show();
    } else {
        document.getElementById('adminContent').style.display = 'block';
        loadDashboardData();
    }
}

// Setup form validation
function setupFormValidation() {
    const form = document.getElementById('questionForm');
    const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
    
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            validateForm();
        });
    });
}

// Validate form
function validateForm() {
    const form = document.getElementById('questionForm');
    const submitBtn = form.querySelector('button[type="submit"]');
    const isValid = form.checkValidity();
    submitBtn.disabled = !isValid;
}

// Handle admin login
document.getElementById('adminLoginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        localStorage.setItem('adminToken', 'admin_authenticated');
        document.getElementById('adminContent').style.display = 'block';
        bootstrap.Modal.getInstance(document.getElementById('adminLoginModal')).hide();
        loadDashboardData();
        showToast('Login successful!', 'success');
    } else {
        showToast('Invalid admin credentials', 'error');
    }
});

// Load dashboard data
async function loadDashboardData() {
    try {
        const [questionsCount, usersCount, examsCount] = await Promise.all([
            fetch(backendURL + '/admin/stats/questions', {
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') }
            }).then(res => res.json()),
            fetch(backendURL + '/admin/stats/users', {
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') }
            }).then(res => res.json()),
            fetch(backendURL + '/admin/stats/exams', {
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') }
            }).then(res => res.json())
        ]);

        document.getElementById('totalQuestions').textContent = questionsCount.count;
        document.getElementById('totalUsers').textContent = usersCount.count;
        document.getElementById('totalExams').textContent = examsCount.count;

        // Load exam settings
        await loadExamSettings();
        
        // Load questions list
        await loadQuestions();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showToast('Failed to load dashboard data', 'error');
    }
}

// Handle question form submission
document.getElementById('questionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Adding...';
    
    const question = document.getElementById('question').value;
    const options = [
        document.getElementById('option1').value,
        document.getElementById('option2').value,
        document.getElementById('option3').value,
        document.getElementById('option4').value
    ];
    const correctAnswerIndex = document.getElementById('correct-answer').value;
    const correctAnswer = options[correctAnswerIndex - 1];

    try {
        const response = await fetch(backendURL + '/add-question', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            },
            body: JSON.stringify({ question, options, correctAnswer })
        });

        if (response.ok) {
            e.target.reset();
            loadQuestions();
            // Show success modal
            const successModal = new bootstrap.Modal(document.getElementById('successModal'));
            successModal.show();
            showToast('Question added successfully!', 'success');
        } else {
            throw new Error('Failed to add question');
        }
    } catch (error) {
        showToast('Failed to add question', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Add Question';
    }
});

// Load existing questions
async function loadQuestions() {
    try {
        const response = await fetch(backendURL + '/admin/questions', {
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') }
        });
        const questions = await response.json();
        
        const questionsListElement = document.getElementById('questionsList');
        questionsListElement.innerHTML = questions.map((q, index) => `
            <div class="question-item" id="question-${q._id}">
                <div class="d-flex justify-content-between align-items-start">
                    <h5 class="mb-3">Question ${index + 1}</h5>
                    <button onclick="deleteQuestion('${q._id}')" class="btn btn-danger btn-sm">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <p class="mb-3">${q.question}</p>
                <div class="options-list">
                    ${q.options.map((opt, i) => `
                        <div class="option ${opt === q.correctAnswer ? 'correct' : ''} mb-2">
                            ${String.fromCharCode(65 + i)}. ${opt}
                            ${opt === q.correctAnswer ? ' <span class="badge bg-success ms-2">Correct</span>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        // Update total questions count
        document.getElementById('totalQuestions').textContent = questions.length;
    } catch (error) {
        console.error('Error loading questions:', error);
        showToast('Failed to load questions', 'error');
    }
}

// Delete question
async function deleteQuestion(questionId) {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
        const response = await fetch(backendURL + '/admin/questions/' + questionId, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') }
        });

        if (response.ok) {
            document.getElementById('question-' + questionId).remove();
            showToast('Question deleted successfully', 'success');
            loadDashboardData(); // Refresh stats
        } else {
            throw new Error('Failed to delete question');
        }
    } catch (error) {
        console.error('Error deleting question:', error);
        showToast('Failed to delete question', 'error');
    }
}

// Admin logout
function adminLogout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('adminToken');
        window.location.reload();
    }
}

// Show toast notification
function showToast(message, type = 'success') {
    const toastContainer = document.createElement('div');
    toastContainer.style.position = 'fixed';
    toastContainer.style.top = '20px';
    toastContainer.style.right = '20px';
    toastContainer.style.zIndex = '9999';
    
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type === 'success' ? 'success' : 'danger'} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    document.body.appendChild(toastContainer);
    
    const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
    bsToast.show();
    
    toast.addEventListener('hidden.bs.toast', () => {
        toastContainer.remove();
    });
}

async function loadUserQuestions() {
    try {
        const response = await fetch('http://localhost:5000/get-questions', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const questions = await response.json();
        // Display questions for the user
    } catch (error) {
        console.error('Error loading user questions:', error);
    }
}

// Handle bulk question upload
document.getElementById('uploadForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fileInput = document.getElementById('bulkQuestions');
    const file = fileInput.files[0];
    
    if (!file) {
        showToast('Please select a file', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('questions', file);

    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Uploading...';

        const response = await fetch(backendURL + '/upload-questions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            showToast(`Successfully uploaded ${data.count} questions!`, 'success');
            loadDashboardData(); // Refresh the dashboard
            fileInput.value = ''; // Clear the file input
        } else {
            throw new Error(data.message || 'Failed to upload questions');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showToast(error.message || 'Failed to upload questions', 'error');
    } finally {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Questions';
    }
});

// Handle exam settings update
document.getElementById('examSettingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const duration = parseInt(document.getElementById('examDuration').value);
    const passingPercentage = parseInt(document.getElementById('passingPercentage').value);
    
    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

        const response = await fetch(backendURL + '/update-exam-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            },
            body: JSON.stringify({ duration, passingPercentage })
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Exam settings updated successfully!', 'success');
        } else {
            throw new Error(data.message || 'Failed to update exam settings');
        }
    } catch (error) {
        console.error('Settings update error:', error);
        showToast(error.message || 'Failed to update exam settings', 'error');
    } finally {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Settings';
    }
});

// Delete all questions
async function deleteAllQuestions() {
    if (!confirm('Are you sure you want to delete ALL questions? This action cannot be undone!')) {
        return;
    }

    try {
        const response = await fetch(backendURL + '/admin/questions', {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') }
        });

        const data = await response.json();

        if (response.ok) {
            showToast(`Successfully deleted ${data.deletedCount} questions!`, 'success');
            loadDashboardData(); // Refresh the dashboard
        } else {
            throw new Error(data.message || 'Failed to delete questions');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showToast(error.message || 'Failed to delete questions', 'error');
    }
}

// Load exam settings
async function loadExamSettings() {
    try {
        const response = await fetch(backendURL + '/exam-settings', {
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') }
        });
        
        if (response.ok) {
            const settings = await response.json();
            document.getElementById('examDuration').value = Math.floor(settings.duration / 60); // Convert seconds to minutes
            document.getElementById('passingPercentage').value = settings.passingPercentage;
        }
    } catch (error) {
        console.error('Error loading exam settings:', error);
        showToast('Failed to load exam settings', 'error');
    }
}

// Refresh questions list
async function refreshQuestions() {
    try {
        await loadQuestions();
        showToast('Questions list refreshed', 'success');
    } catch (error) {
        showToast('Failed to refresh questions', 'error');
    }
}

// Preview shuffled questions
function previewShuffledQuestions() {
    fetch(backendURL + '/get-questions', {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') }
    })
    .then(response => response.json())
    .then(questions => {
        // Shuffle questions
        const shuffled = questions.sort(() => Math.random() - 0.5);
        
        // Display in preview
        document.getElementById('questionPreview').innerHTML = shuffled.map((q, index) => `
            <div class="question-preview-item">
                <h4>Question ${index + 1}</h4>
                <p>${q.question}</p>
                <div class="options">
                    ${q.options.map((opt, i) => `
                        <div class="option">
                            <span>${String.fromCharCode(65 + i)}.</span> ${opt}
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    })
    .catch(error => {
        console.error('Error loading question preview:', error);
        showAlert('Error loading question preview', 'error');
    });
}

// Utility Functions
function showAlert(message, type = 'error') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.querySelector('.admin-container').insertAdjacentElement('afterbegin', alertDiv);
    
    setTimeout(() => alertDiv.remove(), 5000);
}

// Function to handle bulk JSON question upload
async function handleBulkJSONUpload(event) {
    const fileInput = document.getElementById('bulkQuestions');
    const file = fileInput.files[0];
    
    if (!file) {
        showAlert('Please select a file first', 'error');
        return;
    }

    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const questions = JSON.parse(e.target.result);
                
                // Validate questions format
                if (!Array.isArray(questions)) {
                    showAlert('Invalid format. Please upload a JSON array of questions', 'error');
                    return;
                }

                // Validate each question
                const validQuestions = questions.filter(q => 
                    q.question && 
                    Array.isArray(q.options) && 
                    q.options.length === 4 && 
                    q.correctAnswer &&
                    q.options.includes(q.correctAnswer)
                );

                if (validQuestions.length === 0) {
                    showAlert('No valid questions found in the file', 'error');
                    return;
                }

                // Upload questions
                const response = await fetch('/add-bulk-questions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${getAdminToken()}`
                    },
                    body: JSON.stringify({ questions: validQuestions })
                });

                const data = await response.json();
                
                if (response.ok) {
                    showAlert(`Successfully added ${data.count} questions`, 'success');
                    refreshQuestions();
                    updateStats();
                } else {
                    showAlert(data.message || 'Failed to add questions', 'error');
                }
            } catch (err) {
                showAlert('Invalid JSON format', 'error');
            }
        };
        reader.readAsText(file);
    } catch (error) {
        showAlert('Error processing file', 'error');
    }
}

// Download questions
function downloadQuestions() {
    fetch(backendURL + '/admin/questions', {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') }
    })
    .then(response => response.json())
    .then(questions => {
        const blob = new Blob([JSON.stringify(questions, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'questions.json';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast('Questions downloaded successfully', 'success');
    })
    .catch(error => {
        console.error('Error downloading questions:', error);
        showToast('Failed to download questions', 'error');
    });
} 