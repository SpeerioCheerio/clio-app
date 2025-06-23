// Advanced Diff Viewer for Version Control
class AdvancedDiff {
    constructor() {
        this.diffTypes = {
            EQUAL: 'equal',
            DELETE: 'delete', 
            INSERT: 'insert',
            REPLACE: 'replace'
        };
    }

    // Main diff function - compares two strings and returns structured diff
    generateDiff(oldText, newText) {
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');
        
        return this.computeLineDiff(oldLines, newLines);
    }

    // Line-by-line diff using Myers algorithm (simplified)
    computeLineDiff(oldLines, newLines) {
        const diffs = [];
        let oldIndex = 0;
        let newIndex = 0;
        
        // Simple diff algorithm - can be enhanced with Myers algorithm
        while (oldIndex < oldLines.length || newIndex < newLines.length) {
            const oldLine = oldLines[oldIndex];
            const newLine = newLines[newIndex];
            
            if (oldIndex >= oldLines.length) {
                // Remaining lines are additions
                diffs.push({
                    type: this.diffTypes.INSERT,
                    oldLineNumber: null,
                    newLineNumber: newIndex + 1,
                    content: newLine
                });
                newIndex++;
            } else if (newIndex >= newLines.length) {
                // Remaining lines are deletions
                diffs.push({
                    type: this.diffTypes.DELETE,
                    oldLineNumber: oldIndex + 1,
                    newLineNumber: null,
                    content: oldLine
                });
                oldIndex++;
            } else if (oldLine === newLine) {
                // Lines are equal
                diffs.push({
                    type: this.diffTypes.EQUAL,
                    oldLineNumber: oldIndex + 1,
                    newLineNumber: newIndex + 1,
                    content: oldLine
                });
                oldIndex++;
                newIndex++;
            } else {
                // Lines are different - look ahead to find best match
                const nextMatch = this.findNextMatch(oldLines, newLines, oldIndex, newIndex);
                
                if (nextMatch.oldSkip === 0 && nextMatch.newSkip === 0) {
                    // Direct replacement
                    diffs.push({
                        type: this.diffTypes.REPLACE,
                        oldLineNumber: oldIndex + 1,
                        newLineNumber: newIndex + 1,
                        oldContent: oldLine,
                        newContent: newLine
                    });
                    oldIndex++;
                    newIndex++;
                } else {
                    // Handle insertions and deletions
                    for (let i = 0; i < nextMatch.oldSkip; i++) {
                        diffs.push({
                            type: this.diffTypes.DELETE,
                            oldLineNumber: oldIndex + 1,
                            newLineNumber: null,
                            content: oldLines[oldIndex]
                        });
                        oldIndex++;
                    }
                    
                    for (let i = 0; i < nextMatch.newSkip; i++) {
                        diffs.push({
                            type: this.diffTypes.INSERT,
                            oldLineNumber: null,
                            newLineNumber: newIndex + 1,
                            content: newLines[newIndex]
                        });
                        newIndex++;
                    }
                }
            }
        }
        
        return diffs;
    }

    // Find the next matching line
    findNextMatch(oldLines, newLines, oldStart, newStart) {
        const maxLookAhead = 10; // Limit search to prevent performance issues
        
        for (let oldSkip = 0; oldSkip <= maxLookAhead && oldStart + oldSkip < oldLines.length; oldSkip++) {
            for (let newSkip = 0; newSkip <= maxLookAhead && newStart + newSkip < newLines.length; newSkip++) {
                if (oldLines[oldStart + oldSkip] === newLines[newStart + newSkip]) {
                    return { oldSkip, newSkip };
                }
            }
        }
        
        return { oldSkip: 0, newSkip: 0 }; // No match found, treat as replacement
    }

    // Generate HTML for side-by-side diff view
    generateSideBySideHtml(diffs) {
        let leftHtml = '';
        let rightHtml = '';
        
        diffs.forEach(diff => {
            switch (diff.type) {
                case this.diffTypes.EQUAL:
                    leftHtml += this.createLineHtml(diff.oldLineNumber, diff.content, 'equal');
                    rightHtml += this.createLineHtml(diff.newLineNumber, diff.content, 'equal');
                    break;
                    
                case this.diffTypes.DELETE:
                    leftHtml += this.createLineHtml(diff.oldLineNumber, diff.content, 'delete');
                    rightHtml += this.createLineHtml(null, '', 'empty');
                    break;
                    
                case this.diffTypes.INSERT:
                    leftHtml += this.createLineHtml(null, '', 'empty');
                    rightHtml += this.createLineHtml(diff.newLineNumber, diff.content, 'insert');
                    break;
                    
                case this.diffTypes.REPLACE:
                    leftHtml += this.createLineHtml(diff.oldLineNumber, diff.oldContent, 'delete');
                    rightHtml += this.createLineHtml(diff.newLineNumber, diff.newContent, 'insert');
                    break;
            }
        });
        
        return { left: leftHtml, right: rightHtml };
    }

