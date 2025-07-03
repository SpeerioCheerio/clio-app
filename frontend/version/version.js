// Version Control functionality
class VersionControl {
    constructor() {
        this.currentProject = null;
        this.groupedProjects = [];
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

        // New group button
        document.getElementById('newGroupBtn').addEventListener('click', () => {
            this.toggleNewGroupInput();
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

        // Hide context menu on click outside
        document.addEventListener('click', () => {
            const contextMenu = document.getElementById('projectContextMenu');
            if (contextMenu) {
                contextMenu.style.display = 'none';
            }
        });

        // Help button functionality
        document.getElementById('helpBtn').addEventListener('click', showHelpModal);
    }

    async loadProjects() {
        try {
            const response = await apiCall('/api/projects');
            if (response.success) {
                this.groupedProjects = response.projects;
                this.loadGroupColors(); // Load saved group colors
                this.renderProjectGroups();
                this.updateProjectSelector();
                this.updateGroupSelector();
                
                // Load first project of first group by default, only if nothing is selected
                if (!this.currentProject && this.groupedProjects.length > 0 && this.groupedProjects[0].projects.length > 0) {
                    this.selectProject(this.groupedProjects[0].projects[0]);
                }
            }
        } catch (error) {
            console.error('Error loading projects:', error);
            showToast('Error loading projects', 'error');
            // Fallback: use demo data on error
            this.groupedProjects = [
                { group_name: "Demo Group", projects: ["Demo Project 1", "Demo Project 2"] },
                { group_name: "Standalone", projects: ["Demo Project 3"] }
            ];
            this.loadGroupColors(); // Load saved group colors for demo data too
            this.renderProjectGroups();
            this.updateProjectSelector();
            this.updateGroupSelector();
            if (this.groupedProjects.length > 0 && this.groupedProjects[0].projects.length > 0) {
                this.selectProject(this.groupedProjects[0].projects[0]);
            }
        }
    }

    updateProjectSelector() {
        const select = document.getElementById('projectSelect');
        select.innerHTML = '<option value="">Select or create project...</option>';
        
        if (this.groupedProjects) {
            // Flatten all projects from all groups into a single list
            const allProjects = [];
            this.groupedProjects.forEach(group => {
                if (group && group.projects) {
                    allProjects.push(...group.projects);
                }
            });
            
            // Sort projects alphabetically and add them directly to the select
            allProjects.sort().forEach(project => {
                const option = document.createElement('option');
                option.value = project;
                option.textContent = project;
                select.appendChild(option);
            });
        }
    }

    updateGroupSelector() {
        const select = document.getElementById('groupSelect');
        select.innerHTML = '<option value="">Select or create group...</option>';
        
        if (this.groupedProjects) {
            // Get unique group names
            const uniqueGroups = [...new Set(this.groupedProjects.map(group => group.group_name))];
            
            // Sort groups alphabetically and add them to the select
            uniqueGroups.sort().forEach(groupName => {
                const option = document.createElement('option');
                option.value = groupName;
                option.textContent = groupName;
                select.appendChild(option);
            });
        }
    }

    renderProjectGroups() {
        const container = document.getElementById('projectGroupsList');
        if (!container) {
            console.error('Project groups container not found');
            return;
        }
        // Track if this is the first render after page load
        if (typeof this._groupOrderInitialized === 'undefined') {
            this._groupOrderInitialized = false;
        }
        if (!this._groupOrderInitialized) {
            const lastOpenedGroup = localStorage.getItem('lastOpenedGroup');
            let groups = [...(this.groupedProjects || [])];
            if (lastOpenedGroup) {
                const idx = groups.findIndex(g => g.group_name === lastOpenedGroup);
                if (idx > -1) {
                    const [grp] = groups.splice(idx, 1);
                    groups.unshift(grp);
                }
            }
            this._groupOrder = groups.map(g => g.group_name);
            this._groupOrderInitialized = true;
            const lastOpenedProject = localStorage.getItem('lastOpenedProject');
            if (groups.length > 0) {
                const openGroup = groups[0];
                if (lastOpenedProject && openGroup.projects.includes(lastOpenedProject)) {
                    this.currentProject = lastOpenedProject;
                } else {
                    this.currentProject = openGroup.projects[0];
                }
                setTimeout(() => this.loadVersions(this.currentProject), 0);
            }
        }
        const groups = this._groupOrder
            ? this._groupOrder.map(name => (this.groupedProjects || []).find(g => g.group_name === name)).filter(Boolean)
            : [...(this.groupedProjects || [])];
        if (typeof this._openGroup === 'undefined') {
            this._openGroup = groups.length > 0 ? groups[0].group_name : null;
        }
        container.innerHTML = '';
        if (!groups || groups.length === 0) {
            container.innerHTML = `<div class="empty-state"><p>No projects yet</p></div>`;
            return;
        }

        // Separate groups into actual groups and standalone projects
        const actualGroups = groups.filter(group => 
            group.group_name && 
            group.group_name.toLowerCase() !== 'uncategorized' && 
            group.group_name.trim() !== ''
        );
        
        const standaloneProjects = [];
        groups.forEach(group => {
            if (!group.group_name || 
                group.group_name.toLowerCase() === 'uncategorized' || 
                group.group_name.trim() === '') {
                if (group.projects) {
                    standaloneProjects.push(...group.projects);
                }
            }
        });

        // Render actual groups first
        actualGroups.forEach((group) => {
            if (!group || !group.projects) return;
            // Default color if not set
            if (!group.color) group.color = '#fff';
            const groupEl = document.createElement('div');
            groupEl.className = 'project-group';
            const isOpen = group.group_name === this._openGroup;
            groupEl.innerHTML = `
                <div class="project-group-header-bubble${isOpen ? ' open' : ''}" style="background:${group.color};">
                    <span class="project-group-name">${this.escapeHtml(group.group_name)}</span>
                    <span class="group-ellipsis" title="Group options">&#8942;</span>
                </div>
                <div class="project-group-content${isOpen ? '' : ' collapsed'}">
                    <div class="project-tabs"></div>
                </div>
            `;
            const groupHeader = groupEl.querySelector('.project-group-header-bubble');
            const groupContent = groupEl.querySelector('.project-group-content');
            const tabsContainer = groupEl.querySelector('.project-tabs');
            // Ellipsis menu
            const ellipsis = groupEl.querySelector('.group-ellipsis');
            ellipsis.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showGroupBubbleMenu(e, group);
            });
            // Toggle expand/collapse
            groupHeader.addEventListener('click', (e) => {
                if (e.target.classList.contains('group-ellipsis')) return;
                if (isOpen) {
                    this._openGroup = null;
                } else {
                    this._openGroup = group.group_name;
                }
                localStorage.setItem('lastOpenedGroup', this._openGroup || '');
                this.renderProjectGroups();
            });
            group.projects.forEach(project => {
                const tab = document.createElement('div');
                tab.className = `project-tab ${project === this.currentProject ? 'active' : ''}`;
                tab.textContent = project;
                tab.addEventListener('click', () => this.selectProject(project));
                tab.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showProjectContextMenu(e, project);
                });
                tabsContainer.appendChild(tab);
            });
            container.appendChild(groupEl);
        });

        // Render standalone projects at the bottom (like ChatGPT's individual chats)
        if (standaloneProjects.length > 0) {
            standaloneProjects.forEach(project => {
                const standaloneEl = document.createElement('div');
                standaloneEl.className = `project-tab standalone-project ${project === this.currentProject ? 'active' : ''}`;
                standaloneEl.textContent = project;
                standaloneEl.style.marginBottom = '0.5rem';
                standaloneEl.addEventListener('click', () => this.selectProject(project));
                standaloneEl.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showProjectContextMenu(e, project);
                });
                container.appendChild(standaloneEl);
            });
        }
    }

    async selectProject(projectName) {
        this.currentProject = projectName;
        localStorage.setItem('lastOpenedProject', projectName);
        this.renderProjectGroups();
        await this.loadVersions(projectName);
    }

    async loadVersions(projectName) {
        const versionContainer = document.getElementById('versionDisplayContainer');
        if (!versionContainer) {
            console.error('Version display container not found');
            return;
        }
        
        versionContainer.innerHTML = `<div class="loading-state">Loading versions for ${projectName}...</div>`;

        try {
            const response = await apiCall(`/api/versions/${encodeURIComponent(projectName)}`);
            if (response.success) {
                const versions = response.versions;
                
                // Store versions in this.versions for later use (like diff comparisons)
                this.versions[projectName] = versions;
                
                let versionsHtml = `
                    <h3 class="panel-subheader">Versions for: ${this.escapeHtml(projectName)}</h3>
                    <div class="version-list">
                `;

                if (versions.length === 0) {
                    versionsHtml += `<div class="empty-state"><p>No versions yet</p></div>`;
                } else {
                    versions.forEach((version, index) => {
                        const versionItem = this.createVersionItem(version, index, versions);
                        versionsHtml += versionItem.outerHTML;
                    });
                }

                versionsHtml += `</div>`;
                versionContainer.innerHTML = versionsHtml;
            } else {
                versionContainer.innerHTML = `<div class="error-state">Error loading versions.</div>`;
            }
        } catch (error) {
            console.error('Error loading versions:', error);
            versionContainer.innerHTML = `<div class="error-state">Error loading versions.</div>`;
        }
    }

    createVersionItem(version, index, versionsArray) {
        const item = document.createElement('div');
        item.className = 'version-item';
        
        const formattedDate = formatDateTime(version.timestamp);
        // Fix version numbering: newest version should be highest number
        const versionNumber = versionsArray.length - index;
        
        item.innerHTML = `
            <div class="version-header">
                <div class="version-info">
                    <div class="version-title"><strong>Version ${versionNumber}</strong></div>
                    <div class="version-meta">${formattedDate}</div>
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

    toggleNewGroupInput() {
        const select = document.getElementById('groupSelect');
        const input = document.getElementById('newGroupInput');
        const btn = document.getElementById('newGroupBtn');
        
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
        
        try {
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

    async generateAutoProjectName() {
        try {
            // Get existing projects to determine the next number
            const response = await apiCall('/api/projects');
            let existingProjects = [];
            
            if (response.success && response.projects) {
                // Flatten all projects from all groups
                response.projects.forEach(group => {
                    if (group.projects) {
                        existingProjects = existingProjects.concat(group.projects);
                    }
                });
            }
            
            // Find the highest "Project n" number
            let maxProjectNumber = 0;
            const projectNumberRegex = /^Project (\d+)$/;
            
            existingProjects.forEach(projectName => {
                const match = projectName.match(projectNumberRegex);
                if (match) {
                    const number = parseInt(match[1], 10);
                    if (number > maxProjectNumber) {
                        maxProjectNumber = number;
                    }
                }
            });
            
            // Return the next available project number
            return `Project ${maxProjectNumber + 1}`;
            
        } catch (error) {
            console.error('Error generating auto project name:', error);
            // Fallback to timestamp-based name if API fails
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
            return `Project ${timestamp}`;
        }
    }

    async handleVersionSubmit() {
        const projectSelect = document.getElementById('projectSelect');
        const newProjectInput = document.getElementById('newProjectInput');
        const contentArea = document.getElementById('contentArea');
        const commentInput = document.getElementById('commentInput');
        const fileInput = document.getElementById('fileInput');
        const submitBtn = document.getElementById('submitBtn');
        const groupSelect = document.getElementById('groupSelect');
        const newGroupInput = document.getElementById('newGroupInput');
        
        // Prevent double submission
        if (submitBtn.disabled) {
            return;
        }
        
        // Determine project name
        let projectName;
        const newProjectName = newProjectInput.value.trim();

        if (!newProjectInput.classList.contains('hidden')) {
            // New project input is visible
            if (newProjectName) {
                // User provided a name
                projectName = newProjectName;
            } else {
                // User didn't provide a name, generate one automatically
                projectName = await this.generateAutoProjectName();
            }
        } else {
            // Use the dropdown selection
            projectName = projectSelect.value;
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
        
        // Determine group name
        let groupName;
        const newGroupName = newGroupInput.value.trim();
        
        if (!newGroupInput.classList.contains('hidden') && newGroupName) {
            // If the "new group" input is visible and has a value, use it
            groupName = newGroupName;
        } else {
            // Otherwise, use the dropdown
            groupName = groupSelect.value;
        }
        
        // Disable submit button to prevent double submission
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
        
        // Prepare form data
        const formData = new FormData();
        formData.append('project_name', projectName);
        formData.append('content', content);
        formData.append('comment', comment);
        formData.append('group_name', groupName);
        
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
                
                // Refresh data and select the new/updated project
                await this.loadProjects();
                this.selectProject(projectName);
                
                // Hide new project input if it was used
                if (!newProjectInput.classList.contains('hidden')) {
                    this.toggleNewProjectInput();
                }
                
                // Hide new group input if it was used
                if (!newGroupInput.classList.contains('hidden')) {
                    this.toggleNewGroupInput();
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
        
        // Clear any existing content
        const modalBody = modal.querySelector('.modal-body');
        modalBody.innerHTML = '';
        
        title.textContent = `Compare: ${oldFilename} vs ${newFilename}`;

        // Create the diff viewer container
        const diffViewerContainer = document.createElement('div');
        diffViewerContainer.className = 'advanced-diff-container';
        modalBody.appendChild(diffViewerContainer);

        // Ensure AdvancedDiff is available
        if (typeof AdvancedDiff !== 'undefined') {
            try {
                const advDiff = new AdvancedDiff();
                advDiff.createDiffViewer(oldContent, newContent, diffViewerContainer);
            } catch (error) {
                console.error('Error creating diff viewer:', error);
                diffViewerContainer.innerHTML = this.createSimpleDiff(oldContent, newContent, oldFilename, newFilename);
            }
        } else {
            // Fallback if AdvancedDiff is not available
            diffViewerContainer.innerHTML = this.createSimpleDiff(oldContent, newContent, oldFilename, newFilename);
        }

        modal.classList.add('open');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Simple fallback diff function
    createSimpleDiff(oldContent, newContent, oldFilename, newFilename) {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        
        let html = `
            <div class="simple-diff-viewer">
                <div class="diff-stats">
                    <span class="stat-item">Old: ${oldLines.length} lines</span>
                    <span class="stat-item">New: ${newLines.length} lines</span>
                </div>
                <div class="diff-content">
                    <div class="diff-panel">
                        <div class="diff-panel-header">Old Version (${oldFilename})</div>
                        <div class="diff-panel-content">
        `;
        
        oldLines.forEach((line, index) => {
            const lineNumber = index + 1;
            html += `<div class="diff-line"><span class="line-number">${lineNumber}</span><span class="line-content">${this.escapeHtml(line)}</span></div>`;
        });
        
        html += `
                        </div>
                    </div>
                    <div class="diff-panel">
                        <div class="diff-panel-header">New Version (${newFilename})</div>
                        <div class="diff-panel-content">
        `;
        
        newLines.forEach((line, index) => {
            const lineNumber = index + 1;
            html += `<div class="diff-line"><span class="line-number">${lineNumber}</span><span class="line-content">${this.escapeHtml(line)}</span></div>`;
        });
        
        html += `
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        return html;
    }

    showProjectContextMenu(event, projectName) {
        const contextMenu = document.getElementById('projectContextMenu');
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${event.pageX}px`;
        contextMenu.style.top = `${event.pageY}px`;

        document.getElementById('renameProjectBtn').onclick = () => {
            contextMenu.style.display = 'none';
            this.handleRenameProject(projectName);
        };

        document.getElementById('moveProjectBtn').onclick = () => {
            contextMenu.style.display = 'none';
            this.handleMoveProject(projectName);
        };

        document.getElementById('deleteProjectBtn').onclick = () => {
            contextMenu.style.display = 'none';
            this.handleDeleteProject(projectName);
        };
    }

    async handleRenameProject(oldName) {
        const newName = prompt(`Enter new name for project "${oldName}":`, oldName);
        
        if (newName && newName.trim() !== '' && newName.trim() !== oldName) {
            try {
                const response = await apiCall(`/api/project/${encodeURIComponent(oldName)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ new_name: newName.trim() })
                });

                if (response.success) {
                    showToast('Project renamed successfully!', 'success');
                    await this.loadProjects();
                    // If the renamed project was the current one, select it with the new name
                    if (this.currentProject === oldName) {
                        this.selectProject(newName.trim());
                    }
                } else {
                    showToast(response.error || 'Failed to rename project', 'error');
                }
            } catch (error) {
                console.error('Error renaming project:', error);
                showToast('An error occurred while renaming the project.', 'error');
            }
        }
    }

    async handleMoveProject(projectName) {
        const newGroup = prompt(`Enter new group for project "${projectName}":`);
        
        if (newGroup && newGroup.trim() !== '') {
            try {
                const response = await apiCall(`/api/project/${encodeURIComponent(projectName)}/group`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ group_name: newGroup.trim() })
                });

                if (response.success) {
                    showToast('Project moved successfully!', 'success');
                    await this.loadProjects();
                } else {
                    showToast(response.error || 'Failed to move project', 'error');
                }
            } catch (error) {
                console.error('Error moving project:', error);
                showToast('An error occurred while moving the project.', 'error');
            }
        }
    }

    async handleDeleteProject(projectName) {
        const confirmation = confirm(`Are you sure you want to delete the project "${projectName}" and all its versions? This action cannot be undone.`);
        
        if (confirmation) {
            try {
                const response = await apiCall(`/api/project/${encodeURIComponent(projectName)}`, {
                    method: 'DELETE'
                });

                if (response.success) {
                    showToast('Project deleted successfully!', 'success');
                    // If the deleted project was the current one, clear the view
                    if (this.currentProject === projectName) {
                        this.currentProject = null;
                        document.getElementById('versionDisplayContainer').innerHTML = '';
                    }
                    await this.loadProjects();
                } else {
                    showToast(response.error || 'Failed to delete project', 'error');
                }
            } catch (error) {
                console.error('Error deleting project:', error);
                showToast('An error occurred while deleting the project.', 'error');
            }
        }
    }

    showGroupBubbleMenu(event, group) {
        // Remove any existing menu
        let menu = document.getElementById('groupBubbleMenu');
        if (menu) menu.remove();
        menu = document.createElement('div');
        menu.id = 'groupBubbleMenu';
        menu.className = 'context-menu group-bubble-menu';
        menu.style.display = 'block';
        menu.style.left = `${event.pageX}px`;
        menu.style.top = `${event.pageY}px`;
        menu.innerHTML = `
            <ul>
                <li id="renameGroupBubbleBtn">Rename Group</li>
                <li id="colorGroupBubbleBtn">Change Color</li>
                <li id="deleteGroupBubbleBtn" class="danger-option">Delete Group</li>
            </ul>
        `;
        document.body.appendChild(menu);
        // Hide on click outside
        setTimeout(() => {
            document.addEventListener('click', function handler(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', handler);
                }
            });
        }, 0);
        document.getElementById('renameGroupBubbleBtn').onclick = () => {
            menu.remove();
            this.handleRenameGroup(group);
        };
        document.getElementById('colorGroupBubbleBtn').onclick = () => {
            menu.remove();
            this.handleChangeGroupColor(group);
        };
        document.getElementById('deleteGroupBubbleBtn').onclick = () => {
            menu.remove();
            this.handleDeleteGroup(group.group_name);
        };
    }

    handleRenameGroup(group) {
        const newName = prompt('Rename group:', group.group_name);
        if (newName && newName.trim() && newName !== group.group_name) {
            group.group_name = newName.trim();
            this.renderProjectGroups();
        }
    }

    handleChangeGroupColor(group) {
        this.showColorPicker(group);
    }

    showColorPicker(group) {
        // Remove any existing color picker
        let colorPicker = document.getElementById('colorPickerModal');
        if (colorPicker) colorPicker.remove();

        // Create color picker modal
        colorPicker = document.createElement('div');
        colorPicker.id = 'colorPickerModal';
        colorPicker.className = 'modal open';
        
        const presetColors = [
            '#ffffff', '#f8fafc', '#e2e8f0', '#cbd5e1', '#94a3b8',
            '#64748b', '#475569', '#334155', '#1e293b', '#0f172a',
            '#fef2f2', '#fee2e2', '#fecaca', '#f87171', '#ef4444',
            '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#450a0a',
            '#fff7ed', '#fed7aa', '#fdba74', '#fb923c', '#f97316',
            '#ea580c', '#dc2626', '#c2410c', '#9a3412', '#7c2d12',
            '#fefce8', '#fef3c7', '#fde047', '#facc15', '#eab308',
            '#ca8a04', '#a16207', '#854d0e', '#713f12', '#422006',
            '#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80',
            '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d',
            '#f0fdfa', '#ccfbf1', '#99f6e4', '#5eead4', '#2dd4bf',
            '#14b8a6', '#0d9488', '#0f766e', '#115e59', '#134e4a',
            '#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8',
            '#0ea5e9', '#0284c7', '#0369a1', '#075985', '#0c4a6e',
            '#f8faff', '#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8',
            '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81',
            '#faf5ff', '#f3e8ff', '#e9d5ff', '#d8b4fe', '#c084fc',
            '#a855f7', '#9333ea', '#7c3aed', '#6d28d9', '#581c87',
            '#fdf4ff', '#fae8ff', '#f5d0fe', '#f0abfc', '#e879f9',
            '#d946ef', '#c026d3', '#a21caf', '#86198f', '#701a75'
        ];

        colorPicker.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>Choose Group Color</h3>
                    <button class="close-btn" onclick="document.getElementById('colorPickerModal').remove()">&times;</button>
                </div>
                <div class="modal-body" style="padding: 1.5rem;">
                    <div style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 0.5rem; margin-bottom: 1rem;">
                        ${presetColors.map(color => `
                            <div class="color-option" 
                                 data-color="${color}" 
                                 style="
                                     width: 32px; 
                                     height: 32px; 
                                     background-color: ${color}; 
                                     border: 2px solid ${color === (group.color || '#fff') ? '#2563eb' : '#e2e8f0'}; 
                                     border-radius: 0.375rem; 
                                     cursor: pointer;
                                     transition: all 0.2s ease;
                                 "
                                 title="${color}">
                            </div>
                        `).join('')}
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1rem;">
                        <label style="font-weight: 500;">Custom color:</label>
                        <input type="color" id="customColorInput" value="${group.color || '#ffffff'}" 
                               style="width: 40px; height: 32px; border: 1px solid #e2e8f0; border-radius: 0.375rem; cursor: pointer;">
                        <span style="font-size: 0.875rem; color: #64748b;">Or pick any color</span>
                    </div>
                    <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                        <button class="btn-secondary" onclick="document.getElementById('colorPickerModal').remove()">
                            Cancel
                        </button>
                        <button class="submit-btn" id="applyColorBtn">
                            Apply Color
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(colorPicker);

        // Handle color selection
        let selectedColor = group.color || '#ffffff';
        
        // Preset color selection
        colorPicker.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', () => {
                selectedColor = option.dataset.color;
                
                // Update visual selection
                colorPicker.querySelectorAll('.color-option').forEach(opt => {
                    opt.style.border = `2px solid ${opt.dataset.color === selectedColor ? '#2563eb' : '#e2e8f0'}`;
                });
                
                // Update custom color input
                document.getElementById('customColorInput').value = selectedColor;
            });
        });

        // Custom color input
        document.getElementById('customColorInput').addEventListener('change', (e) => {
            selectedColor = e.target.value;
            
            // Clear preset selection borders
            colorPicker.querySelectorAll('.color-option').forEach(opt => {
                opt.style.border = `2px solid #e2e8f0`;
            });
        });

        // Apply button
        document.getElementById('applyColorBtn').addEventListener('click', () => {
            group.color = selectedColor;
            this.saveGroupColor(group.group_name, selectedColor);
            this.renderProjectGroups();
            colorPicker.remove();
        });

        // Close on background click
        colorPicker.addEventListener('click', (e) => {
            if (e.target === colorPicker) {
                colorPicker.remove();
            }
        });
    }

    handleDeleteGroup(groupName) {
        const confirmation = confirm(`Are you sure you want to delete the entire group "${groupName}"? This will delete all projects and versions within it. This action cannot be undone.`);
        if (confirmation) {
            apiCall(`/api/group/${encodeURIComponent(groupName)}`, {
                method: 'DELETE'
            }).then(response => {
                if (response.success) {
                    showToast('Group deleted successfully!', 'success');
                    // Remove the group color from localStorage when group is deleted
                    this.removeGroupColor(groupName);
                    if (this.currentProject && this.groupedProjects.find(g => g.group_name === groupName)?.projects.includes(this.currentProject)) {
                        this.currentProject = null;
                        document.getElementById('versionDisplayContainer').innerHTML = '';
                    }
                    this.loadProjects();
                } else {
                    showToast(response.error || 'Failed to delete group', 'error');
                }
            }).catch(error => {
                console.error('Error deleting group:', error);
                showToast('An error occurred while deleting the group.', 'error');
            });
        }
    }

    // Group color persistence methods
    saveGroupColor(groupName, color) {
        try {
            const groupColors = this.getGroupColors();
            groupColors[groupName] = color;
            localStorage.setItem('groupColors', JSON.stringify(groupColors));
        } catch (error) {
            console.error('Error saving group color:', error);
        }
    }

    getGroupColors() {
        try {
            const stored = localStorage.getItem('groupColors');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('Error loading group colors:', error);
            return {};
        }
    }

    removeGroupColor(groupName) {
        try {
            const groupColors = this.getGroupColors();
            delete groupColors[groupName];
            localStorage.setItem('groupColors', JSON.stringify(groupColors));
        } catch (error) {
            console.error('Error removing group color:', error);
        }
    }

    loadGroupColors() {
        const groupColors = this.getGroupColors();
        if (this.groupedProjects) {
            this.groupedProjects.forEach(group => {
                if (groupColors[group.group_name]) {
                    group.color = groupColors[group.group_name];
                } else if (!group.color) {
                    group.color = '#fff'; // Default color
                }
            });
        }
    }
}

