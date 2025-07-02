// Folder Manager - Project-based folder version system
let selectedFolderHandle = null;
let currentProject = null;
let folderProjects = [];
let folderVersions = [];
let isInitialLoad = true;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeFolderManager();
});

async function initializeFolderManager() {
    // Check File System Access API support
    if (!('showDirectoryPicker' in window)) {
        showToast('File System Access API not supported. Please use Chrome, Edge, or Opera (version 86+).', 'error');
        document.getElementById('selectFolderBtn').disabled = true;
        return;
    }

    // Load projects and setup event listeners
    await loadFolderProjects();
    setupEventListeners();
}

function setupEventListeners() {
    // Select folder button
    document.getElementById('selectFolderBtn').addEventListener('click', selectFolder);
    
    // Project management
    document.getElementById('newFolderProjectBtn').addEventListener('click', toggleNewProjectInput);
    document.getElementById('folderProjectSelect').addEventListener('change', onProjectSelect);
    
    // Form submission
    document.getElementById('folderForm').addEventListener('submit', saveFolderVersion);
    
    // New project input handling
    document.getElementById('newFolderProjectInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            createNewFolderProject();
        }
    });
    
    // Track project usage when leaving the page
    window.addEventListener('beforeunload', function() {
        if (currentProject) {
            updateProjectLastOpened(currentProject);
        }
    });

    // Hide context menu on click outside
    document.addEventListener('click', () => {
        const contextMenu = document.getElementById('folderProjectContextMenu');
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
    });

    // Help button functionality
    document.getElementById('helpBtn').addEventListener('click', showHelpModal);
}

async function selectFolder() {
    try {
        selectedFolderHandle = await window.showDirectoryPicker();
        
        // Show folder preview
        await displayFolderPreview();
        
        // Enable submit button if project is selected
        updateSubmitButton();
        
        showToast(`Selected folder: ${selectedFolderHandle.name}`, 'success');
        
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error selecting folder:', error);
            showToast('Error selecting folder: ' + error.message, 'error');
        }
    }
}

async function displayFolderPreview() {
    const preview = document.getElementById('folderPreview');
    const treeContainer = document.getElementById('folderTree');
    
    if (!selectedFolderHandle) {
        preview.classList.add('hidden');
        // Refresh the middle panel to hide the ZIP button
        if (currentProject) {
            displayFolderVersions();
        }
        return;
    }
    
    try {
        // Build folder tree
        const tree = await buildFolderTree(selectedFolderHandle);
        treeContainer.innerHTML = renderTreeNode(tree, 0);
        
        preview.classList.remove('hidden');
        
        // Refresh the middle panel to show the ZIP button
        if (currentProject) {
            displayFolderVersions();
        }
        
    } catch (error) {
        console.error('Error building folder tree:', error);
        showToast('Error reading folder structure', 'error');
    }
}

async function buildFolderTree(dirHandle, maxDepth = 3, currentDepth = 0) {
    const node = {
        name: dirHandle.name,
        type: 'directory',
        children: []
    };
    
    if (currentDepth >= maxDepth) {
        return node;
    }
    
    try {
        for await (const [name, handle] of dirHandle.entries()) {
            // Skip hidden files/folders (starting with .)
            if (name.startsWith('.')) continue;
            
            if (handle.kind === 'directory') {
                const childNode = await buildFolderTree(handle, maxDepth, currentDepth + 1);
                node.children.push(childNode);
            } else {
                node.children.push({
                    name: name,
                    type: 'file',
                    children: []
                });
            }
        }
        
        // Sort: directories first, then files, both alphabetically
        node.children.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
        
    } catch (error) {
        console.warn(`Could not read directory: ${dirHandle.name}`, error);
    }
    
    return node;
}

function renderTreeNode(node, depth) {
    const indent = '&nbsp;'.repeat(depth * 4);
    const icon = node.type === 'directory' ? '📁' : '📄';
    const hasChildren = node.children && node.children.length > 0;
    
    let html = `
        <div class="tree-node">
            <div class="tree-node-content">
                ${indent}
                ${hasChildren ? '<span class="tree-toggle">▼</span>' : '<span class="tree-toggle">&nbsp;</span>'}
                <span class="tree-icon">${icon}</span>
                <span class="tree-name">${node.name}</span>
            </div>`;
    
    if (hasChildren) {
        html += '<div class="tree-children">';
        for (const child of node.children) {
            html += renderTreeNode(child, depth + 1);
        }
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

async function loadFolderProjects() {
    try {
        const response = await apiCall('/api/folder-projects');
        folderProjects = response.projects || [];
        updateProjectSelect();
        updateProjectsList();
        
        // Auto-select the most recently opened project
        autoSelectLastOpenedProject();
    } catch (error) {
        console.error('Error loading folder projects:', error);
        showToast('Error loading projects', 'error');
    }
}

function autoSelectLastOpenedProject() {
    if (folderProjects.length === 0 || currentProject) {
        return; // No projects or already have a selection
    }
    
    // Find the most recently opened project
    let mostRecentProject = null;
    let mostRecentTime = null;
    
    for (const project of folderProjects) {
        const lastOpened = getProjectLastOpened(project.name);
        if (lastOpened && (!mostRecentTime || new Date(lastOpened) > new Date(mostRecentTime))) {
            mostRecentProject = project.name;
            mostRecentTime = lastOpened;
        }
    }
    
    // Auto-select the most recent project if found
    if (mostRecentProject) {
        // Don't call selectProject directly to avoid updating "last opened" again
        currentProject = mostRecentProject;
        document.getElementById('folderProjectSelect').value = mostRecentProject;
        updateProjectsList();
        loadFolderVersions(mostRecentProject);
        updateSubmitButton();
    }
}

function updateProjectSelect() {
    const select = document.getElementById('folderProjectSelect');
    select.innerHTML = '<option value="">Select or create project...</option>';
    
    folderProjects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.name;
        option.textContent = project.name;
        select.appendChild(option);
    });
}