    // Generate HTML for unified diff view
    generateUnifiedHtml(diffs) {
        let html = '';
        let currentChunk = [];
        let chunkOldStart = null;
        let chunkNewStart = null;
        
        diffs.forEach((diff, index) => {
            if (diff.type === this.diffTypes.EQUAL) {
                if (currentChunk.length > 0) {
                    // Close current chunk
                    html += this.createChunkHtml(currentChunk, chunkOldStart, chunkNewStart);
                    currentChunk = [];
                }
                
                // Add context lines
                html += this.createLineHtml(diff.oldLineNumber, diff.content, 'equal', true);
            } else {
                if (currentChunk.length === 0) {
                    chunkOldStart = diff.oldLineNumber;
                    chunkNewStart = diff.newLineNumber;
                }
                currentChunk.push(diff);
            }
        });
        
        // Close final chunk if exists
        if (currentChunk.length > 0) {
            html += this.createChunkHtml(currentChunk, chunkOldStart, chunkNewStart);
        }
        
        return html;
    }

    // Create HTML for a single line
    createLineHtml(lineNumber, content, type, unified = false) {
        const lineNumHtml = lineNumber ? `<span class="line-number">${lineNumber}</span>` : '<span class="line-number"></span>';
        const prefix = unified ? this.getUnifiedPrefix(type) : '';
        const escapedContent = this.escapeHtml(content);
        
        return `
            <div class="diff-line diff-${type}">
                ${lineNumHtml}
                <span class="line-content">${prefix}${escapedContent}</span>
            </div>
        `;
    }

    // Create HTML for a chunk header in unified view
    createChunkHtml(chunk, oldStart, newStart) {
        const oldCount = chunk.filter(d => d.type === this.diffTypes.DELETE || d.type === this.diffTypes.REPLACE).length;
        const newCount = chunk.filter(d => d.type === this.diffTypes.INSERT || d.type === this.diffTypes.REPLACE).length;
        
        let html = `<div class="chunk-header">@@ -${oldStart},${oldCount} +${newStart},${newCount} @@</div>`;
        
        chunk.forEach(diff => {
            switch (diff.type) {
                case this.diffTypes.DELETE:
                    html += this.createLineHtml(diff.oldLineNumber, diff.content, 'delete', true);
                    break;
                case this.diffTypes.INSERT:
                    html += this.createLineHtml(diff.newLineNumber, diff.content, 'insert', true);
                    break;
                case this.diffTypes.REPLACE:
                    html += this.createLineHtml(diff.oldLineNumber, diff.oldContent, 'delete', true);
                    html += this.createLineHtml(diff.newLineNumber, diff.newContent, 'insert', true);
                    break;
            }
        });
        
        return html;
    }

    // Get prefix for unified diff format
    getUnifiedPrefix(type) {
        switch (type) {
            case this.diffTypes.DELETE:
                return '-';
            case this.diffTypes.INSERT:
                return '+';
            default:
                return ' ';
        }
    }

    // Word-level diff for more granular comparison
    generateWordDiff(oldText, newText) {
        const oldWords = this.splitIntoWords(oldText);
        const newWords = this.splitIntoWords(newText);
        
        // Simple word-level comparison
        const diffs = [];
        let oldIndex = 0;
        let newIndex = 0;
        
        while (oldIndex < oldWords.length || newIndex < newWords.length) {
            const oldWord = oldWords[oldIndex];
            const newWord = newWords[newIndex];
            
            if (oldIndex >= oldWords.length) {
                diffs.push({ type: this.diffTypes.INSERT, content: newWord });
                newIndex++;
            } else if (newIndex >= newWords.length) {
                diffs.push({ type: this.diffTypes.DELETE, content: oldWord });
                oldIndex++;
            } else if (oldWord === newWord) {
                diffs.push({ type: this.diffTypes.EQUAL, content: oldWord });
                oldIndex++;
                newIndex++;
            } else {
                diffs.push({ type: this.diffTypes.DELETE, content: oldWord });
                diffs.push({ type: this.diffTypes.INSERT, content: newWord });
                oldIndex++;
                newIndex++;
            }
        }
        
        return this.mergeWordDiffs(diffs);
    }

