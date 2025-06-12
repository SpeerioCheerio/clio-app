// Version Control functionality
class VersionControl {
    constructor() {
        this.currentProject = null;
        this.projects = [];
        this.versions = {};
        this.selectedVersions = []; // For comparison
        
        this.initializeEventListeners();
        this.loadProjects();
    }

    initializeEventListeners() {
        // Form submission
        document.getElementById('versionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleVersionSubmit();
        });

        // New project button
        document.getElementById('newProjectBtn').addEventListener('click', () => {
            this.toggleNewProjectInput();
        });

        // File upload drag and drop
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect(files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelect(e.target.files[0]);
            }
        });

        // Project selection
        document.getElementById('projectSelect').addEventListener('change', (e) => {
            if (e.target.value) {
                this.selectProject(e.target.value);
            }
        });

        // Auto-save content to localStorage as user types
        const contentArea = document.getElementById('contentArea');
        contentArea.addEventListener('input', AppUtils.debounce(() => {
            AppUtils.setLocalStorage('version_draft_content', contentArea.value);
        }, 1000));

        // Restore draft content on load
        const draftContent = AppUtils.getLocalStorage('version_draft_content');
        if (draftContent) {
            contentArea.value = draftContent;
        }
    }

    async loadProjects() {
        try {
            const response = await apiCall('/api/projects');
            if (response.success) {
                this.projects = response.projects;
                this.updateProjectSelector();
                this.updateProjectTabs();
                
                // Load first project by default
                if (this.projects.length > 0) {
                    this.selectProject(this.projects[0]);
                }
            }
        } catch (error) {
            console.error('Error loading projects:', error);
            showToast('Error loading projects', 'error');
        }
    }

    updateProjectSelector() {
        const select = document.getElementById('projectSelect');
        select.innerHTML = '<option value="">Select or create project...</option>';
        
        this.projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project;
            option.textContent = project;
            select.appendChild(option);
        });
    }

    updateProjectTabs() {
        const tabsContainer = document.getElementById('projectTabs');
        
        if (this.projects.length === 0) {
            tabsContainer.innerHTML = `
                <div class="empty-state">
                    <p>No projects yet</p>
                    <p class="text-muted">Create your first version to get started</p>
                </div>
            `;
            return;
        }

        tabsContainer.innerHTML = '';
        this.projects.forEach(project => {
            const tab = document.createElement('div');
            tab.className = `project-tab ${project === this.currentProject ? 'active' : ''}`;
            tab.textContent = project;
            tab.addEventListener('click', () => this.selectProject(project));
            tabsContainer.appendChild(tab);
        });
    }

    async selectProject(projectName) {
        this.currentProject = projectName;
        this.updateProjectTabs();
        
        // Update form project selector
        document.getElementById('projectSelect').value = projectName;
        
        await this.loadVersions(projectName);
    }

    async loadVersions(projectName) {
        try {
            const response = await apiCall(`/api/versions/${encodeURIComponent(projectName)}`);
            if (response.success) {
                this.versions[projectName] = response.versions;
                this.updateVersionList(response.versions);
            }
        } catch (error) {
            console.error('Error loading versions:', error);
            showToast('Error loading versions', 'error');
        }
    }

    updateVersionList(versions) {
        const versionList = document.getElementById('versionList');
        
        if (versions.length === 0) {
            versionList.innerHTML = `
                <div class="empty-state">
                    <p>No versions yet</p>
                    <p class="text-muted">Upload your first file to start tracking versions</p>
                </div>
            `;
            return;
        }

        versionList.innerHTML = '';
        versions.forEach((version, index) => {
            const versionItem = this.createVersionItem(version, index, versions);
            versionList.appendChild(versionItem);
        });
    }

    createVersionItem(version, index, versionsArray) {
        const item = document.createElement('div');
        item.className = 'version-item';
        
        const timeAgo = formatRelativeTime(version.timestamp);
        const formattedDate = formatDateTime(version.timestamp);
        
        // Fix version numbering: newest version should be highest number
        const versionNumber = versionsArray.length - index;
        
        item.innerHTML = `
            <div class="version-header">
                <div class="version-info">
                    <div class="version-title"><strong>Version ${versionNumber}</strong></div>
                    <div class="version-comment">${version.comment || 'No comment'}</div>
                    <div class="version-meta">
                        ${timeAgo} • ${formattedDate}
                    </div>
                </div>
                <div class="version-actions">
                    <button class="action-btn-small" onclick="versionControl.viewVersion(${version.id})">
                        View
                    </button>
                    <button class="action-btn-small" onclick="versionControl.downloadVersion(${version.id})">
                        Download
                    </button>
                    <button class="action-btn-small" onclick="versionControl.showDiffOptions(${version.id}, ${index}, '${versionsArray.length}')">
                        Diff
                    </button>
                </div>
            </div>
        `;
        
        return item;
    }

    showDiffOptions(versionId, index, totalVersions) {
        if (this.currentProject && this.versions[this.currentProject]) {
            const projectVersions = this.versions[this.currentProject];
            
            // Since versions are ordered newest first (index 0 = newest)
            // We want to compare with the NEXT version (index + 1)
            if (index + 1 < projectVersions.length) {
                const olderVersion = projectVersions[index + 1];
                this.compareVersions(olderVersion.id, versionId);
            } else {
                showToast('This is the oldest version, no older version to compare with', 'info');
            }
        }
    }

    toggleNewProjectInput() {
        const select = document.getElementById('projectSelect');
        const input = document.getElementById('newProjectInput');
        const btn = document.getElementById('newProjectBtn');
        
        if (input.classList.contains('hidden')) {
            input.classList.remove('hidden');
            input.focus();
            btn.textContent = 'Cancel';
            select.disabled = true;
        } else {
            input.classList.add('hidden');
            input.value = '';
            btn.textContent = '+ New';
            select.disabled = false;
        }
    }

    async handleFileSelect(file) {
        const contentArea = document.getElementById('contentArea');
        const filenameInput = document.getElementById('filenameInput');
        
        try {
            // Set filename
            filenameInput.value = file.name;
            
            // Check if file is binary (PDF, images, etc.)
            const isBinary = this.isBinaryFile(file);
            
            if (isBinary) {
                // For binary files, we'll store them as base64
                showToast('Binary file detected. Will be stored properly for download.', 'info');
                const base64Content = await this.readFileAsBase64(file);
                contentArea.value = `[BINARY_FILE:${file.name}]\n${base64Content}`;
            } else {
                // Read as text for text files
                const text = await this.readFileAsText(file);
                contentArea.value = text;
            }
            
            showToast('File loaded successfully', 'success');
        } catch (error) {
            console.error('Error reading file:', error);
            showToast('Error reading file', 'error');
        }
    }

    isBinaryFile(file) {
        const binaryExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif', '.zip', '.exe', '.dll'];
        const binaryMimeTypes = ['application/pdf', 'application/msword', 'image/', 'application/zip'];
        
        const fileName = file.name.toLowerCase();
        const fileType = file.type.toLowerCase();
        
        return binaryExtensions.some(ext => fileName.endsWith(ext)) || 
               binaryMimeTypes.some(type => fileType.startsWith(type));
    }

    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result.split(',')[1]); // Remove data:... prefix
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    async handleVersionSubmit() {
        const projectSelect = document.getElementById('projectSelect');
        const newProjectInput = document.getElementById('newProjectInput');
        const contentArea = document.getElementById('contentArea');
        const commentInput = document.getElementById('commentInput');
        const fileInput = document.getElementById('fileInput');
        const submitBtn = document.getElementById('submitBtn');
        
        // Prevent double submission
        if (submitBtn.disabled) {
            return;
        }
        
        // Determine project name
        let projectName = projectSelect.value;
        if (!projectName && !newProjectInput.classList.contains('hidden')) {
            projectName = newProjectInput.value.trim();
        }
        
        if (!projectName) {
            showToast('Please select or create a project', 'error');
            return;
        }
        
        // Get content
        const content = contentArea.value.trim();
        if (!content) {
            showToast('Please provide content or upload a file', 'error');
            return;
        }
        
        // Get optional comment
        const comment = commentInput.value.trim() || `Version ${new Date().toLocaleString()}`;
        
        // Disable submit button to prevent double submission
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
        
        // Prepare form data
        const formData = new FormData();
        formData.append('project_name', projectName);
        formData.append('content', content);
        formData.append('comment', comment);
        
        // If a file was uploaded, use its name
        if (fileInput.files.length > 0) {
            formData.append('filename', fileInput.files[0].name);
        } else {
            // Generate a default filename based on timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            formData.append('filename', `version_${timestamp}.txt`);
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/upload`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('Version saved successfully!', 'success');
                
                // Clear form
                contentArea.value = '';
                commentInput.value = '';
                fileInput.value = '';
                AppUtils.setLocalStorage('version_draft_content', '');
                
                // Refresh data
                await this.loadProjects();
                if (this.currentProject === projectName) {
                    await this.loadVersions(projectName);
                } else {
                    this.selectProject(projectName);
                }
                
                // Hide new project input if it was used
                if (!newProjectInput.classList.contains('hidden')) {
                    this.toggleNewProjectInput();
                }
            } else {
                showToast(data.error || 'Error saving version', 'error');
            }
        } catch (error) {
            console.error('Error submitting version:', error);
            showToast('Error saving version', 'error');
        } finally {
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Version';
        }
    }

    async viewVersion(versionId) {
        try {
            const response = await apiCall(`/api/version/${versionId}/content`);
            if (response.success) {
                this.openViewModal(response.content, response.filename);
            }
        } catch (error) {
            console.error('Error viewing version:', error);
            showToast('Error loading version content', 'error');
        }
    }

    openViewModal(content, filename) {
        // Create a simple view modal
        const modal = document.createElement('div');
        modal.className = 'modal open';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${filename}</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <pre style="white-space: pre-wrap; font-family: Monaco, monospace; max-height: 500px; overflow-y: auto;">${this.escapeHtml(content)}</pre>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    async downloadVersion(versionId) {
        try {
            const response = await apiCall(`/api/version/${versionId}/content`);
            if (response.success) {
                this.downloadFile(response.content, response.filename);
            }
        } catch (error) {
            console.error('Error downloading version:', error);
            showToast('Error downloading version', 'error');
        }
    }

    downloadFile(content, filename) {
        // Check if content is binary (base64 encoded)
        if (content.startsWith('[BINARY_FILE:')) {
            try {
                // Extract base64 content - everything after the first newline
                const newlineIndex = content.indexOf('\n');
                if (newlineIndex === -1) {
                    throw new Error('Invalid binary file format');
                }
                
                const base64Content = content.substring(newlineIndex + 1).trim();
                
                // Decode base64 to binary
                const binaryString = atob(base64Content);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                // Determine MIME type based on file extension
                let mimeType = 'application/octet-stream';
                const ext = filename.toLowerCase().split('.').pop();
                const mimeTypes = {
                    'pdf': 'application/pdf',
                    'jpg': 'image/jpeg',
                    'jpeg': 'image/jpeg',
                    'png': 'image/png',
                    'gif': 'image/gif',
                    'doc': 'application/msword',
                    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'zip': 'application/zip',
                    'txt': 'text/plain'
                };
                if (mimeTypes[ext]) {
                    mimeType = mimeTypes[ext];
                }
                
                const blob = new Blob([bytes], { type: mimeType });
                
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                showToast('File downloaded successfully', 'success');
            } catch (error) {
                console.error('Error processing binary file:', error);
                showToast(`Error downloading file: ${error.message}`, 'error');
                return;
            }
        } else {
            // Regular text file
            const blob = new Blob([content], { type: 'text/plain; charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('File downloaded successfully', 'success');
        }
    }

    async compareVersions(oldVersionId, newVersionId) {
        try {
            const [oldResponse, newResponse] = await Promise.all([
                apiCall(`/api/version/${oldVersionId}/content`),
                apiCall(`/api/version/${newVersionId}/content`)
            ]);
            
            if (oldResponse.success && newResponse.success) {
                this.openDiffModal(
                    oldResponse.content, 
                    newResponse.content,
                    oldResponse.filename,
                    newResponse.filename
                );
            }
        } catch (error) {
            console.error('Error loading versions for comparison:', error);
            showToast('Error loading versions for comparison', 'error');
        }
    }

    openDiffModal(oldContent, newContent, oldFilename, newFilename) {
        const modal = document.getElementById('diffModal');
        const title = document.getElementById('diffTitle');
        // We'll use a single container for the new diff viewer
        let diffViewerContainer = modal.querySelector('.advanced-diff-container');
        if (!diffViewerContainer) {
            diffViewerContainer = document.createElement('div');
            diffViewerContainer.className = 'advanced-diff-container';
            // Remove old diff panels if present
            const oldDiffContainer = modal.querySelector('.diff-container');
            if (oldDiffContainer) oldDiffContainer.remove();
            modal.querySelector('.modal-body').appendChild(diffViewerContainer);
        }
        diffViewerContainer.innerHTML = '';

        title.textContent = `Compare: ${oldFilename} vs ${newFilename}`;

        // Use AdvancedDiff to render the diff viewer with AI analysis
        if (typeof AdvancedDiff !== 'undefined') {
            // Inject styles if not already present
            if (!document.getElementById('advanced-diff-styles')) {
                const style = document.createElement('style');
                style.id = 'advanced-diff-styles';
                style.textContent = typeof advancedDiffStyles !== 'undefined' ? advancedDiffStyles : '';
                document.head.appendChild(style);
            }
            const advDiff = new AdvancedDiff();
            advDiff.createDiffViewer(oldContent, newContent, diffViewerContainer);
        } else {
            diffViewerContainer.innerHTML = '<div class="text-muted">Advanced diff viewer not available.</div>';
        }

        modal.classList.add('open');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global functions for button clicks
function closeDiffModal() {
    const modal = document.getElementById('diffModal');
    modal.classList.remove('open');
}

// Initialize version control when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize version control
    window.versionControl = new VersionControl();
    
    // Handle form submission with loading state
    const form = document.getElementById('versionForm');
    const submitBtn = document.getElementById('submitBtn');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        AppUtils.handleFormSubmit(form, () => versionControl.handleVersionSubmit());
    });
});

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VersionControl;
}