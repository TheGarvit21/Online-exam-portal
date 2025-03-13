class ExamManager {
    constructor() {
        // First check if we're actually on the dashboard page
        if (!window.location.pathname.endsWith('dashboard.html')) {
            return;
        }

        // Check authentication before doing anything else
        if (!this.checkAuthentication()) {
            return;
        }

        // Initialize basic properties
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.timeLeft = 0; // Initialize to 0, will be set by loadExamSettings
        this.answers = new Map();
        this.markedQuestions = new Set();
        this.startTime = new Date();

        // Try to initialize elements
        try {
            this.initializeElements();
            this.attachEventListeners();
            this.createAlertContainer();
            
            // Load questions and exam settings
            Promise.all([this.loadQuestions(), this.loadExamSettings()]).then(() => {
                // Show instructions modal if needed
                if (!localStorage.getItem('examStarted') && !localStorage.getItem('examSubmitted')) {
                    this.showInstructionsModal();
                } else if (localStorage.getItem('examSubmitted')) {
                    localStorage.removeItem('examSubmitted');
                    localStorage.removeItem('examStarted');
                    this.showInstructionsModal();
                } else if (localStorage.getItem('examStarted')) {
                    // If exam was already started, restore the time left
                    const startTime = parseInt(localStorage.getItem('examStartTime') || '0');
                    const currentTime = new Date().getTime();
                    const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
                    this.timeLeft = Math.max(0, this.timeLeft - elapsedSeconds);
                    this.startTimer();
                }
            });
        } catch (error) {
            console.error('Error initializing elements:', error);
            return;
        }
    }

    checkAuthentication() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        
        if (!token || !user) {
            console.log('No token or user found');
            localStorage.clear(); // Clear all localStorage
            window.location.replace('login.html');
            return false;
        }

        try {
            const userData = JSON.parse(user);
            if (!userData.email || !userData.id) {
                throw new Error('Invalid user data');
            }
            return true;
        } catch (error) {
            console.error('Authentication error:', error);
            localStorage.clear(); // Clear all localStorage
            window.location.replace('login.html');
            return false;
        }
    }

    initializeElements() {
        // Check if required elements exist first
        const requiredElements = [
            '.question-content',
            '.options-container',
            '#current-question',
            '#question-grid',
            '#answered-count',
            '#marked-count',
            '#not-visited-count',
            '#time',
            '#prev-question',
            '#next-question',
            '#submit-exam',
            '#instructionsModal',
            '#startExamBtn',
            '#userName'
        ];

        for (const selector of requiredElements) {
            if (!document.querySelector(selector)) {
                throw new Error(`Required element ${selector} not found`);
            }
        }

        // If all elements exist, initialize them
        this.questionContainer = document.querySelector('.question-content');
        this.optionsContainer = document.querySelector('.options-container');
        this.currentQuestionSpan = document.getElementById('current-question');
        this.questionGrid = document.getElementById('question-grid');
        this.answeredCount = document.getElementById('answered-count');
        this.markedCount = document.getElementById('marked-count');
        this.notVisitedCount = document.getElementById('not-visited-count');
        this.timerDisplay = document.getElementById('time');
        this.prevButton = document.getElementById('prev-question');
        this.nextButton = document.getElementById('next-question');
        this.submitButton = document.getElementById('submit-exam');

        // Display user email
        try {
            const userData = JSON.parse(localStorage.getItem('user'));
            if (userData && userData.email) {
                document.getElementById('userName').textContent = userData.email;
            }
        } catch (error) {
            console.error('Error displaying user email:', error);
        }
    }

    attachEventListeners() {
        this.prevButton.addEventListener('click', () => this.navigateQuestion(-1));
        this.nextButton.addEventListener('click', () => this.navigateQuestion(1));
        this.submitButton.addEventListener('click', () => this.submitExam());
    }

    async loadQuestions() {
        try {
            const response = await fetch("http://localhost:5000/get-questions", {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (!response.ok) {
                throw new Error('Failed to fetch questions');
            }
            
            this.questions = await response.json();
            
            if (this.questions.length === 0) {
                this.questionContainer.innerHTML = '<div class="alert alert-warning">No questions available. Please try again later.</div>';
                return;
            }

            this.notVisitedCount.textContent = this.questions.length;
            this.createQuestionGrid();
            this.displayCurrentQuestion();
            
            // Log for debugging
            console.log('Loaded questions:', this.questions);
        } catch (error) {
            console.error("Error fetching questions:", error);
            this.questionContainer.innerHTML = '<div class="alert alert-danger">Error loading questions. Please refresh the page.</div>';
        }
    }

    createQuestionGrid() {
        this.questionGrid.innerHTML = '';
        this.questions.forEach((_, index) => {
            const button = document.createElement('button');
            button.className = 'grid-button';
            button.textContent = index + 1;
            button.addEventListener('click', () => this.jumpToQuestion(index));
            this.questionGrid.appendChild(button);
        });
        this.updateQuestionGrid();
    }

    displayCurrentQuestion() {
        if (!this.questions || this.questions.length === 0) {
            return;
        }

        const question = this.questions[this.currentQuestionIndex];
        if (!question) {
            return;
        }

        this.currentQuestionSpan.textContent = this.currentQuestionIndex + 1;
        
        this.questionContainer.innerHTML = `
            <p class="mb-4">${question.question}</p>
        `;

        this.optionsContainer.innerHTML = question.options.map((option, index) => `
            <div class="option-item ${this.answers.get(this.currentQuestionIndex) === option ? 'selected' : ''}" 
                 data-option="${option}">
                <input type="radio" 
                       id="option${index}" 
                       name="question" 
                       value="${option}" 
                       ${this.answers.get(this.currentQuestionIndex) === option ? 'checked' : ''}>
                <label class="ms-2 flex-grow-1" for="option${index}">
                    ${String.fromCharCode(65 + index)}. ${option}
                </label>
            </div>
        `).join('');

        // Add click handlers to options
        document.querySelectorAll('.option-item').forEach(item => {
            item.addEventListener('click', () => {
                const selectedOption = item.dataset.option;
                this.selectOption(selectedOption);
                
                // Move to next question automatically after selection
                if (this.currentQuestionIndex < this.questions.length - 1) {
                    setTimeout(() => this.navigateQuestion(1), 500);
                }
            });
        });

        this.updateNavigationButtons();
        this.updateQuestionGrid();
    }

    selectOption(option) {
        this.answers.set(this.currentQuestionIndex, option);
        this.updateCounts();
        this.displayCurrentQuestion();
    }

    navigateQuestion(delta) {
        const newIndex = this.currentQuestionIndex + delta;
        if (newIndex >= 0 && newIndex < this.questions.length) {
            this.currentQuestionIndex = newIndex;
            this.displayCurrentQuestion();
        }
    }

    jumpToQuestion(index) {
        this.currentQuestionIndex = index;
        this.displayCurrentQuestion();
    }

    updateNavigationButtons() {
        this.prevButton.disabled = this.currentQuestionIndex === 0;
        this.nextButton.disabled = this.currentQuestionIndex === this.questions.length - 1;
    }

    updateQuestionGrid() {
        const buttons = this.questionGrid.children;
        Array.from(buttons).forEach((button, index) => {
            button.className = 'grid-button';
            if (this.answers.has(index)) {
                button.classList.add('answered');
            }
            if (this.markedQuestions.has(index)) {
                button.classList.add('marked');
            }
            if (index === this.currentQuestionIndex) {
                button.classList.add('current');
            }
        });
    }

    updateCounts() {
        this.answeredCount.textContent = this.answers.size;
        this.markedCount.textContent = this.markedQuestions.size;
        this.notVisitedCount.textContent = this.questions.length - this.answers.size;
    }

    startTimer() {
        // Clear any existing timer
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        // Store the start time if not already stored
        if (!localStorage.getItem('examStartTime')) {
            localStorage.setItem('examStartTime', new Date().getTime().toString());
        }

        this.timerInterval = setInterval(() => {
            if (this.timeLeft <= 0) {
                clearInterval(this.timerInterval);
                this.submitExam();
                return;
            }

            this.timeLeft--;
            const hours = Math.floor(this.timeLeft / 3600);
            const minutes = Math.floor((this.timeLeft % 3600) / 60);
            const seconds = this.timeLeft % 60;
            
            this.timerDisplay.textContent = 
                `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            // Add warning states
            if (this.timeLeft <= 300) { // Last 5 minutes
                this.timerDisplay.style.color = '#dc3545';
                this.timerDisplay.style.fontWeight = 'bold';
                if (this.timeLeft <= 60) { // Last 1 minute
                    this.timerDisplay.style.animation = 'blink 1s infinite';
                }
            }
        }, 1000);
    }

    createAlertContainer() {
        // Create alert container if it doesn't exist
        if (!document.getElementById('alertContainer')) {
            const alertContainer = document.createElement('div');
            alertContainer.id = 'alertContainer';
            const container = document.querySelector('.container');
            container.insertBefore(alertContainer, container.firstChild);
        }
    }

    showAlert(message, type = 'error') {
        const alertContainer = document.getElementById('alertContainer');
        if (!alertContainer) {
            console.error('Alert container not found');
            return;
        }

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type === 'error' ? 'danger' : 'success'} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        alertContainer.appendChild(alertDiv);
        
        // Auto-hide alert after 5 seconds
        setTimeout(() => {
            if (alertDiv && alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

    setLoading(isLoading) {
        if (!this.submitButton) {
            console.error('Submit button not found');
            return;
        }
        
        this.submitButton.disabled = isLoading;
        
        if (isLoading) {
            this.submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Submitting...';
            this.showAlert('Submitting your exam...', 'info');
        } else {
            this.submitButton.innerHTML = 'Submit Exam';
        }
    }

    showInstructionsModal() {
        const modal = new bootstrap.Modal(document.getElementById('instructionsModal'));
        modal.show();

        // Add event listener to start exam button
        document.getElementById('startExamBtn').addEventListener('click', () => {
            localStorage.setItem('examStarted', 'true');
            localStorage.setItem('examStartTime', new Date().getTime().toString());
            modal.hide();
            this.startTimer();
            this.displayCurrentQuestion();
        });
    }

    async submitExam() {
        try {
            if (!confirm('Are you sure you want to submit your exam?')) {
                return;
            }

            this.setLoading(true);
            
            const user = JSON.parse(localStorage.getItem('user'));
            const token = localStorage.getItem('token');

            if (!user || !token) {
                throw new Error('User data not found. Please login again.');
            }

            const answersObject = {};
            this.answers.forEach((value, key) => {
                const question = this.questions[key];
                if (question && question._id) {
                    answersObject[question._id] = value;
                }
            });

            // Calculate time spent based on exam settings duration and remaining time
            const examDuration = parseInt(localStorage.getItem('examDuration') || '7200');
            const timeSpent = this.formatTime(examDuration - this.timeLeft);

            const response = await fetch('http://localhost:5000/submit-exam', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    answers: answersObject,
                    userId: user.id,
                    email: user.email,
                    timeSpent: timeSpent
                })
            });

            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to submit exam');
            }

            const results = await response.json();
            results.timeSpent = timeSpent;

            // Mark exam as submitted
            localStorage.setItem('examSubmitted', 'true');
            localStorage.removeItem('examStarted');
            localStorage.removeItem('examStartTime');
            localStorage.removeItem('examDuration');
            
            // Save results and redirect to results page
            localStorage.setItem('examResults', JSON.stringify(results));
            window.location.href = 'results.html';

        } catch (error) {
            console.error('Submit exam error:', error);
            this.showAlert(error.message, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours}h ${minutes}m ${secs}s`;
    }

    async loadExamSettings() {
        try {
            const response = await fetch("http://localhost:5000/exam-settings", {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (!response.ok) {
                throw new Error('Failed to fetch exam settings');
            }
            
            const settings = await response.json();
            this.timeLeft = settings.duration; // Set duration from server
            localStorage.setItem('examDuration', settings.duration.toString()); // Store duration for later use
            
            // Update timer display immediately
            const hours = Math.floor(this.timeLeft / 3600);
            const minutes = Math.floor((this.timeLeft % 3600) / 60);
            const seconds = this.timeLeft % 60;
            this.timerDisplay.textContent = 
                `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                
        } catch (error) {
            console.error("Error fetching exam settings:", error);
            this.timeLeft = 7200; // Default to 2 hours if fetch fails
            localStorage.setItem('examDuration', '7200'); // Store default duration
            this.showAlert('Failed to load exam duration. Using default duration.', 'warning');
        }
    }
}

// Initialize exam when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the dashboard page
    if (window.location.pathname.endsWith('dashboard.html')) {
        try {
            window.examManager = new ExamManager();
        } catch (error) {
            console.error('Failed to initialize exam:', error);
            localStorage.clear(); // Clear all localStorage on fatal error
            window.location.replace('login.html');
        }
    }
});
