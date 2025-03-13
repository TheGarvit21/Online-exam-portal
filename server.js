require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, 'questions-' + Date.now() + '.json');
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype !== 'application/json') {
            return cb(new Error('Only JSON files are allowed'));
        }
        cb(null, true);
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public')); // Serve static files from public directory

// Configuration
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/local";
const SECRET_KEY = process.env.SECRET_KEY || "your_secret_key";

// MongoDB Connection with proper error handling
mongoose.connect(MONGO_URI, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000 // Timeout after 5s instead of 30s
})
.then(() => console.log("✅ MongoDB Connected Successfully"))
.catch(err => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
});

// Schemas
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
}, { timestamps: true });

const QuestionSchema = new mongoose.Schema({
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correctAnswer: { type: String, required: true }
}, { timestamps: true });

const ResultSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    email: { type: String, required: true },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    percentage: { type: Number, required: true },
    timeSpent: { type: String },
    detailedResults: [{ 
        question: String,
        userAnswer: String,
        correctAnswer: String,
        isCorrect: Boolean
    }]
}, { timestamps: true });

const ExamSettingsSchema = new mongoose.Schema({
    duration: { type: Number, default: 7200 }, // Default 2 hours in seconds
    passingPercentage: { type: Number, default: 50 }
}, { timestamps: true });

// Models
const User = mongoose.model("User", UserSchema);
const Question = mongoose.model("Question", QuestionSchema);
const Result = mongoose.model("Result", ResultSchema);
const ExamSettings = mongoose.model("ExamSettings", ExamSettingsSchema);

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: "No token provided" });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid token" });
    }
};

// Admin middleware
const isAdmin = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token === 'admin_authenticated') {
        next();
    } else {
        res.status(403).json({ message: "Admin access required" });
    }
};

// Routes
app.post("/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email already registered" });
        }

        const newUser = new User({ username, email, password });
        await newUser.save();
        
        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ message: "Registration failed", error: error.message });
    }
});

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const user = await User.findOne({ email });

        if (!user || user.password !== password) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign(
            { userId: user._id, email: user.email }, 
            SECRET_KEY, 
            { expiresIn: "24h" }
        );

        res.json({ 
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.username
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Login failed", error: error.message });
    }
});

app.post("/add-question", isAdmin, async (req, res) => {
    try {
        const { question, options, correctAnswer } = req.body;
        
        if (!question || !options || !correctAnswer) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (!options.includes(correctAnswer)) {
            return res.status(400).json({ message: "Correct answer must be one of the options" });
        }

        const newQuestion = new Question({ question, options, correctAnswer });
        await newQuestion.save();
        
        res.status(201).json({ 
            message: "Question added successfully",
            question: newQuestion
        });
    } catch (error) {
        console.error("Add question error:", error);
        res.status(500).json({ message: "Failed to add question", error: error.message });
    }
});

app.get("/get-questions", async (req, res) => {
    try {
        // Remove correctAnswer from response for security
        let questions = await Question.find({}, { 
            question: 1, 
            options: 1,
            _id: 1
        });
        
        // Randomize questions order
        questions = questions.sort(() => Math.random() - 0.5);
        
        if (questions.length === 0) {
            return res.status(404).json({ message: "No questions available" });
        }
        
        res.json(questions);
    } catch (error) {
        console.error("Fetch questions error:", error);
        res.status(500).json({ message: "Failed to fetch questions", error: error.message });
    }
});

app.post("/submit-exam", verifyToken, async (req, res) => {
    try {
        const { answers, userId, email, timeSpent } = req.body;
        
        if (!answers || !userId || !email) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const questions = await Question.find({});
        let correctAnswers = 0;
        let detailedResults = [];
        
        questions.forEach(question => {
            const userAnswer = answers[question._id];
            const isCorrect = userAnswer === question.correctAnswer;
            if (isCorrect) correctAnswers++;
            
            detailedResults.push({
                question: question.question,
                userAnswer: userAnswer || "Not answered",
                correctAnswer: question.correctAnswer,
                isCorrect
            });
        });

        const totalQuestions = questions.length;
        const percentage = (correctAnswers / totalQuestions) * 100;

        // Save to database
        const result = new Result({
            userId,
            email,
            score: correctAnswers,
            totalQuestions,
            percentage,
            timeSpent,
            detailedResults
        });
        await result.save();

        // Save to file
        const resultText = `
===========================================
Exam Results - ${new Date().toLocaleString()}
===========================================
Email: ${email}
Score: ${correctAnswers}/${totalQuestions}
Percentage: ${percentage.toFixed(2)}%
Time Spent: ${timeSpent || 'Not recorded'}

Detailed Question Analysis:
${detailedResults.map((item, index) => `
Question ${index + 1}: ${item.question}
Your Answer: ${item.userAnswer}
Correct Answer: ${item.correctAnswer}
Status: ${item.isCorrect ? '✓ Correct' : '✗ Incorrect'}
`).join('\n')}
===========================================\n\n`;
        
        fs.appendFileSync(
            path.join(__dirname, 'exam_results.txt'),
            resultText,
            'utf8'
        );

        res.json({
            score: correctAnswers,
            totalQuestions,
            percentage: percentage.toFixed(2),
            detailedResults
        });
    } catch (error) {
        console.error("Submit exam error:", error);
        res.status(500).json({ message: "Failed to submit exam", error: error.message });
    }
});

