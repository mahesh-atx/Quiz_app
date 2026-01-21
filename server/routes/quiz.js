const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const { auth } = require('../middleware/auth');

/**
 * Quiz Routes
 */

router.get('/', quizController.getQuizzes);
router.get('/:id', quizController.getQuizById);

// Protected routes
router.post('/', auth, quizController.createQuiz);
router.delete('/:id', auth, quizController.deleteQuiz);

module.exports = router;