function updateProjectsList() {
    const container = document.getElementById('folderProjectsList');
    
    if (folderProjects.length === 0) {
        container.innerHTML = '<p class="text-muted">No projects yet. Create your first folder project!</p>';
        return;
    }
    
    let projectsToDisplay;
    
    // Only sort by last opened on initial page load
    if (isInitialLoad) {
        // Sort projects by last opened time (most recent first)
        projectsToDisplay = [...folderProjects].sort((a, b) => {
            const lastOpenedA = getProjectLastOpened(a.name);
            const lastOpenedB = getProjectLastOpened(b.name);
            
            // Projects that have been opened go to the top, sorted by recency
            if (lastOpenedA && lastOpenedB) {
                return new Date(lastOpenedB) - new Date(lastOpenedA);
            } else if (lastOpenedA) {
                return -1; // A has been opened, B hasn't
            } else if (lastOpenedB) {
                return 1; // B has been opened, A hasn't
            } else {
                // Neither has been opened, sort by creation date (newest first)
                return new Date(b.created_at) - new Date(a.created_at);
            }
        });
        
        // Update the main folderProjects array to maintain order during session
        folderProjects = projectsToDisplay;
        isInitialLoad = false;
    } else {
        // Use existing order during the session
        projectsToDisplay = folderProjects;
    }
    
    container.innerHTML = projectsToDisplay.map(project => `
        <div class="folder-project-bubble ${currentProject === project.name ? 'selected' : ''}" 
             data-project="${project.name}">
            ${project.name}
        </div>
    `).join('');
    
    // Add click handlers
    container.querySelectorAll('.folder-project-bubble').forEach(bubble => {
        bubble.addEventListener('click', () => {
            selectProject(bubble.dataset.project);
        });
        
        bubble.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showFolderProjectContextMenu(e, bubble.dataset.project);
        });
    });
}

function selectProject(projectName) {
    currentProject = projectName;
    document.getElementById('folderProjectSelect').value = projectName;
    
    // Don't update last opened during session - only on page leave
    updateProjectsList();
    loadFolderVersions(projectName);
    updateSubmitButton();
}

async function loadFolderVersions(projectName) {
    try {
        const response = await apiCall('/api/folder-versions', {
            method: 'POST',
            body: JSON.stringify({ project: projectName })
        });
        
        folderVersions = response.versions || [];
        displayFolderVersions();
        
    } catch (error) {
        console.error('Error loading folder versions:', error);
        showToast('Error loading folder versions', 'error');
    }
}

function displayFolderVersions() {
    const container = document.getElementById('folderHistoryContainer');
    
    if (!currentProject) {
        container.innerHTML = '<p class="text-muted">Select a project to view folder versions</p>';
        return;
    }
    
    // Show current folder actions if folder is selected
    const zipDownloadSection = selectedFolderHandle ? `
        <div class="folder-version-item" style="border: 2px dashed var(--primary-color); background: rgba(37, 99, 235, 0.05);">
            <div class="folder-version-header">
                <div class="folder-version-info">
                    <div class="folder-version-name">Current Selected Folder: ${selectedFolderHandle.name}</div>
                    <div class="folder-version-comment">Download or view the currently selected folder</div>
                </div>
                <div class="folder-version-actions">
                    <button class="action-btn-small" id="viewCurrentStructureBtn">
                        View Structure
                    </button>
                    <button class="action-btn-small" id="downloadZipBtn" style="background: var(--primary-color); color: white; border-color: var(--primary-color);">
                        Download ZIP
                    </button>
                </div>
            </div>
        </div>
    ` : '';
    
    if (folderVersions.length === 0) {
        container.innerHTML = `
            <h4 class="folder-heading">${currentProject}</h4>
            ${zipDownloadSection}
            <div style="margin-top: 1rem;">
                <p class="text-muted">No folder versions yet. Save your first folder version!</p>
            </div>
        `;
    } else {
        const html = `
            <h4 class="folder-heading">${currentProject}</h4>
            ${zipDownloadSection}
            ${folderVersions.length > 0 ? `
                <div style="margin-top: 1rem; padding: 0.75rem; background: var(--background-color); border-radius: 0.5rem; border: 1px solid var(--border-color);">
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">
                        <strong>Note:</strong> Newer versions (with file contents) can be downloaded as ZIP. 
                        Older versions (structure only) can only be downloaded as JSON.
                    </div>
                </div>
            ` : ''}
            <div class="folder-version-list" style="margin-top: 1rem;">
                ${folderVersions.map(version => `
                    <div class="folder-version-item">
                        <div class="folder-version-header">
                            <div class="folder-version-info">
                                <div class="folder-version-name">${version.folder_name}</div>
                                ${version.comment ? `<div class="folder-version-comment">${version.comment}</div>` : ''}
                                <div class="folder-version-meta">
                                    ${formatDateTime(version.created_at)} • ${version.file_count} files
                                </div>
                            </div>
                                                    <div class="folder-version-actions">
                            <button class="action-btn-small" onclick="viewFolderStructure(${version.id})">
                                View Structure
                            </button>
                            <button class="action-btn-small" onclick="downloadFolderVersion(${version.id})" title="Downloads folder structure metadata">
                                Download JSON
                            </button>
                            <button class="action-btn-small" onclick="downloadFolderVersionZip(${version.id})" style="background: var(--primary-color); color: white; border-color: var(--primary-color);">
                                Download ZIP
                            </button>
                        </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        container.innerHTML = html;
    }
    
    // Re-attach event listeners for current folder buttons
    const zipBtn = document.getElementById('downloadZipBtn');
    if (zipBtn) {
        zipBtn.addEventListener('click', downloadCurrentFolderAsZip);
    }
    
    const viewCurrentBtn = document.getElementById('viewCurrentStructureBtn');
    if (viewCurrentBtn) {
        viewCurrentBtn.addEventListener('click', viewCurrentFolderStructure);
    }
}