app.get("/user-results/:email", verifyToken, async (req, res) => {
    try {
        const results = await Result.find({ email: req.params.email })
            .sort({ createdAt: -1 });
        res.json(results);
    } catch (error) {
        console.error("Fetch results error:", error);
        res.status(500).json({ message: "Failed to fetch results", error: error.message });
    }
});

// Admin Routes
app.get("/admin/stats/questions", isAdmin, async (req, res) => {
    try {
        const count = await Question.countDocuments();
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch questions count" });
    }
});

app.get("/admin/stats/users", isAdmin, async (req, res) => {
    try {
        const count = await User.countDocuments();
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch users count" });
    }
});

app.get("/admin/stats/exams", isAdmin, async (req, res) => {
    try {
        const count = await Result.countDocuments();
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch exams count" });
    }
});

app.get("/admin/questions", isAdmin, async (req, res) => {
    try {
        const questions = await Question.find({}).sort({ createdAt: -1 });
        res.json(questions);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch questions" });
    }
});

app.delete("/admin/questions/:id", isAdmin, async (req, res) => {
    try {
        const question = await Question.findByIdAndDelete(req.params.id);
        if (!question) {
            return res.status(404).json({ message: "Question not found" });
        }
        res.json({ message: "Question deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete question" });
    }
});

// Bulk add questions
app.post("/add-bulk-questions", isAdmin, async (req, res) => {
    try {
        const { questions } = req.body;
        
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ message: "No valid questions provided" });
        }

        const validQuestions = questions.filter(q => 
            q.question && 
            Array.isArray(q.options) && 
            q.options.length === 4 && 
            q.correctAnswer
        );

        if (validQuestions.length === 0) {
            return res.status(400).json({ message: "No valid questions found in upload" });
        }

        const result = await Question.insertMany(validQuestions);
        
        res.status(201).json({ 
            message: "Questions added successfully",
            count: result.length
        });
    } catch (error) {
        console.error("Bulk add questions error:", error);
        res.status(500).json({ message: "Failed to add questions", error: error.message });
    }
});

// Update exam settings
app.post("/update-exam-settings", isAdmin, async (req, res) => {
    try {
        const { duration, passingPercentage } = req.body;
        
        if (!duration || !passingPercentage) {
            return res.status(400).json({ message: "Duration and passing percentage are required" });
        }

        if (duration < 1 || duration > 180) {
            return res.status(400).json({ message: "Duration must be between 1 and 180 minutes" });
        }

        if (passingPercentage < 0 || passingPercentage > 100) {
            return res.status(400).json({ message: "Passing percentage must be between 0 and 100" });
        }

        const settings = await ExamSettings.findOne();
        
        if (settings) {
            settings.duration = duration * 60; // Convert minutes to seconds
            settings.passingPercentage = passingPercentage;
            await settings.save();
        } else {
            await ExamSettings.create({
                duration: duration * 60,
                passingPercentage
            });
        }

        res.json({ 
            message: "Exam settings updated successfully",
            settings: {
                duration: duration * 60,
                passingPercentage
            }
        });
    } catch (error) {
        console.error("Update exam settings error:", error);
        res.status(500).json({ message: "Failed to update settings", error: error.message });
    }
});

// Get exam settings
app.get("/exam-settings", async (req, res) => {
    try {
        let settings = await ExamSettings.findOne();
        
        if (!settings) {
            settings = await ExamSettings.create({
                duration: 7200, // 2 hours in seconds
                passingPercentage: 50
            });
        }

        res.json(settings);
    } catch (error) {
        console.error("Get exam settings error:", error);
        res.status(500).json({ message: "Failed to fetch settings", error: error.message });
    }
});

// Delete all questions with proper validation
app.delete("/admin/questions", isAdmin, async (req, res) => {
    try {
        const count = await Question.countDocuments();
        if (count === 0) {
            return res.status(404).json({ message: "No questions to delete" });
        }

        await Question.deleteMany({});
        
        res.json({ 
            message: "All questions deleted successfully",
            deletedCount: count
        });
    } catch (error) {
        console.error("Delete all questions error:", error);
        res.status(500).json({ message: "Failed to delete questions", error: error.message });
    }
});

// Add new route for file upload
app.post("/upload-questions", isAdmin, upload.single('questions'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        // Read the uploaded file
        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        let questions;

        try {
            questions = JSON.parse(fileContent);
        } catch (error) {
            fs.unlinkSync(req.file.path); // Delete invalid file
            return res.status(400).json({ message: "Invalid JSON format" });
        }

        // Validate questions format
        if (!Array.isArray(questions)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: "Questions must be an array" });
        }

        const validQuestions = questions.filter(q => 
            q.question && 
            Array.isArray(q.options) && 
            q.options.length === 4 && 
            q.correctAnswer &&
            q.options.includes(q.correctAnswer)
        );

        if (validQuestions.length === 0) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: "No valid questions found in file" });
        }

        // Save questions to database
        const result = await Question.insertMany(validQuestions);
        
        // Delete the uploaded file
        fs.unlinkSync(req.file.path);

        res.status(201).json({ 
            message: "Questions uploaded successfully",
            count: result.length
        });
    } catch (error) {
        console.error("Upload questions error:", error);
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ message: "Failed to upload questions", error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Something broke!", error: err.message });
});

// Start server with error handling
app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
}).on('error', (err) => {
    console.error("❌ Server error:", err);
    process.exit(1);
});
