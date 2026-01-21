/**
 * Role-Based Access Control Middleware
 * Restricts access to routes based on user roles
 */

/**
 * Check if user has required role(s)
 * @param {string|string[]} allowedRoles - Role(s) that can access the route
 * @returns {Function} Express middleware function
 */
const requireRole = (allowedRoles) => {
    // Ensure allowedRoles is an array
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    return (req, res, next) => {
        // Check if user exists (auth middleware should run first)
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required.'
            });
        }
        
        // Check if user's role is in allowed roles
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Access denied. Insufficient permissions.',
                required: roles,
                current: req.user.role
            });
        }
        
        next();
    };
};

/**
 * Admin only access
 */
const adminOnly = requireRole('admin');

/**
 * Teacher only access
 */
const teacherOnly = requireRole('teacher');

/**
 * Admin or Teacher access
 */
const adminOrTeacher = requireRole(['admin', 'teacher']);

module.exports = {
    requireRole,
    adminOnly,
    teacherOnly,
    adminOrTeacher
};