    // Split text into words while preserving whitespace
    splitIntoWords(text) {
        return text.split(/(\s+)/);
    }

    // Merge consecutive word diffs for better readability
    mergeWordDiffs(diffs) {
        const merged = [];
        let current = null;
        
        diffs.forEach(diff => {
            if (current && current.type === diff.type) {
                current.content += diff.content;
            } else {
                if (current) merged.push(current);
                current = { ...diff };
            }
        });
        
        if (current) merged.push(current);
        return merged;
    }

    // Generate statistics about the diff
    generateStats(diffs) {
        const stats = {
            linesAdded: 0,
            linesDeleted: 0,
            linesModified: 0,
            linesEqual: 0,
            totalChanges: 0
        };
        
        diffs.forEach(diff => {
            switch (diff.type) {
                case this.diffTypes.INSERT:
                    stats.linesAdded++;
                    stats.totalChanges++;
                    break;
                case this.diffTypes.DELETE:
                    stats.linesDeleted++;
                    stats.totalChanges++;
                    break;
                case this.diffTypes.REPLACE:
                    stats.linesModified++;
                    stats.totalChanges++;
                    break;
                case this.diffTypes.EQUAL:
                    stats.linesEqual++;
                    break;
            }
        });
        
        return stats;
    }

    // Escape HTML entities
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Create enhanced diff viewer with controls
    createDiffViewer(oldText, newText, container) {
        const diffs = this.generateDiff(oldText, newText);
        const stats = this.generateStats(diffs);
        
        // Create viewer HTML
        container.innerHTML = `
            <div class="diff-viewer">
                <div class="diff-controls">
                    <div class="diff-stats">
                        <span class="stat-item stat-added">+${stats.linesAdded}</span>
                        <span class="stat-item stat-deleted">-${stats.linesDeleted}</span>
                        <span class="stat-item stat-modified">~${stats.linesModified}</span>
                    </div>
                    <div class="diff-options">
                        <label>
                            <input type="radio" name="diff-view" value="side-by-side" checked>
                            Side by Side
                        </label>
                        <label>
                            <input type="radio" name="diff-view" value="unified">
                            Unified
                        </label>
                        <label>
                            <input type="checkbox" id="word-diff">
                            Word Diff
                        </label>
                    </div>
                </div>
                <div class="diff-content" id="diff-content">
                    ${this.renderSideBySide(diffs)}
                </div>
                <div class="diff-analysis" id="diff-analysis">
                    <div class="analysis-loading">Analyzing changes...</div>
                </div>
            </div>
        `;
        
        // Add event listeners for controls
        this.attachControlListeners(container, oldText, newText, diffs);
        
        // Perform AI analysis
        this.performAIAnalysis(oldText, newText, container.querySelector('#diff-analysis'));
    }

    // Render side-by-side view
    renderSideBySide(diffs) {
        const { left, right } = this.generateSideBySideHtml(diffs);
        return `
            <div class="diff-side-by-side">
                <div class="diff-panel diff-old">
                    <div class="diff-panel-header">Old Version</div>
                    <div class="diff-panel-content">${left}</div>
                </div>
                <div class="diff-panel diff-new">
                    <div class="diff-panel-header">New Version</div>
                    <div class="diff-panel-content">${right}</div>
                </div>
            </div>
        `;
    }

    // Render unified view
    renderUnified(diffs) {
        const unifiedHtml = this.generateUnifiedHtml(diffs);
        return `
            <div class="diff-unified">
                <div class="diff-panel-content">${unifiedHtml}</div>
            </div>
        `;
    }