function toggleNewProjectInput() {
    const input = document.getElementById('newFolderProjectInput');
    const button = document.getElementById('newFolderProjectBtn');
    
    if (input.classList.contains('hidden')) {
        input.classList.remove('hidden');
        input.focus();
        button.textContent = 'Cancel';
    } else {
        input.classList.add('hidden');
        input.value = '';
        button.textContent = '+ New';
    }
    
    // Update submit button state
    updateSubmitButton();
}

async function createNewFolderProject() {
    const input = document.getElementById('newFolderProjectInput');
    let projectName = input.value.trim();
    
    // If no name provided, generate automatic name
    if (!projectName) {
        projectName = generateAutoProjectName();
    }
    
    try {
        await apiCall('/api/folder-projects', {
            method: 'POST',
            body: JSON.stringify({ name: projectName })
        });
        
        // Reload projects and select the new one
        await loadFolderProjects();
        document.getElementById('folderProjectSelect').value = projectName;
        selectProject(projectName);
        
        // Hide input
        toggleNewProjectInput();
        
        showToast(`Project "${projectName}" created successfully`, 'success');
        
    } catch (error) {
        console.error('Error creating project:', error);
        showToast('Error creating project: ' + error.message, 'error');
    }
}

function generateAutoProjectName() {
    // Find the next available "Project n" name
    let projectNumber = 1;
    let candidateName = `Project ${projectNumber}`;
    
    // Check if the name already exists
    while (folderProjects.some(project => project.name === candidateName)) {
        projectNumber++;
        candidateName = `Project ${projectNumber}`;
    }
    
    return candidateName;
}

function onProjectSelect() {
    const select = document.getElementById('folderProjectSelect');
    const projectName = select.value;
    
    if (projectName) {
        selectProject(projectName);
    } else {
        currentProject = null;
        updateProjectsList();
        document.getElementById('folderHistoryContainer').innerHTML = 
            '<p class="text-muted">Select a project to view folder versions</p>';
    }
    
    updateSubmitButton();
}

function updateSubmitButton() {
    const submitBtn = document.getElementById('submitFolderBtn');
    const input = document.getElementById('newFolderProjectInput');
    const isCreatingNewProject = !input.classList.contains('hidden');
    
    const canSubmit = selectedFolderHandle && (currentProject || isCreatingNewProject);
    
    submitBtn.disabled = !canSubmit;
    
    if (canSubmit) {
        submitBtn.textContent = 'Save Folder Version';
    } else if (!selectedFolderHandle) {
        submitBtn.textContent = 'Select Folder First';
    } else if (!currentProject && !isCreatingNewProject) {
        submitBtn.textContent = 'Select Project First';
    }
}

async function saveFolderVersion(event) {
    event.preventDefault();
    
    if (!selectedFolderHandle) {
        showToast('Please select a folder first', 'error');
        return;
    }
    
    // If no project is selected, check if we should auto-create one
    if (!currentProject) {
        const input = document.getElementById('newFolderProjectInput');
        
        // If the input field is visible (they clicked New but didn't create a project)
        if (!input.classList.contains('hidden')) {
            // Auto-create project with generated or typed name
            let projectName = input.value.trim();
            if (!projectName) {
                projectName = generateAutoProjectName();
            }
            
            try {
                await apiCall('/api/folder-projects', {
                    method: 'POST',
                    body: JSON.stringify({ name: projectName })
                });
                
                // Reload projects and select the new one
                await loadFolderProjects();
                document.getElementById('folderProjectSelect').value = projectName;
                selectProject(projectName);
                
                // Hide input
                toggleNewProjectInput();
                
                showToast(`Project "${projectName}" created successfully`, 'success');
                
            } catch (error) {
                console.error('Error creating project:', error);
                showToast('Error creating project: ' + error.message, 'error');
                return;
            }
        } else {
            // No project selected and input not visible - they need to select/create a project
            showToast('Please select or create a project first', 'error');
            return;
        }
    }
    
    const comment = document.getElementById('folderCommentInput').value.trim();
    const submitBtn = document.getElementById('submitFolderBtn');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Reading files...';
    
    try {
        // Build complete folder structure with file contents
        showToast('Reading folder contents...', 'info');
        const folderData = await buildCompleteFolderData(selectedFolderHandle);
        
        submitBtn.textContent = 'Saving to server...';
        
        // Save to backend
        const response = await apiCall('/api/folder-versions', {
            method: 'POST',
            body: JSON.stringify({
                project: currentProject,
                folder_name: selectedFolderHandle.name,
                folder_structure: folderData,
                comment: comment || null,
                file_count: folderData.file_count
            })
        });
        
        showToast('Folder version saved successfully', 'success');
        
        // Reload versions for current project
        await loadFolderVersions(currentProject);
        
        // Reset form
        document.getElementById('folderCommentInput').value = '';
        
    } catch (error) {
        console.error('Error saving folder version:', error);
        showToast('Error saving folder version: ' + error.message, 'error');
    } finally {
        updateSubmitButton();
    }
}

