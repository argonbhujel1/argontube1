/**
 * ArgonTube - Main JavaScript File
 * Handles all client-side interactions and UI functionality
 */

// ============================================
// Global Variables and Configuration
// ============================================
const CONFIG = {
    animationDuration: 300,
    debounceDelay: 300,
    mobileBreakpoint: 768,
    tabletBreakpoint: 1024
};

// ============================================
// Utility Functions
// ============================================

/**
 * Debounce function to limit function calls
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 */
function debounce(func, delay = CONFIG.debounceDelay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Throttle function to limit function execution rate
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 */
function throttle(func, limit = 100) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Format number with commas
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

/**
 * Get time ago string
 * @param {string} dateString - Date string
 * @returns {string} Time ago string
 */
function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + ' days ago';
    if (seconds < 2592000) return Math.floor(seconds / 604800) + ' weeks ago';
    if (seconds < 31536000) return Math.floor(seconds / 2592000) + ' months ago';
    return Math.floor(seconds / 31536000) + ' years ago';
}

/**
 * Get cookie value
 * @param {string} name - Cookie name
 * @returns {string|null} Cookie value
 */
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

/**
 * Set cookie value
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {number} days - Expiration in days
 */
function setCookie(name, value, days = 30) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/;SameSite=Lax`;
}

// ============================================
// DOM Elements Cache
// ============================================
const DOM = {
    get sidebar() { return document.getElementById('sidebar'); },
    get sidebarOverlay() { return document.getElementById('sidebarOverlay'); },
    get menuToggle() { return document.getElementById('menuToggle'); },
    get userMenu() { return document.getElementById('userMenu'); },
    get userBtn() { return document.getElementById('userBtn'); },
    get notificationMenu() { return document.getElementById('notificationMenu'); },
    get notificationBtn() { return document.getElementById('notificationBtn'); },
    get notificationBadge() { return document.getElementById('notificationBadge'); },
    get searchInput() { return document.getElementById('searchInput'); },
    get searchSuggestions() { return document.getElementById('searchSuggestions'); },
    get videoPlayer() { return document.getElementById('videoPlayer'); }
};

// ============================================
// Sidebar Management
// ============================================
const SidebarManager = {
    isOpen: window.innerWidth > CONFIG.mobileBreakpoint,
    
    init() {
        // Set initial state based on screen size
        if (window.innerWidth <= CONFIG.mobileBreakpoint) {
            this.close();
        } else {
            this.open();
        }
        
        // Load saved state
        const savedState = localStorage.getItem('sidebarState');
        if (savedState === 'collapsed' && window.innerWidth > CONFIG.mobileBreakpoint) {
            this.close();
        }
        
        this.bindEvents();
    },
    
    bindEvents() {
        // Menu toggle button
        DOM.menuToggle?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });
        
        // Overlay click (mobile only)
        DOM.sidebarOverlay?.addEventListener('click', () => {
            if (window.innerWidth <= CONFIG.mobileBreakpoint) {
                this.close();
            }
        });
        
        // Close sidebar on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen && window.innerWidth <= CONFIG.mobileBreakpoint) {
                this.close();
            }
        });
        
        // Handle window resize
        window.addEventListener('resize', debounce(() => {
            if (window.innerWidth > CONFIG.mobileBreakpoint) {
                this.open();
                DOM.sidebarOverlay?.classList.remove('active');
            } else {
                this.close();
            }
        }, 250));
    },
    
    open() {
        if (window.innerWidth > CONFIG.mobileBreakpoint) {
            DOM.sidebar?.classList.remove('collapsed');
            document.querySelector('.main-content')?.classList.remove('expanded');
            document.querySelector('.footer')?.classList.remove('expanded');
        } else {
            DOM.sidebar?.classList.add('mobile-open');
            DOM.sidebarOverlay?.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        this.isOpen = true;
        localStorage.setItem('sidebarState', 'open');
    },
    
    close() {
        if (window.innerWidth > CONFIG.mobileBreakpoint) {
            DOM.sidebar?.classList.add('collapsed');
            document.querySelector('.main-content')?.classList.add('expanded');
            document.querySelector('.footer')?.classList.add('expanded');
        } else {
            DOM.sidebar?.classList.remove('mobile-open');
            DOM.sidebarOverlay?.classList.remove('active');
            document.body.style.overflow = '';
        }
        this.isOpen = false;
        localStorage.setItem('sidebarState', 'collapsed');
    },
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
};

// ============================================
// Dropdown Management
// ============================================
const DropdownManager = {
    activeDropdown: null,
    
    init() {
        this.bindEvents();
    },
    
    bindEvents() {
        // User menu
        DOM.userBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown(DOM.userMenu);
        });
        
        // Notification menu
        DOM.notificationBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown(DOM.notificationMenu);
            this.loadNotifications();
        });
        
        // Close all dropdowns on outside click
        document.addEventListener('click', () => {
            this.closeAllDropdowns();
        });
        
        // Prevent closing when clicking inside dropdown
        document.querySelectorAll('.dropdown-menu, .notification-menu').forEach(menu => {
            menu?.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });
        
        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllDropdowns();
            }
        });
    },
    
    toggleDropdown(dropdown) {
        if (!dropdown) return;
        
        const isActive = dropdown.classList.contains('active');
        this.closeAllDropdowns();
        
        if (!isActive) {
            dropdown.classList.add('active');
            this.activeDropdown = dropdown;
        }
    },
    
    closeAllDropdowns() {
        document.querySelectorAll('.dropdown-menu, .notification-menu').forEach(menu => {
            menu.classList.remove('active');
        });
        this.activeDropdown = null;
    },
    
    async loadNotifications() {
        try {
            const response = await fetch('/notifications');
            if (response.ok) {
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const notificationList = doc.getElementById('notificationList');
                const badge = doc.getElementById('notificationBadge');
                
                if (notificationList) {
                    document.getElementById('notificationList').innerHTML = notificationList.innerHTML;
                }
                if (badge) {
                    DOM.notificationBadge.textContent = badge.textContent;
                }
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    }
};

// ============================================
// Search Functionality
// ============================================
const SearchManager = {
    searchTimeout: null,
    
    init() {
        this.bindEvents();
    },
    
    bindEvents() {
        DOM.searchInput?.addEventListener('input', debounce((e) => {
            this.handleSearchInput(e.target.value);
        }, 300));
        
        // Close suggestions on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                this.hideSuggestions();
            }
        });
        
        // Keyboard navigation for suggestions
        DOM.searchInput?.addEventListener('keydown', (e) => {
            const suggestions = DOM.searchSuggestions;
            if (!suggestions?.classList.contains('active')) return;
            
            const items = suggestions.querySelectorAll('.search-suggestion-item');
            const activeItem = suggestions.querySelector('.search-suggestion-item.active');
            let index = Array.from(items).indexOf(activeItem);
            
            switch(e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    index = Math.min(index + 1, items.length - 1);
                    this.highlightSuggestion(items, index);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    index = Math.max(index - 1, 0);
                    this.highlightSuggestion(items, index);
                    break;
                case 'Enter':
                    if (activeItem) {
                        e.preventDefault();
                        activeItem.click();
                    }
                    break;
                case 'Escape':
                    this.hideSuggestions();
                    break;
            }
        });
    },
    
    async handleSearchInput(query) {
        if (query.length < 2) {
            this.hideSuggestions();
            return;
        }
        
        try {
            const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`);
            if (response.ok) {
                const suggestions = await response.json();
                this.showSuggestions(suggestions, query);
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    },
    
    showSuggestions(suggestions, query) {
        const container = DOM.searchSuggestions;
        if (!container || suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }
        
        container.innerHTML = suggestions.map(title => `
            <div class="search-suggestion-item" data-query="${this.escapeHtml(title)}">
                <svg viewBox="0 0 24 24" width="16" height="16" class="suggestion-icon">
                    <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <span>${this.highlightMatch(title, query)}</span>
            </div>
        `).join('');
        
        container.classList.add('active');
        
        // Add click events to suggestions
        container.querySelectorAll('.search-suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                DOM.searchInput.value = item.dataset.query;
                DOM.searchInput.closest('form').submit();
                this.hideSuggestions();
            });
        });
    },
    
    hideSuggestions() {
        DOM.searchSuggestions?.classList.remove('active');
        DOM.searchSuggestions && (DOM.searchSuggestions.innerHTML = '');
    },
    
    highlightSuggestion(items, index) {
        items.forEach(item => item.classList.remove('active'));
        if (items[index]) {
            items[index].classList.add('active');
            items[index].scrollIntoView({ block: 'nearest' });
        }
    },
    
    highlightMatch(text, query) {
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        return text.replace(regex, '<strong style="color: #ff0000;">$1</strong>');
    },
    
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
    
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
};

