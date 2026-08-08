// ===== GitHub API Module =====
const GitHubAPI = {
    // Base URL for GitHub API
    BASE_URL: 'https://api.github.com',
    
    // Cache to avoid unnecessary API calls
    cache: {},
    
    /**
     * Fetch all pages of a paginated GitHub API endpoint
     * @param {string} url - The API endpoint URL
     * @returns {Promise<Array>} - Combined results from all pages
     */
    async fetchAllPages(url) {
        let results = [];
        let page = 1;
        const perPage = 100; // Max per page
        
        while (true) {
            const response = await fetch(`${url}?per_page=${perPage}&page=${page}`, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            // Handle rate limiting
            if (response.status === 403) {
                const rateLimitReset = response.headers.get('X-RateLimit-Reset');
                const resetDate = new Date(rateLimitReset * 1000);
                throw new Error(`Rate limit exceeded. Resets at ${resetDate.toLocaleTimeString()}. Please wait or use authentication.`);
            }
            
            // Handle user not found
            if (response.status === 404) {
                throw new Error('User not found. Please check the username and try again.');
            }
            
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.length === 0) break;
            
            results = results.concat(data);
            
            // Check if we've reached the last page
            const linkHeader = response.headers.get('Link');
            if (!linkHeader || !linkHeader.includes('rel="next"')) {
                break;
            }
            
            page++;
        }
        
        return results;
    },
    
    /**
     * Get all followers for a user
     * @param {string} username - GitHub username
     * @returns {Promise<Array>} - Array of follower objects
     */
    async getFollowers(username) {
        const cacheKey = `followers_${username}`;
        
        // Check cache (valid for 5 minutes)
        if (this.cache[cacheKey] && (Date.now() - this.cache[cacheKey].timestamp < 300000)) {
            return this.cache[cacheKey].data;
        }
        
        const url = `${this.BASE_URL}/users/${username}/followers`;
        const followers = await this.fetchAllPages(url);
        
        // Cache the results
        this.cache[cacheKey] = {
            data: followers,
            timestamp: Date.now()
        };
        
        return followers;
    },
    
    /**
     * Get all users that a user is following
     * @param {string} username - GitHub username
     * @returns {Promise<Array>} - Array of following objects
     */
    async getFollowing(username) {
        const cacheKey = `following_${username}`;
        
        // Check cache (valid for 5 minutes)
        if (this.cache[cacheKey] && (Date.now() - this.cache[cacheKey].timestamp < 300000)) {
            return this.cache[cacheKey].data;
        }
        
        const url = `${this.BASE_URL}/users/${username}/following`;
        const following = await this.fetchAllPages(url);
        
        // Cache the results
        this.cache[cacheKey] = {
            data: following,
            timestamp: Date.now()
        };
        
        return following;
    },
    
    /**
     * Get user details
     * @param {string} username - GitHub username
     * @returns {Promise<Object>} - User object
     */
    async getUser(username) {
        const response = await fetch(`${this.BASE_URL}/users/${username}`, {
            headers: {
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            throw new Error('User not found');
        }
        
        return await response.json();
    }
};