async function buildCompleteFolderData(dirHandle, path = '') {
    const result = {
        name: dirHandle.name,
        type: 'directory',
        path: path,
        children: [],
        file_count: 0
    };
    
    try {
        for await (const [name, handle] of dirHandle.entries()) {
            // Skip hidden files/folders
            if (name.startsWith('.')) continue;
            
            const childPath = path ? `${path}/${name}` : name;
            
            if (handle.kind === 'directory') {
                const childData = await buildCompleteFolderData(handle, childPath);
                result.children.push(childData);
                result.file_count += childData.file_count;
            } else {
                // Read actual file content
                const fileData = {
                    name: name,
                    type: 'file',
                    path: childPath,
                    size: await getFileSize(handle)
                };
                
                try {
                    const file = await handle.getFile();
                    // For text files, store content. For binary files, store base64
                    if (isTextFile(name)) {
                        fileData.content = await file.text();
                        fileData.encoding = 'text';
                    } else {
                        const arrayBuffer = await file.arrayBuffer();
                        const base64 = arrayBufferToBase64(arrayBuffer);
                        fileData.content = base64;
                        fileData.encoding = 'base64';
                    }
                } catch (error) {
                    console.warn(`Could not read file content: ${childPath}`, error);
                    fileData.content = null;
                    fileData.encoding = 'error';
                    fileData.error = error.message;
                }
                
                result.children.push(fileData);
                result.file_count += 1;
            }
        }
        
        // Sort children
        result.children.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
        
    } catch (error) {
        console.warn(`Could not read directory: ${dirHandle.name}`, error);
    }
    
    return result;
}

function isTextFile(filename) {
    const textExtensions = [
        '.txt', '.md', '.js', '.html', '.css', '.json', '.xml', '.csv', 
        '.py', '.java', '.cpp', '.c', '.h', '.php', '.rb', '.go', '.rs',
        '.ts', '.jsx', '.tsx', '.vue', '.yaml', '.yml', '.toml', '.ini',
        '.cfg', '.conf', '.log', '.sql', '.sh', '.bat', '.ps1', '.dockerfile'
    ];
    
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return textExtensions.includes(ext) || !filename.includes('.');
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function getFileSize(fileHandle) {
    try {
        const file = await fileHandle.getFile();
        return file.size;
    } catch {
        return 0;
    }
}

// Project last opened tracking functions
function getProjectLastOpened(projectName) {
    try {
        const lastOpenedData = localStorage.getItem('folderProject_lastOpened');
        if (!lastOpenedData) return null;
        
        const data = JSON.parse(lastOpenedData);
        return data[projectName] || null;
    } catch (error) {
        console.warn('Error reading project last opened data:', error);
        return null;
    }
}

function updateProjectLastOpened(projectName) {
    try {
        const lastOpenedData = localStorage.getItem('folderProject_lastOpened');
        const data = lastOpenedData ? JSON.parse(lastOpenedData) : {};
        
        data[projectName] = new Date().toISOString();
        
        localStorage.setItem('folderProject_lastOpened', JSON.stringify(data));
    } catch (error) {
        console.warn('Error updating project last opened data:', error);
    }
}

async function viewFolderStructure(versionId) {
    try {
        const response = await apiCall(`/api/folder-versions/${versionId}`);
        const version = response.version;
        
        // Create modal or display structure
        showFolderStructureModal(version);
        
    } catch (error) {
        console.error('Error loading folder structure:', error);
        showToast('Error loading folder structure', 'error');
    }
}

function showFolderStructureModal(version) {
    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'structure-modal-overlay';
    modal.innerHTML = `
        <div class="structure-modal">
            <div class="structure-modal-header">
                <h3>📁 ${version.folder_name} - Structure View</h3>
                <button class="structure-modal-close">&times;</button>
            </div>
            <div class="structure-modal-content">
                <div class="structure-modal-info">
                    <div class="structure-info-grid">
                        <div class="structure-info-item">
                            <span class="structure-info-label">Version:</span>
                            <span class="structure-info-value">#${version.id}</span>
                        </div>
                        <div class="structure-info-item">
                            <span class="structure-info-label">Created:</span>
                            <span class="structure-info-value">${formatDateTime(version.created_at)}</span>
                        </div>
                        <div class="structure-info-item">
                            <span class="structure-info-label">Files:</span>
                            <span class="structure-info-value">${version.file_count}</span>
                        </div>
                        ${version.comment ? `
                        <div class="structure-info-item structure-info-comment">
                            <span class="structure-info-label">Comment:</span>
                            <span class="structure-info-value">${version.comment}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="structure-tree-container">
                    <div class="structure-tree-header">
                        <h4>File Structure</h4>
                        <div class="structure-tree-actions">
                            <button class="btn-secondary btn-small" onclick="expandAllTreeNodes()">Expand All</button>
                            <button class="btn-secondary btn-small" onclick="collapseAllTreeNodes()">Collapse All</button>
                        </div>
                    </div>
                    <div class="structure-tree" id="structureTree">
                        ${renderStructureTree(version.folder_structure, version.id, '', 0)}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add modal to page
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    // Event listeners
    const closeBtn = modal.querySelector('.structure-modal-close');
    closeBtn.addEventListener('click', closeStructureModal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeStructureModal();
        }
    });

    // ESC key to close
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeStructureModal();
        }
    };
    document.addEventListener('keydown', escHandler);

    // Store cleanup function
    modal._cleanup = () => {
        document.removeEventListener('keydown', escHandler);
    };

    // Add tree toggle functionality
    setupStructureTreeToggle();
}

