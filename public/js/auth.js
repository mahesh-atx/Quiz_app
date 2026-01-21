/**
 * QuizCraft - Authentication Utilities
 * Handles token management, auth state, and API requests
 */

const Auth = {
    // Storage keys
    KEYS: {
        ACCESS_TOKEN: 'accessToken',
        REFRESH_TOKEN: 'refreshToken',
        USER: 'user'
    },
    
    /**
     * Get access token from storage
     */
    getAccessToken() {
        return localStorage.getItem(this.KEYS.ACCESS_TOKEN);
    },
    
    /**
     * Get refresh token from storage
     */
    getRefreshToken() {
        return localStorage.getItem(this.KEYS.REFRESH_TOKEN);
    },
    
    /**
     * Get current user from storage
     */
    getUser() {
        const user = localStorage.getItem(this.KEYS.USER);
        return user ? JSON.parse(user) : null;
    },
    
    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.getAccessToken();
    },
    
    /**
     * Save tokens to storage
     */
    saveTokens(accessToken, refreshToken) {
        localStorage.setItem(this.KEYS.ACCESS_TOKEN, accessToken);
        localStorage.setItem(this.KEYS.REFRESH_TOKEN, refreshToken);
    },
    
    /**
     * Save user to storage
     */
    saveUser(user) {
        localStorage.setItem(this.KEYS.USER, JSON.stringify(user));
    },
    
    /**
     * Clear all auth data
     */
    clearAuth() {
        localStorage.removeItem(this.KEYS.ACCESS_TOKEN);
        localStorage.removeItem(this.KEYS.REFRESH_TOKEN);
        localStorage.removeItem(this.KEYS.USER);
    },
    
    /**
     * Logout user
     */
    async logout() {
        const refreshToken = this.getRefreshToken();
        
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refreshToken })
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
        
        this.clearAuth();
        window.location.href = '/login.html';
    },
    
    /**
     * Refresh access token
     */
    async refreshAccessToken() {
        const refreshToken = this.getRefreshToken();
        
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }
        
        const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refreshToken })
        });
        
        if (!response.ok) {
            throw new Error('Failed to refresh token');
        }
        
        const data = await response.json();
        this.saveTokens(data.accessToken, data.refreshToken);
        
        return data.accessToken;
    },
    
    /**
     * Make authenticated API request
     * Automatically handles token refresh on 401
     */
    async apiRequest(url, options = {}) {
        const accessToken = this.getAccessToken();
        
        // Add auth header
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }
        
        let response = await fetch(url, {
            ...options,
            headers
        });
        
        // If 401, try to refresh token and retry
        if (response.status === 401 && this.getRefreshToken()) {
            try {
                const newToken = await this.refreshAccessToken();
                headers['Authorization'] = `Bearer ${newToken}`;
                
                response = await fetch(url, {
                    ...options,
                    headers
                });
            } catch (error) {
                // Refresh failed, logout
                this.clearAuth();
                window.location.href = '/login.html';
                throw error;
            }
        }
        
        return response;
    },
    
    /**
     * Check if user has required role
     */
    hasRole(role) {
        const user = this.getUser();
        if (!user) return false;
        
        if (Array.isArray(role)) {
            return role.includes(user.role);
        }
        
        return user.role === role;
    },
    
    /**
     * Require authentication - redirect to login if not authenticated
     */
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
    },
    
    /**
     * Require specific role - redirect if not authorized
     */
    requireRole(role) {
        if (!this.requireAuth()) return false;
        
        if (!this.hasRole(role)) {
            window.location.href = '/dashboard.html';
            return false;
        }
        return true;
    },
    
    /**
     * Redirect if already authenticated
     */
    redirectIfAuthenticated() {
        if (this.isAuthenticated()) {
            const user = this.getUser();
            if (user) {
                if (!user.onboardingCompleted) {
                    window.location.href = user.role === 'admin' 
                        ? '/onboarding-admin.html' 
                        : '/onboarding-teacher.html';
                } else {
                    window.location.href = user.role === 'admin' 
                        ? '/admin/dashboard.html' 
                        : '/dashboard.html';
                }
            }
            return true;
        }
        return false;
    }
};

/**
 * Toast notification system
 */
const Toast = {
    container: null,
    
    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'fixed bottom-6 right-6 z-50 space-y-2';
            document.body.appendChild(this.container);
        }
    },
    
    show(message, type = 'info', duration = 4000) {
        this.init();
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="flex items-center gap-3">
                <i data-lucide="${this.getIcon(type)}" class="w-5 h-5"></i>
                <span>${message}</span>
                <button class="ml-4 text-zinc-400 hover:text-white" onclick="this.parentElement.parentElement.remove()">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        
        this.container.appendChild(toast);
        
        // Initialize icons in the toast
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        // Auto remove
        setTimeout(() => {
            toast.remove();
        }, duration);
    },
    
    getIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'alert-circle',
            warning: 'alert-triangle',
            info: 'info'
        };
        return icons[type] || icons.info;
    },
    
    success(message) {
        this.show(message, 'success');
    },
    
    error(message) {
        this.show(message, 'error');
    },
    
    warning(message) {
        this.show(message, 'warning');
    },
    
    info(message) {
        this.show(message, 'info');
    }
};

/**
 * Loading state helper
 */
const Loading = {
    show(element, text = 'Loading...') {
        if (element) {
            element.dataset.originalContent = element.innerHTML;
            element.disabled = true;
            element.innerHTML = `<div class="spinner"></div><span class="ml-2">${text}</span>`;
        }
    },
    
    hide(element) {
        if (element && element.dataset.originalContent) {
            element.disabled = false;
            element.innerHTML = element.dataset.originalContent;
            delete element.dataset.originalContent;
            
            // Reinitialize icons
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    }
};

/**
 * Format utilities
 */
const Format = {
    date(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },
    
    time(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },
    
    percentage(value) {
        return `${Math.round(value)}%`;
    }
};

// Export for module usage (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Auth, Toast, Loading, Format };
}
