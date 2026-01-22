const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const Category = require('../models/Category');

/**
 * Quiz Controller
 * Handles quiz CRUD operations
 */

// =============================================================================
// CREATE QUIZ
// =============================================================================

/**
 * Create a new quiz with questions
 * POST /api/quizzes
 */
const createQuiz = async (req, res) => {
    try {
        const { 
            title, 
            description, 
            category, 
            difficulty, 
            timeLimit, 
            passPercentage, 
            questions,
            isPublished 
        } = req.body;

        // 1. Validate Category
        // Note: Frontend sends category name or ID? 
        // Based on create-quiz.html, it sends name like 'mathematics'.
        // We need to find the Category ID.
        let categoryId = category;
        const foundCategory = await Category.findOne({ 
            $or: [
                { _id: category.match(/^[0-9a-fA-F]{24}$/) ? category : null },
                { name: { $regex: new RegExp(`^${category}$`, 'i') } }
            ]
        });

        if (!foundCategory) {
            return res.status(400).json({ error: 'Invalid category' });
        }
        categoryId = foundCategory._id;

        // 2. Create Quiz
        const quiz = new Quiz({
            title,
            description,
            category: categoryId,
            difficulty,
            timeLimit,
            passPercentage,
            isPublished: isPublished || false,
            createdBy: req.userId
        });

        // Generate access code if quiz is published
        if (isPublished) {
            const code = quiz.generateAccessCode();
            const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
            quiz.joinLink = `${baseUrl}/join-quiz.html?code=${code}`;
        }

        await quiz.save();

        // 3. Create Questions
        if (questions && Array.isArray(questions)) {
            const questionData = questions.map((q, index) => ({
                quiz: quiz._id,
                questionText: q.questionText,
                options: q.options,
                points: q.points || 1,
                order: index,
                explanation: q.explanation || ''
            }));

            await Question.insertMany(questionData);
            
            // Update quiz stats (totalPoints and questionCount)
            await quiz.updateStats();
        }

        res.status(201).json({
            message: 'Quiz created successfully',
            quiz: await Quiz.findById(quiz._id).populate('category', 'name')
        });

    } catch (error) {
        console.error('Create quiz error:', error);
        res.status(500).json({
            error: 'Failed to create quiz',
            details: error.message
        });
    }
};

// =============================================================================
// GET ALL QUIZZES
// =============================================================================

/**
 * Get all quizzes
 * GET /api/quizzes
 */
const getQuizzes = async (req, res) => {
    try {
        const { category, difficulty, teacher } = req.query;
        
        let query = {};
        
        if (category) query.category = category;
        if (difficulty) query.difficulty = difficulty;
        if (teacher) query.createdBy = teacher;
        
        // If teacher is requested, usually they want their own quizzes (including drafts)
        // Public users should only see published quizzes
        if (!teacher) {
            query.isPublished = true;
        }

        const quizzes = await Quiz.find(query)
            .populate('category', 'name icon color')
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });

        res.json({ quizzes });

    } catch (error) {
        console.error('Get quizzes error:', error);
        res.status(500).json({ error: 'Failed to fetch quizzes' });
    }
};

// =============================================================================
// GET SINGLE QUIZ
// =============================================================================

/**
 * Get quiz by ID with questions
 * GET /api/quizzes/:id
 */
const getQuizById = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id)
            .populate('category', 'name icon color')
            .populate('createdBy', 'name')
            .populate('questions');

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        res.json({ quiz });

    } catch (error) {
        console.error('Get quiz error:', error);
        res.status(500).json({ error: 'Failed to fetch quiz' });
    }
};

// =============================================================================
// DELETE QUIZ
// =============================================================================

/**
 * Delete quiz
 * DELETE /api/quizzes/:id
 */
const deleteQuiz = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        // Check ownership
        if (quiz.createdBy.toString() !== req.userId && req.userRole !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized to delete this quiz' });
        }

        // Questions are deleted via pre-remove hook in Quiz model (if implemented)
        // Our Quiz model uses post('remove') but Mongoose 5+ prefers middleware on deleteOne/findByIdAndDelete
        // Let's manually delete questions to be sure
        await Question.deleteMany({ quiz: quiz._id });
        await Quiz.findByIdAndDelete(req.params.id);

        res.json({ message: 'Quiz and associated questions deleted successfully' });

    } catch (error) {
        console.error('Delete quiz error:', error);
        res.status(500).json({ error: 'Failed to delete quiz' });
    }
};

/**
 * Generate or regenerate access code for a quiz
 * POST /api/quizzes/:id/generate-code
 */
const generateCode = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        // Check ownership
        if (quiz.createdBy.toString() !== req.userId && req.userRole !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Generate new code
        const code = quiz.generateAccessCode();
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        quiz.joinLink = `${baseUrl}/join-quiz.html?code=${code}`;
        
        await quiz.save();

        res.json({
            message: 'Access code generated successfully',
            accessCode: quiz.accessCode,
            joinLink: quiz.joinLink
        });

    } catch (error) {
        console.error('Generate code error:', error);
        res.status(500).json({ error: 'Failed to generate code' });
    }
};

/**
 * Get quiz by access code (public endpoint)
 * GET /api/quizzes/join/:code
 */
const getQuizByCode = async (req, res) => {
    try {
        const { code } = req.params;

        const quiz = await Quiz.findOne({ 
            accessCode: code.toUpperCase(),
            isPublished: true 
        })
        .populate('category', 'name icon color')
        .populate('createdBy', 'name');

        if (!quiz) {
            return res.status(404).json({ error: 'Invalid code or quiz not found' });
        }

        res.json({
            quiz: {
                id: quiz._id,
                title: quiz.title,
                description: quiz.description,
                category: quiz.category,
                difficulty: quiz.difficulty,
                timeLimit: quiz.timeLimit,
                questionCount: quiz.questionCount,
                createdBy: quiz.createdBy
            }
        });

    } catch (error) {
        console.error('Get quiz by code error:', error);
        res.status(500).json({ error: 'Failed to fetch quiz' });
    }
};

module.exports = {
    createQuiz,
    getQuizzes,
    getQuizById,
    deleteQuiz,
    generateCode,
    getQuizByCode
};