    // Attach event listeners to diff controls
    attachControlListeners(container, oldText, newText, diffs) {
        const contentDiv = container.querySelector('#diff-content');
        const viewRadios = container.querySelectorAll('input[name="diff-view"]');
        const wordDiffCheck = container.querySelector('#word-diff');
        
        viewRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'side-by-side') {
                    contentDiv.innerHTML = this.renderSideBySide(diffs);
                } else {
                    contentDiv.innerHTML = this.renderUnified(diffs);
                }
            });
        });
        
        wordDiffCheck.addEventListener('change', (e) => {
            // Toggle word-level highlighting
            const lines = contentDiv.querySelectorAll('.diff-line');
            lines.forEach(line => {
                line.classList.toggle('word-diff', e.target.checked);
            });
        });
    }

    async performAIAnalysis(oldText, newText, analysisContainer) {
        try {
            // Check if the API endpoint exists by trying to fetch it
            const response = await fetch(`${API_BASE_URL}/api/analyze-diff`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    old_content: oldText,
                    new_content: newText
                })
            });
            
            if (!response.ok) {
                throw new Error(`API endpoint not available (${response.status})`);
            }
            
            const data = await response.json();
            
            if (data.success && data.analysis) {
                const { summary, insights } = data.analysis;
                
                analysisContainer.innerHTML = `
                    <div class="analysis-section">
                        <h3>AI Analysis</h3>
                        ${summary ? `
                            <div class="analysis-summary">
                                <h4>Summary</h4>
                                <p>${summary}</p>
                            </div>
                        ` : ''}
                        ${insights && insights.length > 0 ? `
                            <div class="analysis-insights">
                                <h4>Key Insights</h4>
                                <ul>
                                    ${insights.map(insight => `<li>${insight}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                `;
            } else {
                analysisContainer.innerHTML = `
                    <div class="analysis-section">
                        <p class="text-muted">AI analysis not available</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error performing AI analysis:', error);
            analysisContainer.innerHTML = `
                <div class="analysis-section">
                    <p class="text-muted">AI analysis not available (${error.message})</p>
                </div>
            `;
        }
    }
}

// CSS styles for the advanced diff viewer
const advancedDiffStyles = `
    .diff-viewer {
        border: 1px solid var(--border-color);
        border-radius: 0.5rem;
        overflow: hidden;
    }
    
    .diff-controls {
        background: var(--background-color);
        padding: 1rem;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .diff-stats {
        display: flex;
        gap: 1rem;
    }
    
    .stat-item {
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.875rem;
        font-weight: 600;
    }
    
    .stat-added {
        background: #dcfce7;
        color: #166534;
    }
    
    .stat-deleted {
        background: #fee2e2;
        color: #991b1b;
    }
    
    .stat-modified {
        background: #fef3c7;
        color: #92400e;
    }
    
    .diff-options {
        display: flex;
        gap: 1rem;
        font-size: 0.875rem;
    }
    
    .diff-side-by-side {
        display: grid;
        grid-template-columns: 1fr 1fr;
        height: 500px;
    }
    
    .diff-panel {
        overflow: hidden;
        border-right: 1px solid var(--border-color);
    }
    
    .diff-panel:last-child {
        border-right: none;
    }
    
    .diff-panel-header {
        background: var(--background-color);
        padding: 0.5rem 1rem;
        font-weight: 600;
        border-bottom: 1px solid var(--border-color);
    }
    
    .diff-panel-content {
        height: calc(100% - 45px);
        overflow-y: auto;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 0.875rem;
        line-height: 1.4;
    }
    
    .diff-line {
        display: flex;
        min-height: 20px;
        padding: 0 0.5rem;
    }
    
    .diff-line.diff-equal {
        background: transparent;
    }
    
    .diff-line.diff-delete {
        background: #fee2e2;
        border-left: 3px solid #ef4444;
    }
    
    .diff-line.diff-insert {
        background: #dcfce7;
        border-left: 3px solid #22c55e;
    }
    
    .diff-line.diff-empty {
        background: #f8fafc;
        opacity: 0.5;
    }
    
    .line-number {
        display: inline-block;
        width: 50px;
        color: #6b7280;
        text-align: right;
        margin-right: 1rem;
        user-select: none;
    }
    
    .line-content {
        flex: 1;
        white-space: pre-wrap;
    }
    
    .chunk-header {
        background: #f3f4f6;
        color: #374151;
        padding: 0.25rem 0.5rem;
        font-weight: 600;
        border-top: 1px solid var(--border-color);
        border-bottom: 1px solid var(--border-color);
    }
    
    .diff-unified .diff-panel-content {
        height: 500px;
    }
`;

// Initialize advanced diff styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = advancedDiffStyles;
    document.head.appendChild(styleSheet);
}

// Export the AdvancedDiff class
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdvancedDiff;
} else if (typeof window !== 'undefined') {
    window.AdvancedDiff = AdvancedDiff;
}