function closeStructureModal() {
    const modal = document.querySelector('.structure-modal-overlay');
    if (modal) {
        if (modal._cleanup) {
            modal._cleanup();
        }
        document.body.removeChild(modal);
        document.body.style.overflow = '';
    }
}

function renderStructureTree(node, versionId, path = '', depth = 0) {
    if (!node) return '';
    
    const indent = depth * 20;
    const isDirectory = node.type === 'directory';
    const icon = isDirectory ? '📁' : '📄';
    const hasChildren = isDirectory && node.children && node.children.length > 0;
    const currentPath = path ? `${path}/${node.name}` : node.name;
    
    let html = `
        <div class="structure-tree-node ${isDirectory ? 'directory' : 'file'}" style="margin-left: ${indent}px;" data-path="${currentPath}">
            <div class="structure-tree-node-content">
                ${hasChildren ? `<span class="structure-tree-toggle" onclick="toggleStructureNode(this)">▼</span>` : '<span class="structure-tree-toggle-spacer"></span>'}
                <span class="structure-tree-icon">${icon}</span>
                <span class="structure-tree-name">${node.name}</span>
                <div class="structure-tree-actions">
                    ${isDirectory ? 
                        `<button class="structure-tree-btn" onclick="downloadFolderFromStructure('${versionId}', '${currentPath}', '${node.name}')" title="Download folder as ZIP">
                            📦 ZIP
                        </button>` :
                        `<button class="structure-tree-btn" onclick="downloadFileFromStructure('${versionId}', '${currentPath}', '${node.name}')" title="Download file">
                            💾 Download
                        </button>`
                    }
                </div>
            </div>`;
    
    if (hasChildren) {
        html += '<div class="structure-tree-children">';
        for (const child of node.children) {
            html += renderStructureTree(child, versionId, currentPath, depth + 1);
        }
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

function setupStructureTreeToggle() {
    // Tree toggle functionality is handled by onclick events in the HTML
}

function toggleStructureNode(toggleElement) {
    const node = toggleElement.closest('.structure-tree-node');
    const children = node.querySelector('.structure-tree-children');
    
    if (children) {
        const isExpanded = children.style.display !== 'none';
        children.style.display = isExpanded ? 'none' : 'block';
        toggleElement.textContent = isExpanded ? '▶' : '▼';
        node.classList.toggle('collapsed', isExpanded);
        node.classList.toggle('expanded', !isExpanded);
    }
}

function expandAllTreeNodes() {
    const tree = document.getElementById('structureTree');
    const toggles = tree.querySelectorAll('.structure-tree-toggle');
    const children = tree.querySelectorAll('.structure-tree-children');
    
    toggles.forEach(toggle => {
        toggle.textContent = '▼';
    });
    
    children.forEach(child => {
        child.style.display = 'block';
    });
    
    const nodes = tree.querySelectorAll('.structure-tree-node');
    nodes.forEach(node => {
        node.classList.remove('collapsed');
        node.classList.add('expanded');
    });
}

function collapseAllTreeNodes() {
    const tree = document.getElementById('structureTree');
    const toggles = tree.querySelectorAll('.structure-tree-toggle');
    const children = tree.querySelectorAll('.structure-tree-children');
    
    toggles.forEach(toggle => {
        toggle.textContent = '▶';
    });
    
    children.forEach(child => {
        child.style.display = 'none';
    });
    
    const nodes = tree.querySelectorAll('.structure-tree-node');
    nodes.forEach(node => {
        node.classList.remove('expanded');
        node.classList.add('collapsed');
    });
}

async function downloadFileFromStructure(versionId, filePath, fileName) {
    try {
        showToast('Preparing file download...', 'info');
        
        let version;
        
        // Handle current folder vs saved version
        if (versionId === 'current') {
            if (!selectedFolderHandle) {
                throw new Error('No folder currently selected');
            }
            
            // For current folder, we need to read the file directly from the File System API
            const fileHandle = await findFileHandleInFolder(selectedFolderHandle, filePath);
            if (!fileHandle) {
                throw new Error('File not found in current folder');
            }
            
            const file = await fileHandle.getFile();
            const url = URL.createObjectURL(file);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showToast(`File "${fileName}" downloaded successfully`, 'success');
            return;
        }
        
        // Handle saved version
        const response = await apiCall(`/api/folder-versions/${versionId}`);
        version = response.version;
        
        // Find the specific file in the structure
        const file = findFileInStructure(version.folder_structure, filePath);
        
        if (!file) {
            throw new Error('File not found in structure');
        }
        
        if (!file.content) {
            throw new Error('File content not available. This version may not include file contents.');
        }
        
        // Create blob from file content
        let blob;
        if (file.encoding === 'base64') {
            // Convert base64 to binary
            const binaryString = atob(file.content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            blob = new Blob([bytes]);
        } else {
            // Text content
            blob = new Blob([file.content], { type: 'text/plain' });
        }
        
        // Download the file
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast(`File "${fileName}" downloaded successfully`, 'success');
        
    } catch (error) {
        console.error('Error downloading file:', error);
        showToast('Error downloading file: ' + error.message, 'error');
    }
}

async function downloadFolderFromStructure(versionId, folderPath, folderName) {
    try {
        showToast('Creating ZIP file...', 'info');
        
        // Check if JSZip is available
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library not loaded');
        }
        
        const zip = new JSZip();
        
        // Handle current folder vs saved version
        if (versionId === 'current') {
            if (!selectedFolderHandle) {
                throw new Error('No folder currently selected');
            }
            
            // For current folder, read directly from File System API
            const folderHandle = await findFolderHandleInFolder(selectedFolderHandle, folderPath);
            if (!folderHandle) {
                throw new Error('Folder not found in current selection');
            }
            
            // Add folder contents to ZIP using File System API
            await addFolderToZip(zip, folderHandle, folderName);
            
        } else {
            // Handle saved version
            const response = await apiCall(`/api/folder-versions/${versionId}`);
            const version = response.version;
            
            // Find the specific folder in the structure
            const folder = findFileInStructure(version.folder_structure, folderPath);
            
            if (!folder || folder.type !== 'directory') {
                throw new Error('Folder not found in structure');
            }
            
            // Add folder contents to ZIP from saved structure
            await addStructureFolderToZip(zip, folder, folderName);
        }
        
        // Generate ZIP file
        const content = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        
        // Download ZIP
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${folderName}-from-version-${versionId}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast(`Folder "${folderName}" downloaded as ZIP successfully`, 'success');
        
    } catch (error) {
        console.error('Error downloading folder:', error);
        showToast('Error creating ZIP file: ' + error.message, 'error');
    }
}

function findFileInStructure(structure, targetPath) {
    if (!structure) return null;
    
    // Split the path and remove empty parts
    const pathParts = targetPath.split('/').filter(part => part.length > 0);
    
    // If no path parts, return the root structure
    if (pathParts.length === 0) {
        return structure;
    }
    
    // If this is the target item
    if (pathParts.length === 1 && structure.name === pathParts[0]) {
        return structure;
    }
    
    // If this structure matches the first part of the path, search in children
    if (structure.name === pathParts[0] && structure.children) {
        if (pathParts.length === 1) {
            return structure;
        }
        
        // Search in children with remaining path
        const remainingPath = pathParts.slice(1).join('/');
        for (const child of structure.children) {
            const found = findFileInStructure(child, remainingPath);
            if (found) return found;
        }
    }
    
    // If we're at the root level, search all children
    if (structure.children) {
        for (const child of structure.children) {
            const found = findFileInStructure(child, targetPath);
            if (found) return found;
        }
    }
    
    return null;
}

async function addStructureFolderToZip(zip, folder, currentPath = '') {
    if (folder.type === 'directory' && folder.children) {
        for (const child of folder.children) {
            const childPath = currentPath ? `${currentPath}/${child.name}` : child.name;
            await addStructureFolderToZip(zip, child, childPath);
        }
    } else if (folder.type === 'file') {
        try {
            if (folder.content) {
                if (folder.encoding === 'base64') {
                    // Convert base64 back to binary
                    const binaryString = atob(folder.content);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    zip.file(currentPath, bytes);
                } else {
                    // Text content
                    zip.file(currentPath, folder.content);
                }
            } else {
                // File couldn't be read, add placeholder
                const placeholder = folder.error ? 
                    `Error reading file: ${folder.error}` : 
                    'File content not available';
                zip.file(currentPath, placeholder);
            }
        } catch (error) {
            console.warn(`Could not add file to ZIP: ${currentPath}`, error);
            zip.file(currentPath, `Error adding file: ${error.message}`);
        }
    }
}

async function viewCurrentFolderStructure() {
    if (!selectedFolderHandle) {
        showToast('No folder selected', 'error');
        return;
    }
    
    try {
        // Build the complete folder structure (same as when saving)
        const folderData = await buildCompleteFolderData(selectedFolderHandle);
        
        // Count files in the structure
        const fileCount = countFilesInStructure(folderData);
        
        // Create a version-like object for the modal
        const currentVersion = {
            id: 'current',
            folder_name: selectedFolderHandle.name,
            created_at: new Date().toISOString(),
            file_count: fileCount,
            comment: 'Currently selected folder (live view)',
            folder_structure: folderData
        };
        
        // Use the same modal as saved versions
        showFolderStructureModal(currentVersion);
        
    } catch (error) {
        console.error('Error reading current folder structure:', error);
        showToast('Error reading folder structure', 'error');
    }
}

function countFilesInStructure(structure) {
    if (!structure) return 0;
    
    if (structure.type === 'file') {
        return 1;
    }
    
    if (structure.type === 'directory' && structure.children) {
        return structure.children.reduce((count, child) => {
            return count + countFilesInStructure(child);
        }, 0);
    }
    
    return 0;
}

async function findFileHandleInFolder(rootHandle, targetPath) {
    const pathParts = targetPath.split('/').filter(part => part.length > 0);
    
    let currentHandle = rootHandle;
    
    // Navigate through the path, except for the last part (which is the file)
    for (let i = 0; i < pathParts.length - 1; i++) {
        const folderName = pathParts[i];
        let found = false;
        
        for await (const [name, handle] of currentHandle.entries()) {
            if (name === folderName && handle.kind === 'directory') {
                currentHandle = handle;
                found = true;
                break;
            }
        }
        
        if (!found) {
            throw new Error(`Folder "${folderName}" not found in path`);
        }
    }
    
    // Find the final file
    const fileName = pathParts[pathParts.length - 1];
    
    for await (const [name, handle] of currentHandle.entries()) {
        if (name === fileName && handle.kind === 'file') {
            return handle;
        }
    }
    
    return null;
}

async function findFolderHandleInFolder(rootHandle, targetPath) {
    if (!targetPath || targetPath === rootHandle.name) {
        return rootHandle;
    }
    
    const pathParts = targetPath.split('/').filter(part => part.length > 0);
    
    let currentHandle = rootHandle;
    
    // Navigate through all path parts for folder
    for (const folderName of pathParts) {
        let found = false;
        
        for await (const [name, handle] of currentHandle.entries()) {
            if (name === folderName && handle.kind === 'directory') {
                currentHandle = handle;
                found = true;
                break;
            }
        }
        
        if (!found) {
            throw new Error(`Folder "${folderName}" not found in path`);
        }
    }
    
    return currentHandle;
}

function showHelpModal() {
    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'help-modal-overlay';
    modal.innerHTML = `
        <div class="help-modal">
            <div class="help-modal-header">
                <h3>How the Folder Manager Works</h3>
                <button class="help-modal-close">&times;</button>
            </div>
            <div class="help-modal-content">
                <h3>Overview</h3>
                <p>The Folder Manager lets you save and organize different versions of your work folders. This is useful for backing up your progress, tracking changes, and making sure you don't lose important files if something goes wrong.</p>

                <h3>Why Use This Feature?</h3>
                <ul>
                    <li><strong>Version Safety:</strong> Save snapshots of your folders as you work, so you can always go back to a previous state.</li>
                    <li><strong>Easy Recovery:</strong> If you make a mistake or lose files, you can restore from a saved version.</li>
                    <li><strong>Organization:</strong> Keep your work organized by project and version, with comments to describe each change.</li>
                </ul>

                <h3>Important Notes & Limitations</h3>
                <ul>
                    <li><strong>Browser Support:</strong> This feature only works in Chrome, Edge, or Opera (version 86+). Other browsers like Firefox and Safari do not support the required folder access.</li>
                    <li><strong>Large Folders:</strong> If your folder is very large, the browser may run out of memory. In that case, try saving or downloading a smaller subfolder instead.</li>
                </ul>

                <h3>How to Save a Folder Version</h3>
                <h4>1. Create or Select a Project</h4>
                <p>You can create a new project to group related folder versions, or select an existing project from the list. Projects help you keep different work areas separate (for example, "Website Redesign" or "Research Papers").</p>

                <h4>2. Select a Folder</h4>
                <p>Click the "Select Folder" button and choose the folder you want to save. The browser will ask for permission to access your files.</p>

                <h4>3. Add a Comment</h4>
                <p>Before saving, you can add a comment describing what changed in this version. This makes it easier to find the right version later.</p>

                <h4>4. Save the Version</h4>
                <p>Click "Save Folder Version" to create a snapshot of your folder. The version will appear in the version history for your project.</p>

                <h3>What You Can Do With Saved Versions</h3>
                <ul>
                    <li><strong>View Version History:</strong> See all saved versions for your project, with timestamps and comments.</li>
                    <li><strong>View Structure:</strong> Open a detailed view of the folder structure for any version. You can browse the files and subfolders in an interactive tree.</li>
                    <li><strong>Download Individual Files:</strong> Download any file from a saved version directly from the structure view.</li>
                    <li><strong>Download as ZIP:</strong> Download the entire folder or any subfolder as a ZIP file.</li>
                    <li><strong>Download as JSON:</strong> Download the folder structure and metadata as a JSON file for advanced use.</li>
                </ul>

                <h3>Managing Projects</h3>
                <ul>
                    <li><strong>Rename Projects:</strong> You can rename any project to keep your workspace organized.</li>
                    <li><strong>Delete Projects:</strong> Remove projects you no longer need. This will also delete all saved versions within that project.</li>
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

async function downloadFolderVersion(versionId) {
    try {
        // Use the global API_BASE_URL from app.js
        const url = API_BASE_URL ? `${API_BASE_URL}/api/folder-versions/${versionId}/download` : `/api/folder-versions/${versionId}/download`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const blob = await response.blob();
        
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `folder-version-${versionId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        
        showToast('Folder structure downloaded', 'success');
        
    } catch (error) {
        console.error('Error downloading folder version:', error);
        showToast('Error downloading folder version', 'error');
    }
}

async function downloadFolderVersionZip(versionId) {
    try {
        // Use the global API_BASE_URL from app.js
        const url = API_BASE_URL ? `${API_BASE_URL}/api/folder-versions/${versionId}/download-zip` : `/api/folder-versions/${versionId}/download-zip`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            if (data.error && data.error.includes('before file contents were supported')) {
                showToast('This version only contains folder structure. Use "Download JSON" instead.', 'warning');
            } else {
                throw new Error(data.error || 'Failed to get folder data');
            }
            return;
        }
        
        // Check if JSZip is available
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library not loaded');
        }
        
        showToast('Creating ZIP file...', 'info');
        
        const zip = new JSZip();
        const folderName = data.folder_name;
        
        // Add all files from saved structure to ZIP
        await addSavedFolderToZip(zip, data.folder_structure, folderName);
        
        // Generate ZIP file
        const content = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        
        // Download ZIP
        const downloadUrl = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${folderName}-version-${versionId}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        
        showToast(`ZIP file "${folderName}-version-${versionId}.zip" downloaded successfully`, 'success');
        
    } catch (error) {
        console.error('Error downloading folder version as ZIP:', error);
        showToast('Error creating ZIP file: ' + error.message, 'error');
    }
}

