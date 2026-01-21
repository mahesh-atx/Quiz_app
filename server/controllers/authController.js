const User = require('../models/User');
const { generateTokenPair, verifyRefreshToken } = require('../utils/tokenUtils');

/**
 * Auth Controller
 * Handles user registration, login, token refresh, and logout
 */

// =============================================================================
// REGISTER
// =============================================================================

/**
 * Register a new user (Teacher or Admin)
 * POST /api/auth/register
 */
const register = async (req, res) => {
    try {
        const { name, email, password, role, institution, organization } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                error: 'An account with this email already exists'
            });
        }
        
        // Validate role-specific fields
        if (role === 'teacher' && !institution) {
            return res.status(400).json({
                error: 'Institution name is required for teachers'
            });
        }
        
        if (role === 'admin' && !organization) {
            return res.status(400).json({
                error: 'Organization name is required for administrators'
            });
        }
        
        // Create new user
        const user = new User({
            name,
            email: email.toLowerCase(),
            password,
            role,
            institution: role === 'teacher' ? institution : undefined,
            organization: role === 'admin' ? organization : undefined
        });
        
        // Generate tokens
        const tokens = generateTokenPair(user);
        user.refreshToken = tokens.refreshToken;
        
        // Save user
        await user.save();
        
        // Return user data and tokens
        res.status(201).json({
            message: 'Registration successful',
            user: user.toPublicProfile(),
            ...tokens
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        
        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(400).json({
                error: 'An account with this email already exists'
            });
        }
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({
                error: 'Validation failed',
                details: messages
            });
        }
        
        res.status(500).json({
            error: 'Registration failed. Please try again.'
        });
    }
};

// =============================================================================
// LOGIN
// =============================================================================

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res) => {
    try {
        const { email, password, role } = req.body;
        
        console.log('Login attempt:', { email, role }); // Debug log
        
        // =============================================================================
        // DUMMY LOGIN CREDENTIALS FOR TESTING
        // =============================================================================
        const dummyUsers = {
            'teacher@test.com': {
                password: 'teacher123',
                user: {
                    _id: 'dummy-teacher-id-123',
                    name: 'Test Teacher',
                    email: 'teacher@test.com',
                    role: 'teacher',
                    institution: 'Test School',
                    avatar: '',
                    onboardingCompleted: true,
                    createdAt: new Date()
                }
            },
            'admin@test.com': {
                password: 'admin123',
                user: {
                    _id: 'dummy-admin-id-456',
                    name: 'Test Admin',
                    email: 'admin@test.com',
                    role: 'admin',
                    organization: 'Test Organization',
                    avatar: '',
                    onboardingCompleted: true,
                    createdAt: new Date()
                }
            }
        };
        
        // Check if dummy credentials match
        const dummyUser = dummyUsers[email.toLowerCase()];
        if (dummyUser && dummyUser.password === password) {
            // Check role match for dummy users
            if (role && dummyUser.user.role !== role) {
                return res.status(401).json({
                    error: `This account is registered as ${dummyUser.user.role}, not ${role}`
                });
            }
            
            // Generate tokens for dummy user
            const tokens = generateTokenPair(dummyUser.user);
            
            console.log('Dummy login successful:', dummyUser.user.email);
            
            return res.json({
                message: 'Login successful',
                user: {
                    id: dummyUser.user._id,
                    name: dummyUser.user.name,
                    email: dummyUser.user.email,
                    role: dummyUser.user.role,
                    institution: dummyUser.user.institution,
                    organization: dummyUser.user.organization,
                    avatar: dummyUser.user.avatar,
                    onboardingCompleted: dummyUser.user.onboardingCompleted,
                    createdAt: dummyUser.user.createdAt
                },
                ...tokens
            });
        }
        // =============================================================================
        // END DUMMY LOGIN - Fall through to database authentication
        // =============================================================================
        
        // Find user with password field
        const user = await User.findByEmailWithPassword(email.toLowerCase());
        
        console.log('User found:', user ? { email: user.email, role: user.role } : 'Not found'); // Debug log
        
        if (!user) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }
        
        // Check if account is active
        if (!user.isActive) {
            return res.status(403).json({
                error: 'Your account has been deactivated. Please contact support.'
            });
        }
        
        // Verify password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }
        
        // Verify role matches (optional - can be removed if role selection is not required)
        if (role && user.role !== role) {
            return res.status(401).json({
                error: `This account is registered as ${user.role}, not ${role}`
            });
        }
        
        // Generate new tokens
        const tokens = generateTokenPair(user);
        
        // Update refresh token and last login
        user.refreshToken = tokens.refreshToken;
        user.lastLogin = new Date();
        await user.save();
        
        // Return user data and tokens
        res.json({
            message: 'Login successful',
            user: user.toPublicProfile(),
            ...tokens
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Login failed. Please try again.'
        });
    }
};