// ============================================
// Video Player Enhancements
// ============================================
const VideoPlayerManager = {
    init() {
        const video = DOM.videoPlayer;
        if (!video) return;
        
        this.video = video;
        this.setupKeyboardShortcuts();
        this.setupProgressTracking();
        this.setupTheaterMode();
    },
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle if no input is focused
            if (document.activeElement.tagName === 'INPUT' || 
                document.activeElement.tagName === 'TEXTAREA') return;
            
            const video = this.video;
            if (!video) return;
            
            switch(e.key.toLowerCase()) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    video.paused ? video.play() : video.pause();
                    break;
                case 'm':
                    video.muted = !video.muted;
                    break;
                case 'f':
                    if (document.fullscreenElement) {
                        document.exitFullscreen();
                    } else {
                        video.requestFullscreen();
                    }
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    video.currentTime = Math.max(0, video.currentTime - 5);
                    break;
                case 'arrowright':
                    e.preventDefault();
                    video.currentTime = Math.min(video.duration, video.currentTime + 5);
                    break;
                case 'arrowup':
                    e.preventDefault();
                    video.volume = Math.min(1, video.volume + 0.1);
                    break;
                case 'arrowdown':
                    e.preventDefault();
                    video.volume = Math.max(0, video.volume - 0.1);
                    break;
                case '0':
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                case '6':
                case '7':
                case '8':
                case '9':
                    e.preventDefault();
                    const num = parseInt(e.key);
                    video.currentTime = (video.duration / 10) * num;
                    break;
            }
        });
    },
    
    setupProgressTracking() {
        // Save watch progress
        this.video?.addEventListener('timeupdate', throttle(() => {
            const progress = this.video.currentTime;
            const videoId = this.getVideoId();
            if (videoId) {
                setCookie(`video_progress_${videoId}`, progress.toString());
            }
        }, 5000));
        
        // Restore watch progress
        const videoId = this.getVideoId();
        if (videoId) {
            const savedProgress = getCookie(`video_progress_${videoId}`);
            if (savedProgress) {
                this.video.currentTime = parseFloat(savedProgress);
            }
        }
    },
    
    setupTheaterMode() {
        // Add theater mode toggle if needed
        const theaterBtn = document.createElement('button');
        theaterBtn.className = 'theater-mode-btn';
        theaterBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M19 7H5c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 8H5V9h14v6z"/>
            </svg>
        `;
        theaterBtn.onclick = () => this.toggleTheaterMode();
        
        const container = this.video?.parentElement;
        if (container) {
            container.style.position = 'relative';
            theaterBtn.style.cssText = `
                position: absolute;
                bottom: 60px;
                right: 16px;
                background: rgba(0,0,0,0.6);
                border: none;
                color: white;
                padding: 8px;
                border-radius: 4px;
                cursor: pointer;
                z-index: 10;
            `;
            container.appendChild(theaterBtn);
        }
    },
    
    toggleTheaterMode() {
        const container = this.video?.parentElement;
        if (container) {
            container.classList.toggle('theater-mode');
            if (container.classList.contains('theater-mode')) {
                container.style.maxWidth = '100%';
                container.style.width = '100%';
            } else {
                container.style.maxWidth = '';
                container.style.width = '';
            }
        }
    },
    
    getVideoId() {
        const path = window.location.pathname;
        const match = path.match(/\/watch\/(\d+)/);
        return match ? match[1] : null;
    }
};

// ============================================
// Lazy Loading Images
// ============================================
const LazyLoader = {
    init() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                        }
                        observer.unobserve(img);
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.01
            });
            
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        } else {
            // Fallback for browsers without IntersectionObserver
            document.querySelectorAll('img[data-src]').forEach(img => {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            });
        }
    }
};

// ============================================
// Infinite Scroll (for search results and video lists)
// ============================================
const InfiniteScroll = {
    isLoading: false,
    page: 1,
    hasMore: true,
    
    init() {
        if (window.location.pathname === '/search') {
            this.setupSearchScroll();
        }
    },
    
    setupSearchScroll() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.isLoading && this.hasMore) {
                    this.loadMoreResults();
                }
            });
        }, { threshold: 0.1 });
        
        const sentinel = document.createElement('div');
        sentinel.className = 'scroll-sentinel';
        sentinel.style.height = '1px';
        document.querySelector('.search-container')?.appendChild(sentinel);
        observer.observe(sentinel);
    },
    
    async loadMoreResults() {
        this.isLoading = true;
        this.page++;
        
        const url = new URL(window.location.href);
        url.searchParams.set('page', this.page);
        
        try {
            const response = await fetch(url);
            if (response.ok) {
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const newVideos = doc.querySelector('.video-grid');
                
                if (newVideos && newVideos.children.length > 0) {
                    document.querySelector('.video-grid').insertAdjacentHTML('beforeend', newVideos.innerHTML);
                    LazyLoader.init();
                } else {
                    this.hasMore = false;
                }
            }
        } catch (error) {
            console.error('Failed to load more results:', error);
        } finally {
            this.isLoading = false;
        }
    }
};

// ============================================
// Notification Badge Updater
// ============================================
const NotificationUpdater = {
    init() {
        this.updateBadge();
        // Update badge every 30 seconds
        setInterval(() => this.updateBadge(), 30000);
    },
    
    async updateBadge() {
        try {
            const response = await fetch('/api/notifications/count');
            if (response.ok) {
                const data = await response.json();
                const badge = DOM.notificationBadge;
                if (badge) {
                    if (data.count > 0) {
                        badge.textContent = data.count > 99 ? '99+' : data.count;
                        badge.style.display = 'flex';
                    } else {
                        badge.style.display = 'none';
                    }
                }
            }
        } catch (error) {
            // Silently fail for notification badge
        }
    }
};

// ============================================
// Form Validation
// ============================================
const FormValidator = {
    init() {
        this.validateRegistrationForm();
        this.validateUploadForm();
        this.setupRealTimeValidation();
    },
    
    validateRegistrationForm() {
        const form = document.querySelector('.auth-form');
        if (!form) return;
        
        form.addEventListener('submit', (e) => {
            const password = form.querySelector('input[name="password"]');
            const confirmPassword = form.querySelector('input[name="confirm_password"]');
            const username = form.querySelector('input[name="username"]');
            
            if (username && username.value.length < 3) {
                e.preventDefault();
                this.showError(username, 'Username must be at least 3 characters');
                return;
            }
            
            if (password && password.value.length < 6) {
                e.preventDefault();
                this.showError(password, 'Password must be at least 6 characters');
                return;
            }
            
            if (password && confirmPassword && password.value !== confirmPassword.value) {
                e.preventDefault();
                this.showError(confirmPassword, 'Passwords do not match');
                return;
            }
        });
    },
    
    validateUploadForm() {
        const form = document.getElementById('uploadForm');
        if (!form) return;
        
        form.addEventListener('submit', (e) => {
            const title = form.querySelector('input[name="title"]');
            const videoFile = form.querySelector('input[name="video"]');
            
            if (title && title.value.trim().length === 0) {
                e.preventDefault();
                this.showError(title, 'Title is required');
                return;
            }
            
            if (videoFile && (!videoFile.files || videoFile.files.length === 0)) {
                e.preventDefault();
                this.showError(videoFile, 'Please select a video file');
                return;
            }
            
            if (videoFile && videoFile.files[0]) {
                const maxSize = 500 * 1024 * 1024; // 500MB
                if (videoFile.files[0].size > maxSize) {
                    e.preventDefault();
                    this.showError(videoFile, 'File size must be less than 500MB');
                    return;
                }
            }
        });
    },
    
    setupRealTimeValidation() {
        document.querySelectorAll('.form-input[required]').forEach(input => {
            input.addEventListener('blur', () => {
                if (input.value.trim() === '') {
                    this.showError(input, 'This field is required');
                } else {
                    this.clearError(input);
                }
            });
            
            input.addEventListener('input', () => {
                if (input.classList.contains('error')) {
                    this.clearError(input);
                }
            });
        });
    },
    
    showError(input, message) {
        const existingError = input.parentElement.querySelector('.error-message');
        if (existingError) existingError.remove();
        
        input.classList.add('error');
        input.style.borderColor = '#ff4444';
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            color: #ff4444;
            font-size: 12px;
            margin-top: 4px;
            display: flex;
            align-items: center;
            gap: 4px;
        `;
        errorDiv.innerHTML = `
            <svg viewBox="0 0 24 24" width="12" height="12">
                <path fill="#ff4444" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            ${message}
        `;
        input.parentElement.appendChild(errorDiv);
    },
    
    clearError(input) {
        input.classList.remove('error');
        input.style.borderColor = '';
        const errorMessage = input.parentElement.querySelector('.error-message');
        if (errorMessage) errorMessage.remove();
    }
};

