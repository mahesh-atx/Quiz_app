const User = require('../models/User');

/**
 * Auth Controller
 * Handles user registration, login, logout using SESSION-BASED authentication
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
        
        console.log('📝 Registration attempt:', { name, email, role, hasInstitution: !!institution });
        
        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({
                error: 'Name, email, and password are required'
            });
        }
        
        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            console.log('⚠️  User already exists:', email);
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
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password,
            role,
            institution: role === 'teacher' ? institution.trim() : undefined,
            organization: role === 'admin' ? organization.trim() : undefined
        });
        
        console.log('💾 Saving user to database...');
        
        // Save user
        await user.save();
        
        console.log('✅ User saved successfully:', user._id, user.email);
        
        // Create session
        req.session.userId = user._id;
        req.session.role = user.role;
        req.session.email = user.email;
        
        console.log('✅ Session created for user:', user.email);
        
        // Return user data
        res.status(201).json({
            message: 'Registration successful',
            user: user.toPublicProfile()
        });
        
    } catch (error) {
        console.error('❌ Registration error:', error.message, error);
        console.error('Stack:', error.stack);
        
        // Handle duplicate key error
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                error: `An account with this ${field} already exists`
            });
        }
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message);
            console.error('Validation errors:', messages);
            return res.status(400).json({
                error: 'Validation failed',
                details: messages
            });
        }
        
        // MongoDB connection error
        if (error.name === 'MongooseError' || error.message?.includes('connect')) {
            console.error('Database connection error');
            return res.status(503).json({
                error: 'Database connection error. Please try again in a moment.'
            });
        }
        
        res.status(500).json({
            error: 'Registration failed. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
        
        console.log('Login attempt:', { email, role });
        
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
            
            // Create session for dummy user
            req.session.userId = dummyUser.user._id;
            req.session.role = dummyUser.user.role;
            req.session.email = dummyUser.user.email;
            
            console.log('✅ Dummy login successful:', dummyUser.user.email);
            
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
                }
            });
        }
        // =============================================================================
        // END DUMMY LOGIN - Fall through to database authentication
        // =============================================================================
        
        // Find user with password field
        const user = await User.findByEmailWithPassword(email.toLowerCase());
        
        console.log('User found:', user ? { email: user.email, role: user.role } : 'Not found');
        
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
        
        // Log role mismatch but allow login with actual role
        if (role && user.role !== role) {
            console.log(`Role mismatch: User selected ${role} but is registered as ${user.role}`);
        }
        
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        
        // Create session
        req.session.userId = user._id;
        req.session.role = user.role;
        req.session.email = user.email;
        
        console.log('✅ Login successful:', user.email);
        
        // Return user data
        res.json({
            message: 'Login successful',
            user: user.toPublicProfile()
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Login failed. Please try again.'
        });
    }
};

// =============================================================================
// LOGOUT
// =============================================================================

/**
 * Logout user (destroy session)
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
    try {
        const userEmail = req.session.email;
        
        // Destroy session
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destroy error:', err);
                return res.status(500).json({
                    error: 'Logout failed'
                });
            }
            
            // Clear cookie
            res.clearCookie('connect.sid');
            
            console.log('✅ User logged out:', userEmail);
            
            res.json({
                message: 'Logged out successfully'
            });
        });
        
    } catch (error) {
        console.error('Logout error:', error);
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
        // Check if session exists
        if (!req.session.userId) {
            return res.status(401).json({
                error: 'Not authenticated'
            });
        }
        
        // Handle dummy users
        if (req.session.userId === 'dummy-teacher-id-123') {
            return res.json({
                user: {
                    id: 'dummy-teacher-id-123',
                    name: 'Test Teacher',
                    email: 'teacher@test.com',
                    role: 'teacher',
                    institution: 'Test School',
                    onboardingCompleted: true
                }
            });
        }
        
        if (req.session.userId === 'dummy-admin-id-456') {
            return res.json({
                user: {
                    id: 'dummy-admin-id-456',
                    name: 'Test Admin',
                    email: 'admin@test.com',
                    role: 'admin',
                    organization: 'Test Organization',
                    onboardingCompleted: true
                }
            });
        }
        
        // Get user from database
        const user = await User.findById(req.session.userId)
            .populate('categories', 'name icon color');
        
        if (!user) {
            // Session exists but user doesn't - destroy session
            req.session.destroy();
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
// CHECK AUTH STATUS
// =============================================================================

/**
 * Check if user is authenticated
 * GET /api/auth/check
 */
const checkAuth = async (req, res) => {
    if (req.session.userId) {
        res.json({
            authenticated: true,
            role: req.session.role
        });
    } else {
        res.json({
            authenticated: false
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
        
        if (!req.session.userId) {
            return res.status(401).json({
                error: 'Not authenticated'
            });
        }
        
        // Get user with password
        const user = await User.findById(req.session.userId).select('+password');
        
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
        
        res.json({
            message: 'Password changed successfully'
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
    logout,
    getCurrentUser,
    checkAuth,
    changePassword
};