// =============================================================================
// REFRESH TOKEN
// =============================================================================

/**
 * Refresh access token using refresh token
 * POST /api/auth/refresh
 */
const refreshToken = async (req, res) => {
    try {
        const { refreshToken: token } = req.body;
        
        if (!token) {
            return res.status(400).json({
                error: 'Refresh token is required'
            });
        }
        
        // Verify refresh token
        let decoded;
        try {
            decoded = verifyRefreshToken(token);
        } catch (error) {
            return res.status(401).json({
                error: 'Invalid or expired refresh token'
            });
        }
        
        // Find user with matching refresh token
        const user = await User.findByRefreshToken(token);
        
        if (!user) {
            return res.status(401).json({
                error: 'Invalid refresh token'
            });
        }
        
        // Check if account is still active
        if (!user.isActive) {
            return res.status(403).json({
                error: 'Your account has been deactivated'
            });
        }
        
        // Generate new token pair
        const tokens = generateTokenPair(user);
        
        // Update refresh token
        user.refreshToken = tokens.refreshToken;
        await user.save();
        
        res.json({
            message: 'Token refreshed successfully',
            ...tokens
        });
        
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({
            error: 'Token refresh failed'
        });
    }
};

// =============================================================================
// LOGOUT
// =============================================================================

/**
 * Logout user (invalidate refresh token)
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
    try {
        const { refreshToken: token } = req.body;
        
        if (token) {
            // Find and clear user's refresh token
            await User.findOneAndUpdate(
                { refreshToken: token },
                { refreshToken: null }
            );
        }
        
        res.json({
            message: 'Logged out successfully'
        });
        
    } catch (error) {
        console.error('Logout error:', error);
        // Still return success even if there's an error
        res.json({
            message: 'Logged out successfully'
        });
    }
};

// =============================================================================
// GET CURRENT USER
// =============================================================================

/**
 * Get current authenticated user
 * GET /api/auth/me
 */
const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .populate('categories', 'name icon color');
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }
        
        res.json({
            user: user.toPublicProfile()
        });
        
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({
            error: 'Failed to get user data'
        });
    }
};

// =============================================================================
// CHANGE PASSWORD
// =============================================================================

/**
 * Change user password
 * PUT /api/auth/password
 */
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        // Get user with password
        const user = await User.findById(req.userId).select('+password');
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }
        
        // Verify current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({
                error: 'Current password is incorrect'
            });
        }
        
        // Update password
        user.password = newPassword;
        await user.save();
        
        // Generate new tokens (invalidate old sessions)
        const tokens = generateTokenPair(user);
        user.refreshToken = tokens.refreshToken;
        await user.save();
        
        res.json({
            message: 'Password changed successfully',
            ...tokens
        });
        
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            error: 'Failed to change password'
        });
    }
};

module.exports = {
    register,
    login,
    refreshToken,
    logout,
    getCurrentUser,
    changePassword
};
