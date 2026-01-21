const { verifyAccessToken } = require('../utils/tokenUtils');
const User = require('../models/User');

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
const auth = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Access denied. No token provided.'
            });
        }
        
        const token = authHeader.split(' ')[1];
        
        // Verify token
        const decoded = verifyAccessToken(token);
        
        // Get user from database
        const user = await User.findById(decoded.userId).select('-password -refreshToken');
        
        if (!user) {
            return res.status(401).json({
                error: 'Invalid token. User not found.'
            });
        }
        
        // Attach user to request
        req.user = user;
        req.userId = user._id;
        
        next();
        
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expired. Please refresh your token.'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Invalid token.'
            });
        }
        
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            error: 'Authentication failed.'
        });
    }
};

/**
 * Optional Authentication Middleware
 * Attaches user if token present, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = verifyAccessToken(token);
            const user = await User.findById(decoded.userId).select('-password -refreshToken');
            
            if (user) {
                req.user = user;
                req.userId = user._id;
            }
        }
        
        next();
        
    } catch (error) {
        // Silently continue without authentication
        next();
    }
};

module.exports = { auth, optionalAuth };
