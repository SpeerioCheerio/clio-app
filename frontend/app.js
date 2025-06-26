// API Configuration
// Use relative URLs for production deployment - this will automatically work with the current domain
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:5000' 
    : ''; // Empty string means use relative URLs (same domain)

console.log('[DEBUG] API_BASE_URL:', API_BASE_URL);
console.log('[DEBUG] Current hostname:', window.location.hostname);
console.log('[DEBUG] Is localhost:', window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Global utilities and shared functions
class AppUtils {
    // API call wrapper with error handling
    static async apiCall(endpoint, options = {}) {
        const url = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        try {
            console.log(`[DEBUG] Making API call to: ${url}`);
            console.log(`[DEBUG] Options:`, { ...defaultOptions, ...options });
            
            const response = await fetch(url, { ...defaultOptions, ...options });
            
            console.log(`[DEBUG] Response status: ${response.status}`);
            console.log(`[DEBUG] Response headers:`, Object.fromEntries(response.headers.entries()));
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[DEBUG] Response error: ${errorText}`);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            
            const data = await response.json();
            console.log(`[DEBUG] Response data:`, data);
            return data;
        } catch (error) {
            console.error('[DEBUG] API call failed:', error);
            console.error('[DEBUG] Error details:', {
                message: error.message,
                stack: error.stack,
                url: url,
                options: { ...defaultOptions, ...options }
            });
            throw error;
        }
    }

    // Format timestamp to relative time (e.g., "2 minutes ago")
    static formatRelativeTime(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffInSeconds = Math.floor((now - time) / 1000);

        if (diffInSeconds < 60) {
            return 'Just now';
        } else if (diffInSeconds < 3600) {
            const minutes = Math.floor(diffInSeconds / 60);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else if (diffInSeconds < 86400) {
            const hours = Math.floor(diffInSeconds / 3600);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else {
            const days = Math.floor(diffInSeconds / 86400);
            return `${days} day${days > 1 ? 's' : ''} ago`;
        }
    }

    // Format timestamp to readable date/time
    static formatDateTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString();
    }

    // Truncate text to specified length
    static truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    // Detect content type for better display
    static getContentType(content) {
        const text = content.toLowerCase().trim();
        
        if (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('www.')) {
            return 'url';
        } else if (text.includes('@') && text.includes('.') && text.split('@').length === 2) {
            return 'email';
        } else if (this.isCode(content)) {
            return 'code';
        } else if (/^\d+\.?\d*$/.test(text)) {
            return 'number';
        } else {
            return 'text';
        }
    }

    // Simple code detection
    static isCode(content) {
        const codeKeywords = [
            'function', 'const', 'let', 'var', 'if', 'else', 'for', 'while',
            'class', 'def', 'import', 'from', 'return', 'print', 'console.log',
            'public', 'private', 'protected', 'static', 'void', 'int', 'string'
        ];
        
        const codePatterns = [
            /^\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*\([^)]*\)\s*{/, // function definition
            /^\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*function/, // function assignment
            /^\s*\/\/.*$|^\s*\/\*[\s\S]*?\*\//, // comments
            /^\s*#.*$/, // Python comments
            /[{}\[\];]/, // common code punctuation
        ];

        return codeKeywords.some(keyword => content.toLowerCase().includes(keyword)) ||
               codePatterns.some(pattern => pattern.test(content));
    }

    // Get icon for content type
    static getContentIcon(contentType) {
        return '';
    }

    // Show toast notification
    static showToast(message, type = 'info', duration = 3000) {
        const toastContainer = document.getElementById('toastContainer') || this.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        toastContainer.appendChild(toast);
        
        // Auto remove after duration
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, duration);
    }

    // Create toast container if it doesn't exist
    static createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    }

    // Check if server is online
    static async checkServerStatus() {
        try {
            const response = await fetch(`${API_BASE_URL}/`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    // Update server status indicator
    static async updateServerStatus() {
        const statusDot = document.getElementById('serverStatus');
        const statusText = document.getElementById('serverStatusText');
        
        if (!statusDot || !statusText) return;

        try {
            const isOnline = await this.checkServerStatus();
            
            if (isOnline) {
                statusDot.className = 'status-dot online';
                statusText.textContent = 'Connected';
            } else {
                statusDot.className = 'status-dot offline';
                statusText.textContent = 'Offline';
            }
        } catch (error) {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Error';
        }
    }

    // Debounce function for search and other rapid-fire events
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Copy text to clipboard
    static async copyToClipboard(text) {
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                this.showToast('Copied to clipboard!', 'success');
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.showToast('Copied to clipboard!', 'success');
            }
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            this.showToast('Failed to copy to clipboard', 'error');
        }
    }

    // Validate email format
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Validate URL format
    static isValidURL(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    // Format file size
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Generate random ID
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Local storage helpers
    static setLocalStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }

    static getLocalStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Failed to read from localStorage:', error);
            return defaultValue;
        }
    }

    // Initialize common event listeners
    static initializeCommonListeners() {
        // Handle sidebar toggle on mobile
        const toggleBtn = document.getElementById('toggleSidebar');
        const sidebar = document.getElementById('sidebar');
        
        if (toggleBtn && sidebar) {
            toggleBtn.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.toggle('mobile-open');
                } else {
                    sidebar.classList.toggle('collapsed');
                }
            });
        }

        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768 && sidebar) {
                sidebar.classList.remove('mobile-open');
            }
        });

        // Check server status periodically
        this.updateServerStatus();
        setInterval(() => this.updateServerStatus(), 30000); // Check every 30 seconds

        // Handle escape key to close modals/overlays
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Close any open modals or overlays
                const modals = document.querySelectorAll('.modal.open, .overlay.open');
                modals.forEach(modal => modal.classList.remove('open'));
            }
        });
    }

    // Search functionality for arrays of objects
    static searchArray(array, searchTerm, searchFields) {
        if (!searchTerm) return array;
        
        const term = searchTerm.toLowerCase();
        return array.filter(item => {
            return searchFields.some(field => {
                const value = item[field];
                return value && value.toString().toLowerCase().includes(term);
            });
        });
    }

    // Sort array by field
    static sortArray(array, field, direction = 'asc') {
        return array.sort((a, b) => {
            const aVal = a[field];
            const bVal = b[field];
            
            if (direction === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });
    }

    // Handle form submission with loading state
    static async handleFormSubmit(form, submitHandler) {
        const submitBtn = form.querySelector('[type="submit"]');
        const originalText = submitBtn.textContent;
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Loading...';
            
            await submitHandler();
            
        } catch (error) {
            console.error('Form submission error:', error);
            this.showToast('An error occurred. Please try again.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    // Test API connectivity
    static async testAPI() {
        console.log('[DEBUG] Testing API connectivity...');
        try {
            const response = await fetch(`${API_BASE_URL}/api/test`);
            const data = await response.json();
            console.log('[DEBUG] API test successful:', data);
            return { success: true, data };
        } catch (error) {
            console.error('[DEBUG] API test failed:', error);
            return { success: false, error: error.message };
        }
    }
}

// Global aliases for convenience
const apiCall = AppUtils.apiCall.bind(AppUtils);
const formatRelativeTime = AppUtils.formatRelativeTime.bind(AppUtils);
const formatDateTime = AppUtils.formatDateTime.bind(AppUtils);
const truncateText = AppUtils.truncateText.bind(AppUtils);
const showToast = AppUtils.showToast.bind(AppUtils);
const copyToClipboard = AppUtils.copyToClipboard.bind(AppUtils);
const checkServerStatus = AppUtils.checkServerStatus.bind(AppUtils);

// Initialize common functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    AppUtils.initializeCommonListeners();
});

// Export for use in other files (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppUtils;
}