// ============================================
// Share Functionality
// ============================================
const ShareManager = {
    async share(title, url) {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: title,
                    url: url || window.location.href
                });
            } catch (error) {
                if (error.name !== 'AbortError') {
                    this.copyToClipboard(url || window.location.href);
                }
            }
        } else {
            this.copyToClipboard(url || window.location.href);
        }
    },
    
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Link copied to clipboard!', 'success');
        }).catch(() => {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showToast('Link copied to clipboard!', 'success');
        });
    },
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            z-index: 9999;
            animation: slideUp 0.3s ease;
            background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideDown 0.3s ease reverse';
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    }
};

// ============================================
// Theme Management
// ============================================
const ThemeManager = {
    init() {
        // Always dark theme for ArgonTube
        document.documentElement.setAttribute('data-theme', 'dark');
    }
};

// ============================================
// Performance Optimizations
// ============================================
const PerformanceOptimizer = {
    init() {
        this.setupIntersectionObserver();
        this.setupResizeObserver();
    },
    
    setupIntersectionObserver() {
        // Stop animations when not visible
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const animations = entry.target.getAnimations();
                animations.forEach(animation => {
                    if (entry.isIntersecting) {
                        animation.play();
                    } else {
                        animation.pause();
                    }
                });
            });
        });
        
        document.querySelectorAll('.video-card, .category-card').forEach(el => {
            observer.observe(el);
        });
    },
    
    setupResizeObserver() {
        // Debounce resize events for performance
        const resizeObserver = new ResizeObserver(debounce((entries) => {
            entries.forEach(entry => {
                // Handle resize if needed
                const width = entry.contentRect.width;
                // Adjust layout for different sizes
            });
        }, 150));
        
        resizeObserver.observe(document.body);
    }
};

