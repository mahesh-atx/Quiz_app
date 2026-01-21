const express = require('express');
const cors = require('cors');
const path = require('path');

// Initialize Express app
const app = express();

// =============================================================================
// MIDDLEWARE
// =============================================================================

// Enable CORS
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// =============================================================================
// API ROUTES
// =============================================================================

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'QuizCraft API is running',
        timestamp: new Date().toISOString()
    });
});

// Auth routes
app.use('/api/auth', require('./routes/auth'));

// User routes
app.use('/api/users', require('./routes/user'));

// Category routes
app.use('/api/categories', require('./routes/category'));

// Quiz routes
app.use('/api/quizzes', require('./routes/quiz'));

// Question routes
app.use('/api/questions', require('./routes/question'));

// Result routes
app.use('/api/results', require('./routes/result'));

// =============================================================================
// SERVE FRONTEND
// =============================================================================

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Catch-all route for SPA - serve index.html for any unmatched routes
app.get('*', (req, res) => {
    // Check if the request is for an API route
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    // Otherwise serve the requested HTML file or index.html
    const htmlFile = path.join(__dirname, '../public', req.path);
    res.sendFile(htmlFile, (err) => {
        if (err) {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        }
    });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error',
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }
    });
});

module.exports = app;