async function addSavedFolderToZip(zip, structure, currentPath = '') {
    if (structure.type === 'directory' && structure.children) {
        for (const child of structure.children) {
            const childPath = currentPath ? `${currentPath}/${child.name}` : child.name;
            await addSavedFolderToZip(zip, child, childPath);
        }
    } else if (structure.type === 'file') {
        try {
            if (structure.content) {
                if (structure.encoding === 'base64') {
                    // Convert base64 back to binary
                    const binaryString = atob(structure.content);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    zip.file(currentPath, bytes);
                } else {
                    // Text content
                    zip.file(currentPath, structure.content);
                }
            } else {
                // File couldn't be read, add placeholder
                const placeholder = structure.error ? 
                    `Error reading file: ${structure.error}` : 
                    'File content not available';
                zip.file(currentPath, placeholder);
            }
        } catch (error) {
            console.warn(`Could not add file to ZIP: ${currentPath}`, error);
            zip.file(currentPath, `Error adding file: ${error.message}`);
        }
    }
}

async function downloadCurrentFolderAsZip() {
    if (!selectedFolderHandle) {
        showToast('Please select a folder first', 'error');
        return;
    }
    
    const zipBtn = document.getElementById('downloadZipBtn');
    const originalText = zipBtn.textContent;
    
    try {
        zipBtn.disabled = true;
        zipBtn.textContent = 'Creating ZIP...';
        
        // Check if JSZip is available
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library not loaded');
        }
        
        const zip = new JSZip();
        const folderName = selectedFolderHandle.name;
        
        // Add all files to ZIP
        await addFolderToZip(zip, selectedFolderHandle, folderName);
        
        zipBtn.textContent = 'Generating ZIP...';
        
        // Generate ZIP file
        const content = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        
        // Download ZIP
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${folderName}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast(`ZIP file "${folderName}.zip" downloaded successfully`, 'success');
        
    } catch (error) {
        console.error('Error creating ZIP:', error);
        showToast('Error creating ZIP file: ' + error.message, 'error');
    } finally {
        zipBtn.disabled = false;
        zipBtn.textContent = originalText;
    }
}

