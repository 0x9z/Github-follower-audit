// ===== Main Application Module =====
const App = {
    // Store current data
    currentData: {
        username: '',
        followers: [],
        following: [],
        notFollowingBack: [],
        snakes: []
    },
    
    // Local storage keys
    STORAGE_KEY: 'github_follower_audit_history',
    
    /**
     * Initialize the application
     */
    init() {
        // Add event listener for Enter key
        document.getElementById('usernameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.startAudit();
            }
        });
        
        // Load last searched username from localStorage
        const lastUsername = localStorage.getItem('github_audit_last_username');
        if (lastUsername) {
            document.getElementById('usernameInput').value = lastUsername;
        }
    },
    
    /**
     * Start the audit process
     */
    async startAudit() {
        const username = document.getElementById('usernameInput').value.trim();
        
        if (!username) {
            this.showError('Please enter a GitHub username.');
            return;
        }
        
        // Save username for next time
        localStorage.setItem('github_audit_last_username', username);
        
        // Show loading
        this.showLoading(true);
        this.hideError();
        this.hideResults();
        
        try {
            // Fetch data
            const [followers, following] = await Promise.all([
                GitHubAPI.getFollowers(username),
                GitHubAPI.getFollowing(username)
            ]);
            
            // Store current data
            this.currentData.username = username;
            this.currentData.followers = followers;
            this.currentData.following = following;
            
            // Compare and find non-followers
            this.findNotFollowingBack();
            
            // Detect snakes
            this.detectSnakes();
            
            // Update history
            this.updateHistory();
            
            // Display results
            this.displayResults();
            
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    },
    
    /**
     * Find users who are being followed but don't follow back
     */
    findNotFollowingBack() {
        const followerLogins = new Set(
            this.currentData.followers.map(f => f.login.toLowerCase())
        );
        
        this.currentData.notFollowingBack = this.currentData.following.filter(
            user => !followerLogins.has(user.login.toLowerCase())
        );
    },
    
    /**
     * Detect snakes (users who followed, got followed back, then unfollowed)
     */
    detectSnakes() {
        const history = this.getHistory();
        const previousFollowers = history[this.currentData.username] || [];
        
        // Current followers as set of logins
        const currentFollowerLogins = new Set(
            this.currentData.followers.map(f => f.login.toLowerCase())
        );
        
        // Previous followers as set of logins
        const previousFollowerLogins = new Set(
            previousFollowers.map(login => login.toLowerCase())
        );
        
        // Find users who were followers before but aren't now
        const unfollowedUsers = previousFollowers.filter(
            login => !currentFollowerLogins.has(login.toLowerCase())
        );
        
        // Check if we're following them (meaning we followed back)
        const followingLogins = new Set(
            this.currentData.following.map(f => f.login.toLowerCase())
        );
        
        // Snakes are those who unfollowed us AND we're still following them
        this.currentData.snakes = unfollowedUsers.filter(login => {
            return followingLogins.has(login.toLowerCase());
        }).map(login => {
            // Try to find user in current following list for full details
            const userData = this.currentData.following.find(
                f => f.login.toLowerCase() === login.toLowerCase()
            );
            return userData || { login: login };
        });
    },
    
    /**
     * Update history in localStorage
     */
    updateHistory() {
        const history = this.getHistory();
        
        // Store current followers list
        history[this.currentData.username] = this.currentData.followers.map(f => f.login);
        
        // Add timestamp
        history[`${this.currentData.username}_timestamp`] = new Date().toISOString();
        
        // Save to localStorage
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
    },
    
    /**
     * Get history from localStorage
     */
    getHistory() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    },
    
    /**
     * Display results in the UI
     */
    displayResults() {
        // Update stats
        document.getElementById('followersCount').textContent = this.currentData.followers.length;
        document.getElementById('followingCount').textContent = this.currentData.following.length;
        document.getElementById('notFollowingBackCount').textContent = this.currentData.notFollowingBack.length;
        document.getElementById('snakesCount').textContent = this.currentData.snakes.length;
        
        // Show stats section
        document.getElementById('statsSection').classList.remove('hidden');
        
        // Populate not following back table
        this.populateNotFollowingTable();
        
        // Populate snakes table
        this.populateSnakesTable();
        
        // Show results section
        document.getElementById('resultsSection').classList.remove('hidden');
        
        // Switch to appropriate tab
        if (this.currentData.notFollowingBack.length > 0) {
            this.switchTab('notFollowing');
        } else if (this.currentData.snakes.length > 0) {
            this.switchTab('snakes');
        } else {
            this.switchTab('notFollowing');
        }
    },
    
    /**
     * Populate the "Not Following Back" table
     */
    populateNotFollowingTable() {
        const tbody = document.getElementById('notFollowingBody');
        const emptyState = document.getElementById('noNotFollowing');
        const table = document.getElementById('notFollowingTable');
        
        tbody.innerHTML = '';
        
        if (this.currentData.notFollowingBack.length === 0) {
            table.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }
        
        table.classList.remove('hidden');
        emptyState.classList.add('hidden');
        
        this.currentData.notFollowingBack.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <img src="${user.avatar_url}&s=80" alt="${user.login}" class="avatar-img">
                </td>
                <td>
                    <strong>${user.login}</strong>
                </td>
                <td>
                    <a href="${user.html_url}" target="_blank" class="profile-link">
                        <i class="fas fa-external-link-alt"></i> View Profile
                    </a>
                </td>
                <td>
                    <a href="${user.html_url}" target="_blank" class="unfollow-btn">
                        <i class="fas fa-user-minus"></i> Unfollow
                    </a>
                </td>
            `;
            tbody.appendChild(row);
        });
    },
    
    /**
     * Populate the "Snakes" table
     */
    populateSnakesTable() {
        const tbody = document.getElementById('snakesBody');
        const emptyState = document.getElementById('noSnakes');
        const table = document.getElementById('snakesTable');
        
        tbody.innerHTML = '';
        
        if (this.currentData.snakes.length === 0) {
            table.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }
        
        table.classList.remove('hidden');
        emptyState.classList.add('hidden');
        
        this.currentData.snakes.forEach(user => {
            const row = document.createElement('tr');
            const avatarUrl = user.avatar_url 
                ? `${user.avatar_url}&s=80` 
                : `https://github.com/${user.login}.png?size=80`;
            const profileUrl = user.html_url 
                || `https://github.com/${user.login}`;
            
            row.innerHTML = `
                <td>
                    <img src="${avatarUrl}" alt="${user.login}" class="avatar-img">
                </td>
                <td>
                    <strong>${user.login}</strong>
                </td>
                <td>
                    <a href="${profileUrl}" target="_blank" class="profile-link">
                        <i class="fas fa-external-link-alt"></i> View Profile
                    </a>
                </td>
                <td>
                    <span class="snake-badge">
                        <i class="fas fa-snake"></i> Snake!
                    </span>
                </td>
            `;
            tbody.appendChild(row);
        });
    },
    
    /**
     * Switch between tabs
     */
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        
        if (tabName === 'notFollowing') {
            document.querySelectorAll('.tab')[0].classList.add('active');
            document.getElementById('notFollowingTab').classList.remove('hidden');
        } else if (tabName === 'snakes') {
            document.querySelectorAll('.tab')[1].classList.add('active');
            document.getElementById('snakesTab').classList.remove('hidden');
        }
    },
    
    /**
     * Show/hide loading spinner
     */
    showLoading(show) {
        const loadingEl = document.getElementById('loading');
        if (show) {
            loadingEl.classList.remove('hidden');
        } else {
            loadingEl.classList.add('hidden');
        }
    },
    
    /**
     * Show error message
     */
    showError(message) {
        const errorEl = document.getElementById('error');
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    },
    
    /**
     * Hide error message
     */
    hideError() {
        document.getElementById('error').classList.add('hidden');
    },
    
    /**
     * Hide results section
     */
    hideResults() {
        document.getElementById('statsSection').classList.add('hidden');
        document.getElementById('resultsSection').classList.add('hidden');
    }
};

// ===== Global Functions (for HTML onclick handlers) =====
function startAudit() {
    App.startAudit();
}

function switchTab(tabName) {
    App.switchTab(tabName);
}

// ===== Initialize App when page loads =====
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});