// ============================================
// Initialize Everything
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all components
    SidebarManager.init();
    DropdownManager.init();
    SearchManager.init();
    VideoPlayerManager.init();
    LazyLoader.init();
    InfiniteScroll.init();
    NotificationUpdater.init();
    FormValidator.init();
    ThemeManager.init();
    PerformanceOptimizer.init();
    
    // Add mobile search toggle
    setupMobileSearch();
    
    // Handle service worker for PWA (optional)
    if ('serviceWorker' in navigator) {
        // navigator.serviceWorker.register('/static/js/sw.js');
    }
    
    // Log initialization
    console.log('%c🚀 ArgonTube Initialized %cSuccessfully',
        'color: #ff0000; font-size: 16px; font-weight: bold;',
        'color: #ffffff;');
    console.log('%cVideo sharing platform ready!',
        'color: #aaaaaa; font-size: 12px;');
});

// ============================================
// Mobile Search Toggle
// ============================================
function setupMobileSearch() {
    const navCenter = document.querySelector('.nav-center');
    const searchForm = document.querySelector('.search-form');
    
    if (!navCenter || !searchForm) return;
    
    // Create mobile search toggle button
    const mobileSearchBtn = document.createElement('button');
    mobileSearchBtn.className = 'mobile-search-toggle';
    mobileSearchBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
    `;
    
    // Insert button in nav-right for mobile
    const navRight = document.querySelector('.nav-right');
    if (navRight && window.innerWidth <= 768) {
        navRight.insertBefore(mobileSearchBtn, navRight.firstChild);
    }
    
    mobileSearchBtn.addEventListener('click', () => {
        navCenter.classList.toggle('mobile-search-open');
        if (navCenter.classList.contains('mobile-search-open')) {
            searchForm.querySelector('input')?.focus();
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            navCenter.classList.remove('mobile-search-open');
            if (mobileSearchBtn.parentElement) {
                mobileSearchBtn.remove();
            }
        } else if (!document.querySelector('.mobile-search-toggle')) {
            if (navRight) {
                navRight.insertBefore(mobileSearchBtn, navRight.firstChild);
            }
        }
    });
}

// ============================================
// Global Share Function (for onclick handlers in templates)
// ============================================
function shareVideo(title, url) {
    ShareManager.share(title || document.title, url || window.location.href);
}

// ============================================
// Keyboard Shortcuts Info
// ============================================
// Press '?' to show keyboard shortcuts overlay
document.addEventListener('keydown', (e) => {
    if (e.key === '?' && document.activeElement === document.body) {
        e.preventDefault();
        showKeyboardShortcuts();
    }
});

function showKeyboardShortcuts() {
    const overlay = document.createElement('div');
    overlay.className = 'shortcuts-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease;
    `;
    
    overlay.innerHTML = `
        <div class="shortcuts-panel glass-card" style="padding: 32px; max-width: 500px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2 style="font-size: 20px;">Keyboard Shortcuts</h2>
                <button onclick="this.closest('.shortcuts-overlay').remove()" style="background:none; color:white; font-size:24px;">&times;</button>
            </div>
            <div style="display: grid; gap: 12px;">
                ${[
                    ['Space / K', 'Play / Pause'],
                    ['M', 'Mute / Unmute'],
                    ['F', 'Fullscreen'],
                    ['← / →', 'Seek 5 seconds'],
                    ['↑ / ↓', 'Volume up / down'],
                    ['0-9', 'Jump to 0-90%'],
                    ['?', 'Show this menu'],
                    ['Esc', 'Close menus']
                ].map(([key, desc]) => `
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <kbd style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; font-size: 13px;">${key}</kbd>
                        <span style="color: #aaa;">${desc}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

// ============================================
// Additional Animations
// ============================================
// Add keyframe for toast animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from { transform: translate(-50%, 100px); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
    }
    
    @keyframes slideDown {
        from { transform: translate(-50%, 0); opacity: 1; }
        to { transform: translate(-50%, 100px); opacity: 0; }
    }
    
    .toast { animation: slideUp 0.3s ease; }
    
    .theater-mode {
        position: fixed !important;
        top: var(--navbar-height);
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 100;
        background: #000;
    }
    
    .theater-mode video {
        max-height: calc(100vh - var(--navbar-height)) !important;
    }
`;
document.head.appendChild(style);

// ============================================
// Export for module usage (if needed)
// ============================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SidebarManager,
        DropdownManager,
        SearchManager,
        VideoPlayerManager,
        ShareManager,
        FormValidator
    };
}