async function addFolderToZip(zip, dirHandle, currentPath = '') {
    try {
        for await (const [name, handle] of dirHandle.entries()) {
            // Skip hidden files/folders
            if (name.startsWith('.')) continue;
            
            const fullPath = currentPath ? `${currentPath}/${name}` : name;
            
            if (handle.kind === 'directory') {
                // Recursively add subdirectory
                await addFolderToZip(zip, handle, fullPath);
            } else {
                // Add file to ZIP
                try {
                    const file = await handle.getFile();
                    const arrayBuffer = await file.arrayBuffer();
                    zip.file(fullPath, arrayBuffer);
                } catch (error) {
                    console.warn(`Could not read file: ${fullPath}`, error);
                    // Add a placeholder for files that can't be read
                    zip.file(fullPath, `Error reading file: ${error.message}`);
                }
            }
        }
    } catch (error) {
        console.warn(`Could not read directory: ${dirHandle.name}`, error);
    }
}

function showFolderProjectContextMenu(event, projectName) {
    const contextMenu = document.getElementById('folderProjectContextMenu');
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${event.pageX}px`;
    contextMenu.style.top = `${event.pageY}px`;

    document.getElementById('renameFolderProjectBtn').onclick = () => {
        contextMenu.style.display = 'none';
        handleRenameFolderProject(projectName);
    };

    document.getElementById('deleteFolderProjectBtn').onclick = () => {
        contextMenu.style.display = 'none';
        handleDeleteFolderProject(projectName);
    };
}

async function handleRenameFolderProject(oldName) {
    const newName = prompt(`Enter new name for project "${oldName}":`, oldName);
    
    if (newName && newName.trim() !== '' && newName.trim() !== oldName) {
        try {
            const response = await apiCall(`/api/folder-projects/${encodeURIComponent(oldName)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_name: newName.trim() })
            });

            if (response.success) {
                showToast('Project renamed successfully!', 'success');
                await loadFolderProjects();
                // If the renamed project was the current one, select it with the new name
                if (currentProject === oldName) {
                    selectProject(newName.trim());
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

async function handleDeleteFolderProject(projectName) {
    const confirmation = confirm(`Are you sure you want to delete the project "${projectName}" and all its folder versions? This action cannot be undone.`);
    
    if (confirmation) {
        try {
            const response = await apiCall(`/api/folder-projects/${encodeURIComponent(projectName)}`, {
                method: 'DELETE'
            });

            if (response.success) {
                showToast('Project deleted successfully!', 'success');
                // If the deleted project was the current one, clear the view
                if (currentProject === projectName) {
                    currentProject = null;
                    document.getElementById('folderProjectSelect').value = '';
                    document.getElementById('folderHistoryContainer').innerHTML = '';
                }
                await loadFolderProjects();
                updateSubmitButton();
            } else {
                showToast(response.error || 'Failed to delete project', 'error');
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            showToast('An error occurred while deleting the project.', 'error');
        }
    }
} 