// Help Modal Functions
function showHelpModal() {
    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'help-modal-overlay';
    modal.innerHTML = `
        <div class="help-modal">
            <div class="help-modal-header">
                <h3>How Version Control Works</h3>
                <button class="help-modal-close">&times;</button>
            </div>
            <div class="help-modal-content">
                <h3>Overview</h3>
                <p>Version Control helps you track and manage multiple versions of the same document or file. This is essential for keeping your work safe, comparing changes over time, and being able to revert to previous versions if something goes wrong.</p>

                <h3>Why Use Version Control?</h3>
                <ul>
                    <li><strong>Safety Net:</strong> Never lose your work again - every version is saved and accessible.</li>
                    <li><strong>Change Tracking:</strong> See exactly what changed between versions with AI-powered diffs.</li>
                    <li><strong>Easy Recovery:</strong> Quickly go back to any previous version if you need to undo changes.</li>
                    <li><strong>Organized Workflow:</strong> Keep related documents together in projects and groups.</li>
                </ul>

                <h3>Projects and Groups</h3>
                <h4>What is a Project?</h4>
                <p>A project is like a folder that contains multiple versions of the same document. For example, you might have a project called "Website Homepage" that contains different versions of your homepage code as you make changes.</p>

                <h4>Standalone vs. Grouped Projects</h4>
                <ul>
                    <li><strong>Standalone Projects:</strong> Individual projects that exist on their own.</li>
                    <li><strong>Groups:</strong> Collections of related projects. For example, a "Website Redesign" group might contain projects like "Homepage", "About Page", and "Contact Form".</li>
                </ul>

                <h4>Group Features</h4>
                <ul>
                    <li><strong>Color Coding:</strong> Assign custom colors to groups for easy visual organization.</li>
                    <li><strong>Rename Groups:</strong> Keep your workspace organized with descriptive names.</li>
                    <li><strong>Delete Groups:</strong> Remove entire groups when projects are no longer needed.</li>
                </ul>

                <h3>Creating and Managing Versions</h3>
                <h4>1. Create or Select a Project</h4>
                <p>Choose an existing project from the sidebar, or create a new one. You can also optionally assign it to a group.</p>

                <h4>2. Upload or Paste Content</h4>
                <p>You can either drag and drop a file, click to browse for a file, or paste text content directly into the text area.</p>

                <h4>3. Add a Comment</h4>
                <p>Always add a comment describing what changed in this version. Good comments help you find the right version later (e.g., "Fixed login bug" or "Added mobile responsive design").</p>

                <h4>4. Save the Version</h4>
                <p>Click "Save Version" to store your new version. It will appear in the version history with a timestamp and your comment.</p>

                <h3>Working with Saved Versions</h3>
                <ul>
                    <li><strong>View Content:</strong> Click the "View" button to see the full content of any version in a popup window.</li>
                    <li><strong>Download Versions:</strong> Download any version as a file to your computer.</li>
                    <li><strong>AI Diff Comparison:</strong> Use the "Diff" button to see an intelligent comparison between two versions, highlighting exactly what changed.</li>
                    <li><strong>Version History:</strong> All versions are listed chronologically with timestamps and comments for easy navigation.</li>
                </ul>

                <h3>Tips for Success</h3>
                <ul>
                    <li><strong>Comment Every Version:</strong> Descriptive comments make it easy to find the version you need later.</li>
                    <li><strong>Save Frequently:</strong> Don't wait until major milestones - save versions as you make progress.</li>
                    <li><strong>Use Groups Wisely:</strong> Group related projects together for better organization.</li>
                    <li><strong>Regular Cleanup:</strong> Periodically review and delete old versions or projects you no longer need.</li>
                </ul>
            </div>
        </div>
    `;

    // Add modal to page
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    // Event listeners
    const closeBtn = modal.querySelector('.help-modal-close');
    closeBtn.addEventListener('click', closeHelpModal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeHelpModal();
        }
    });

    // ESC key to close
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeHelpModal();
        }
    };
    document.addEventListener('keydown', escHandler);

    // Store cleanup function
    modal._cleanup = () => {
        document.removeEventListener('keydown', escHandler);
    };
}

function closeHelpModal() {
    const modal = document.querySelector('.help-modal-overlay');
    if (modal) {
        if (modal._cleanup) {
            modal._cleanup();
        }
        document.body.removeChild(modal);
        document.body.style.overflow = '';
    }
}

// Global function for closing diff modal (called from HTML)
function closeDiffModal() {
    const modal = document.getElementById('diffModal');
    if (modal) {
        modal.classList.remove('open');
    }
}

// Initialize version control when page loads
let versionControl;
document.addEventListener('DOMContentLoaded', () => {
    versionControl = new VersionControl();
});