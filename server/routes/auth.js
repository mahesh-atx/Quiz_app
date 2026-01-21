const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { registerValidation, loginValidation } = require('../middleware/validateInput');

/**
 * Auth Routes
 * Handles authentication endpoints
 */

// =============================================================================
// PUBLIC ROUTES
// =============================================================================

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (Teacher or Admin)
 * @access  Public
 * @body    { name, email, password, role, institution?, organization? }
 */
router.post('/register', registerValidation, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 * @body    { email, password, role? }
 */
router.post('/login', loginValidation, authController.login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 * @body    { refreshToken }
 */
router.post('/refresh', authController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Public
 * @body    { refreshToken? }
 */
router.post('/logout', authController.logout);

// =============================================================================
// PROTECTED ROUTES
// =============================================================================

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get('/me', auth, authController.getCurrentUser);

/**
 * @route   PUT /api/auth/password
 * @desc    Change password
 * @access  Private
 * @body    { currentPassword, newPassword }
 */
router.put('/password', auth, authController.changePassword);

module.exports = router;
