// Clipboard Management functionality
class ClipboardManager {
    constructor() {
        this.entries = [];
        this.filteredEntries = [];
        this.currentFilter = 'all';
        this.searchTerm = '';
        this.clipboardSlots = {
            A: null,
            B: null
        };
        
        this.initializeEventListeners();
        this.loadClipboardHistory();
        this.loadClipboardSlots();
        
        // Auto-refresh every 30 seconds
        setInterval(() => this.loadClipboardHistory(), 30000);
    }

    initializeEventListeners() {
        // Search input
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', AppUtils.debounce((e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.filterAndDisplayEntries();
        }, 300));

        // Filter buttons
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                filterButtons.forEach(b => b.classList.remove('active'));
                e.target.closest('.filter-btn').classList.add('active');
                this.currentFilter = e.target.closest('.filter-btn').dataset.filter;
                this.filterAndDisplayEntries();
            });
        });

        // View toggle
        const viewButtons = document.querySelectorAll('.view-btn');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                viewButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.updateViewStyle(e.target.dataset.view);
            });
        });

        // Keyboard shortcuts for clipboard slots
        document.addEventListener('keydown', (e) => {
            // Only trigger if not typing in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch(e.key) {
                case 'F6':
                    e.preventDefault();
                    this.copyToSlot('A');
                    break;
                case 'F7':
                    e.preventDefault();
                    this.copyToSlot('B');
                    break;
                case 'F8':
                    e.preventDefault();
                    this.pasteSlot('A');
                    break;
                case 'F9':
                    e.preventDefault();
                    this.pasteSlot('B');
                    break;
            }
        });
    }

    async loadClipboardHistory() {
        try {
            const response = await apiCall('/api/clipboard');
            if (response.success) {
                this.entries = response.entries;
                this.filterAndDisplayEntries();
                this.updateStatistics();
                this.updateFilterCounts();
            }
        } catch (error) {
            console.error('Error loading clipboard history:', error);
            showToast('Error loading clipboard history', 'error');
        }
    }

    filterAndDisplayEntries() {
        let filtered = this.entries;

        // Apply content type filter
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(entry => entry.content_type === this.currentFilter);
        }

        // Apply search filter
        if (this.searchTerm) {
            filtered = filtered.filter(entry => 
                entry.content.toLowerCase().includes(this.searchTerm) ||
                (entry.source_app && entry.source_app.toLowerCase().includes(this.searchTerm))
            );
        }

        this.filteredEntries = filtered;
        this.displayEntries();
    }

    displayEntries() {
        const listContainer = document.getElementById('clipboardList');
        
        if (this.filteredEntries.length === 0) {
            const emptyMessage = this.searchTerm || this.currentFilter !== 'all' 
                ? 'No entries match your search or filter'
                : 'No clipboard history yet';
            
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"></div>
                    <h3>${emptyMessage}</h3>
                    <p>${this.searchTerm ? 'Try adjusting your search terms' : 'Your clipboard activity will appear here automatically'}</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = '';
        this.filteredEntries.forEach(entry => {
            const entryElement = this.createEntryElement(entry);
            listContainer.appendChild(entryElement);
        });
    }

    createEntryElement(entry) {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'clipboard-entry';
        entryDiv.dataset.entryId = entry.id;

        const timeAgo = formatRelativeTime(entry.timestamp);
        const formattedTime = formatDateTime(entry.timestamp);
        const contentIcon = AppUtils.getContentIcon(entry.content_type);
        const isLongContent = entry.content.length > 200;
        const truncatedContent = isLongContent ? entry.content.substring(0, 200) + '...' : entry.content;

        entryDiv.innerHTML = `
            <div class="entry-header">
                <div class="entry-meta">
                    <span class="content-type-icon"></span>
                    <span class="entry-time" title="${formattedTime}">${timeAgo}</span>
                    ${entry.source_app ? `<span class="entry-source">${entry.source_app}</span>` : ''}
                </div>
                <div class="entry-actions">
                    <button class="action-btn-mini" onclick="clipboardManager.copyEntry(${entry.id})">
                        Copy
                    </button>
                    <button class="action-btn-mini" onclick="clipboardManager.copyToSlot('A', ${entry.id})">
                        A
                    </button>
                    <button class="action-btn-mini" onclick="clipboardManager.copyToSlot('B', ${entry.id})">
                        B
                    </button>
                    <button class="action-btn-mini" onclick="clipboardManager.deleteEntry(${entry.id})">
                        Delete
                    </button>
                </div>
            </div>
            <div class="entry-content">
                <div class="content-preview ${entry.content_type} ${isLongContent ? 'content-truncated' : ''}" 
                     data-full-content="${this.escapeHtml(entry.content)}">
                    ${this.formatContent(truncatedContent, entry.content_type)}
                </div>
                ${isLongContent ? `
                    <button class="show-more-btn" onclick="clipboardManager.toggleContent(this)">
                        Show More
                    </button>
                ` : ''}
            </div>
        `;

        return entryDiv;
    }

    formatContent(content, contentType) {
        const escaped = this.escapeHtml(content);
        
        switch (contentType) {
            case 'url':
                return `<a href="${escaped}" target="_blank" rel="noopener noreferrer">${escaped}</a>`;
            case 'email':
                return `<a href="mailto:${escaped}">${escaped}</a>`;
            case 'code':
                return `<pre><code>${escaped}</code></pre>`;
            default:
                return escaped.replace(/\n/g, '<br>');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    toggleContent(button) {
        const entry = button.closest('.clipboard-entry');
        const preview = entry.querySelector('.content-preview');
        const fullContent = preview.dataset.fullContent;
        
        if (entry.classList.contains('entry-expanded')) {
            // Collapse
            entry.classList.remove('entry-expanded');
            preview.innerHTML = this.formatContent(fullContent.substring(0, 200) + '...', 
                this.getEntryById(parseInt(entry.dataset.entryId)).content_type);
            button.textContent = 'Show More';
        } else {
            // Expand
            entry.classList.add('entry-expanded');
            preview.innerHTML = this.formatContent(fullContent, 
                this.getEntryById(parseInt(entry.dataset.entryId)).content_type);
            button.textContent = 'Show Less';
        }
    }

    getEntryById(id) {
        return this.entries.find(entry => entry.id === id);
    }

    async copyEntry(entryId) {
        const entry = this.getEntryById(entryId);
        if (entry) {
            await copyToClipboard(entry.content);
        }
    }

    async deleteEntry(entryId) {
        if (confirm('Are you sure you want to delete this clipboard entry?')) {
            try {
                const response = await apiCall(`/api/clipboard/${entryId}`, {
                    method: 'DELETE'
                });
                
                if (response.success) {
                    showToast('Entry deleted successfully', 'success');
                    await this.loadClipboardHistory();
                } else {
                    showToast('Error deleting entry', 'error');
                }
            } catch (error) {
                console.error('Error deleting entry:', error);
                showToast('Error deleting entry', 'error');
            }
        }
    }

    updateStatistics() {
        const totalEntries = this.entries.length;
        document.getElementById('totalEntries').textContent = totalEntries;

        // Calculate today's activity
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEntries = this.entries.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            return entryDate >= today;
        });
        document.getElementById('todayActivity').textContent = todayEntries.length;

        // Calculate most active hour
        const hourCounts = {};
        this.entries.forEach(entry => {
            const hour = new Date(entry.timestamp).getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });

        const mostActiveHour = Object.keys(hourCounts).reduce((a, b) => 
            hourCounts[a] > hourCounts[b] ? a : b, '0');
        
        document.getElementById('mostActiveHour').textContent = 
            Object.keys(hourCounts).length > 0 ? `${mostActiveHour}:00` : '-';
    }

    updateFilterCounts() {
        const counts = {
            all: this.entries.length,
            text: 0,
            url: 0,
            code: 0,
            email: 0,
            number: 0
        };

        this.entries.forEach(entry => {
            if (counts.hasOwnProperty(entry.content_type)) {
                counts[entry.content_type]++;
            }
        });

        Object.keys(counts).forEach(type => {
            const countElement = document.getElementById(`count-${type}`);
            if (countElement) {
                countElement.textContent = counts[type];
            }
        });
    }

    updateViewStyle(viewType) {
        const listContainer = document.getElementById('clipboardList');
        if (viewType === 'grid') {
            listContainer.style.display = 'grid';
            listContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
        } else {
            listContainer.style.display = 'flex';
            listContainer.style.flexDirection = 'column';
            listContainer.style.gridTemplateColumns = 'none';
        }
    }

    // Clipboard Slots Management
    loadClipboardSlots() {
        const savedSlots = AppUtils.getLocalStorage('clipboard_slots', { A: null, B: null });
        this.clipboardSlots = savedSlots;
        this.updateSlotDisplay();
    }

    saveClipboardSlots() {
        AppUtils.setLocalStorage('clipboard_slots', this.clipboardSlots);
    }

    async copyToSlot(slot, entryId = null) {
        let content;
        
        if (entryId) {
            // Copy specific entry to slot
            const entry = this.getEntryById(entryId);
            content = entry ? entry.content : null;
        } else {
            // Copy current clipboard content to slot
            try {
                content = await navigator.clipboard.readText();
            } catch (error) {
                showToast('Unable to read clipboard', 'error');
                return;
            }
        }

        if (content) {
            this.clipboardSlots[slot] = content;
            this.saveClipboardSlots();
            this.updateSlotDisplay();
            showToast(`Content copied to Slot ${slot}`, 'success');
        }
    }

    async pasteSlot(slot) {
        const content = this.clipboardSlots[slot];
        if (content) {
            await copyToClipboard(content);
            showToast(`Pasted from Slot ${slot}`, 'success');
        } else {
            showToast(`Slot ${slot} is empty`, 'warning');
        }
    }

    clearSlot(slot) {
        this.clipboardSlots[slot] = null;
        this.saveClipboardSlots();
        this.updateSlotDisplay();
        showToast(`Slot ${slot} cleared`, 'success');
    }

    updateSlotDisplay() {
        ['A', 'B'].forEach(slot => {
            const slotElement = document.getElementById(`slot${slot}`);
            const contentElement = slotElement.querySelector('.slot-content');
            const content = this.clipboardSlots[slot];
            
            if (content) {
                contentElement.textContent = truncateText(content, 60);
                contentElement.classList.remove('slot-empty');
            } else {
                contentElement.textContent = 'Empty';
                contentElement.classList.add('slot-empty');
            }
        });
    }

    // Manual clipboard sync (for testing or manual refresh)
    async syncClipboard() {
        try {
            const clipboardContent = await navigator.clipboard.readText();
            if (clipboardContent.trim()) {
                // Check if this content is already in recent history
                const isRecent = this.entries.some(entry => 
                    entry.content === clipboardContent.trim() && 
                    new Date() - new Date(entry.timestamp) < 60000 // Within last minute
                );

                if (!isRecent) {
                    // Add to backend
                    const response = await apiCall('/api/clipboard', {
                        method: 'POST',
                        body: JSON.stringify({
                            content: clipboardContent.trim(),
                            source_app: 'Manual Sync'
                        })
                    });

                    if (response.success) {
                        showToast('Clipboard synced successfully', 'success');
                        await this.loadClipboardHistory();
                    }
                }
            }
        } catch (error) {
            console.error('Error syncing clipboard:', error);
            showToast('Error accessing clipboard', 'error');
        }
    }

    // Export clipboard history
    exportHistory() {
        const exportData = {
            entries: this.entries,
            exportDate: new Date().toISOString(),
            totalEntries: this.entries.length
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clipboard-history-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Clipboard history exported', 'success');
    }

    // Clear all clipboard history
    async clearAllHistory() {
        if (confirm('Are you sure you want to clear all clipboard history? This cannot be undone.')) {
            try {
                // Delete all entries (this would need a backend endpoint)
                const deletePromises = this.entries.map(entry => 
                    apiCall(`/api/clipboard/${entry.id}`, { method: 'DELETE' })
                );
                
                await Promise.all(deletePromises);
                showToast('Clipboard history cleared', 'success');
                await this.loadClipboardHistory();
            } catch (error) {
                console.error('Error clearing history:', error);
                showToast('Error clearing history', 'error');
            }
        }
    }

    // Get clipboard statistics for dashboard
    getStatistics() {
        const now = new Date();
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

        const recent24h = this.entries.filter(entry => new Date(entry.timestamp) >= last24Hours);
        const recentHour = this.entries.filter(entry => new Date(entry.timestamp) >= lastHour);

        const typeStats = {};
        this.entries.forEach(entry => {
            typeStats[entry.content_type] = (typeStats[entry.content_type] || 0) + 1;
        });

        return {
            total: this.entries.length,
            last24Hours: recent24h.length,
            lastHour: recentHour.length,
            typeBreakdown: typeStats,
            mostActiveType: Object.keys(typeStats).reduce((a, b) => 
                typeStats[a] > typeStats[b] ? a : b, 'text')
        };
    }
}

// Global functions for button clicks and external access
function toggleContent(button) {
    clipboardManager.toggleContent(button);
}

// Quick access functions for keyboard shortcuts and external use
window.copyToSlotA = () => clipboardManager.copyToSlot('A');
window.copyToSlotB = () => clipboardManager.copyToSlot('B');
window.pasteSlotA = () => clipboardManager.pasteSlot('A');
window.pasteSlotB = () => clipboardManager.pasteSlot('B');

// Initialize clipboard manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.clipboardManager = new ClipboardManager();
    
    // Add keyboard shortcut hints to the page
    const shortcutHints = document.createElement('div');
    shortcutHints.style.cssText = `
        position: fixed;
        bottom: 1rem;
        right: 1rem;
        background: var(--surface-color);
        border: 1px solid var(--border-color);
        border-radius: 0.5rem;
        padding: 0.75rem;
        font-size: 0.75rem;
        color: var(--text-secondary);
        z-index: 1000;
        max-width: 200px;
    `;
    shortcutHints.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 0.5rem;">Keyboard Shortcuts:</div>
        <div>F6: Copy to Slot A</div>
        <div>F7: Copy to Slot B</div>
        <div>F8: Paste Slot A</div>
        <div>F9: Paste Slot B</div>
    `;
    
    // Add toggle for shortcut hints
    let hintsVisible = AppUtils.getLocalStorage('show_shortcuts', true);
    if (hintsVisible) {
        document.body.appendChild(shortcutHints);
    }
    
    // Toggle shortcut hints on Ctrl+?
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === '/') {
            e.preventDefault();
            hintsVisible = !hintsVisible;
            AppUtils.setLocalStorage('show_shortcuts', hintsVisible);
            
            if (hintsVisible) {
                document.body.appendChild(shortcutHints);
            } else {
                if (shortcutHints.parentNode) {
                    shortcutHints.parentNode.removeChild(shortcutHints);
                }
            }
        }
    });
});

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClipboardManager;
}