/**
 * Shared Authentication Utilities
 * Session-based authentication helper for all protected pages
 */

// Check if user is authenticated via session
async function checkAuth() {
    try {
        const response = await fetch("/api/auth/me", {
            credentials: "include", // Important: Include cookies
        });

        if (!response.ok) {
            // Not authenticated - redirect to login
            localStorage.removeItem("user");
            window.location.href = "/login.html";
            return null;
        }

        const data = await response.json();
        // Update localStorage with fresh user data
        localStorage.setItem("user", JSON.stringify(data.user));
        return data.user;
    } catch (error) {
        console.error("Auth check failed:", error);
        localStorage.removeItem("user");
        window.location.href = "/login.html";
        return null;
    }
}

// Update user UI elements (sidebar, headers, etc.)
function updateUserUI(user) {
    // Update user name
    const userNameEl = document.getElementById("userName");
    if (userNameEl) {
        userNameEl.textContent = user.name || "User";
    }
    
    // Update user initial
    const userInitialEl = document.getElementById("userInitial");
    if (userInitialEl) {
        userInitialEl.textContent = (user.name?.[0] || "U").toUpperCase();
    }
    
    // Update welcome name (if exists)
    const welcomeNameEl = document.getElementById("welcomeName");
    if (welcomeNameEl) {
        welcomeNameEl.textContent = user.name?.split(" ")[0] || "User";
    }
}

// Setup logout button
function setupLogout() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            try {
                await fetch("/api/auth/logout", {
                    method: "POST",
                    credentials: "include",
                });
            } catch (e) {
                console.error("Logout error:", e);
            }
            localStorage.removeItem("user");
            window.location.href = "/login.html";
        });
    }
}

// Initialize authentication for a protected page
async function initAuth() {
    const user = await checkAuth();
    if (user) {
        updateUserUI(user);
        setupLogout();
    }
    return user;
}

// Make authenticated fetch request (includes credentials)
async function authFetch(url, options = {}) {
    return fetch(url, {
        ...options,
        credentials: "include",
    });
}
