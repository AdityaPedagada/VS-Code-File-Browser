(function() {
    const vscode = acquireVsCodeApi();
    const fileSpace = document.getElementById('file-space');
    const fileContainer = document.getElementById('file-container');
    const currentPathInput = document.getElementById('current-path');
    const goButton = document.getElementById('go-button');
    const backButton = document.getElementById('back-button');
    const toggleViewButton = document.getElementById('toggle-view');
    const searchBox = document.getElementById('search-box');
    const sortButton = document.getElementById('sort-button');
    const sortOptions = document.querySelectorAll('.sort-option');
    const sortDirectionButton = document.getElementById('sort-direction');

    let currentPath = '';
    let isGridView = true;
    let currentContextMenu = null;
    let allFiles = [];
    let currentSuggestionIndex = -1;
    let suggestionList = null;
    let currentSortOption = 'name';
    let sortDirection = 'asc';
    let currentSearchQuery = '';
    let platform;
    let pathSeparator = '/';

    // Helper function to join paths properly
    function joinPath(base, name) {
        const sep = base.includes('\\') ? '\\' : '/';
        return base.endsWith(sep) ? base + name : base + sep + name;
    }

    // Restore state
    const state = vscode.getState() || {};
    currentSortOption = state.sortOption || 'name';
    sortDirection = state.sortDirection || 'asc';
    currentSearchQuery = state.searchQuery || '';
    isGridView = state.isGridView !== undefined ? state.isGridView : true;

    toggleViewButton.className = `codicon ${isGridView ? 'codicon-list-flat' : 'codicon-layout'}`;
    searchBox.value = currentSearchQuery;

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'updateFiles':
                allFiles = message.files;
                updateFileView(message.files);
                // Normalize path - remove trailing separator for consistency
                const sep = message.path.includes('\\') ? '\\' : '/';
                currentPath = message.path.endsWith(sep) && message.path.length > 1
                    ? message.path.slice(0, -1)
                    : message.path;
                currentPathInput.value = currentPath;
                platform = message.platform;
                saveState();
                break;
            case 'updateSuggestions':
                updateSuggestions(message.suggestions);
                break;
            case 'updateSearchResults':
                updateFileView(message.results);
                break;
            case 'showLoading':
                showLoadingModal(message.message);
                break;
            case 'updateLoadingProgress':
                updateLoadingProgress(message.message);
                break;
            case 'hideLoading':
                hideLoadingModal();
                break;
            case 'enterSearchMode':
                enterSearchMode(message.query, message.directory);
                break;
            case 'addSearchResult':
                addSearchResult(message.file);
                break;
            case 'updateSearchProgress':
                updateSearchProgress(message.processed, message.found);
                break;
            case 'searchComplete':
                searchComplete(message.totalFound);
                break;
            case 'searchCancelled':
                searchCancelled();
                break;
        }
    });

    // Loading modal functions
    let loadingModal = null;

    function showLoadingModal(message) {
        if (loadingModal) {
            loadingModal.remove();
        }

        loadingModal = document.createElement('div');
        loadingModal.id = 'loading-modal';
        loadingModal.innerHTML = `
            <div class="loading-overlay"></div>
            <div class="loading-content">
                <button class="loading-close-btn" title="Close (calculation will continue)">X</button>
                <div class="loading-spinner"></div>
                <p class="loading-message">${message}</p>
                <p class="loading-progress"></p>
            </div>
        `;

        // Add close button handler - only closes modal, doesn't stop calculation
        const closeBtn = loadingModal.querySelector('.loading-close-btn');
        closeBtn.addEventListener('click', () => {
            hideLoadingModal();
        });

        document.body.appendChild(loadingModal);
    }

    function updateLoadingProgress(message) {
        if (loadingModal) {
            const progressEl = loadingModal.querySelector('.loading-progress');
            if (progressEl) {
                progressEl.textContent = message;
            }
        }
    }

    function hideLoadingModal() {
        if (loadingModal) {
            loadingModal.remove();
            loadingModal = null;
        }
    }

    // Search mode variables
    let isSearchMode = false;
    let searchResults = [];
    let searchDirectory = '';
    let searchQuery = '';

    // Search mode functions
    function enterSearchMode(query, directory) {
        isSearchMode = true;
        searchResults = [];
        searchQuery = query;
        searchDirectory = directory;

        // Hide toolbar, show search header (but NOT progress bar yet)
        document.getElementById('toolbar').style.display = 'none';
        document.getElementById('search-header').style.display = 'flex';
        document.getElementById('search-progress-container').style.display = 'none';

        // Show cancel button, hide submit button while idle
        const cancelBtn = document.getElementById('global-search-cancel');
        const submitBtn = document.getElementById('global-search-submit');
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'flex';

        // Initialize sort direction button text
        const searchSortDirection = document.getElementById('search-sort-direction');
        if (searchSortDirection) {
            searchSortDirection.textContent = sortDirection === 'asc' ? 'Ascending' : 'Descending';
        }

        // Update progress text
        const progressText = document.getElementById('search-progress-text');
        if (progressText) {
            progressText.textContent = 'Enter search query and press Enter';
        }

        // Clear file container
        fileContainer.innerHTML = '';
    }

    // Render search results with sorting and view mode
    function renderSearchResults() {
        // Clear file container
        fileContainer.innerHTML = '';

        if (searchResults.length === 0) {
            fileContainer.innerHTML = '<div class="no-results">No files found</div>';
            return;
        }

        // Sort the results
        const sortedResults = sortFiles([...searchResults]);

        // Render each result
        sortedResults.forEach(file => {
            const fileElement = isGridView ? createGridItem(file) : createListItem(file);
            fileContainer.appendChild(fileElement);
        });
    }

    function addSearchResult(file) {
        searchResults.push(file);

        // Remove the "Searching..." message if it exists
        const statusEl = fileContainer.querySelector('.search-status');
        if (statusEl) {
            statusEl.remove();
        }

        // Add the result
        const fileElement = isGridView ? createGridItem(file) : createListItem(file);
        fileContainer.appendChild(fileElement);
    }

    function updateSearchProgress(processed, found) {
        const progressBar = document.getElementById('search-progress-bar');
        const progressText = document.getElementById('search-progress-text');

        if (progressBar && progressText) {
            progressText.textContent = 'Processed ' + processed + ' items, found ' + found + ' matches...';
        }
    }

    function searchComplete(totalFound) {
        // Don't set isSearchMode to false here - we're still in search mode showing results
        // Only exit search mode when user explicitly exits or clicks a folder

        // Show idle state - submit button visible
        showIdleState();

        const progressContainer = document.getElementById('search-progress-container');
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }

        if (searchResults.length === 0) {
            fileContainer.innerHTML = '<div class="no-results">No files found matching "' + searchQuery + '"</div>';
        }
    }

    function searchCancelled() {
        // Don't set isSearchMode to false here - let exitSearchMode handle it
        // isSearchMode will be set to false when user actually exits

        // Show idle state - submit button visible
        showIdleState();

        const progressContainer = document.getElementById('search-progress-container');
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
    }

    function exitSearchMode() {
        isSearchMode = false;

        // Show toolbar, hide search header
        document.getElementById('toolbar').style.display = 'flex';
        document.getElementById('search-header').style.display = 'none';
        document.getElementById('search-progress-container').style.display = 'none';

        // Reload current directory
        vscode.postMessage({ command: 'loadDirectory', path: currentPath });
    }

    // Global search event listeners
    const globalSearchButton = document.getElementById('global-search');
    const searchBackButton = document.getElementById('search-back-button');
    const globalSearchSubmit = document.getElementById('global-search-submit');
    const globalSearchCancel = document.getElementById('global-search-cancel');
    const globalSearchBox = document.getElementById('global-search-box');
    const searchToggleViewButton = document.getElementById('search-toggle-view');
    const searchSortButton = document.getElementById('search-sort-button');

    // Toggle view button in search screen
    if (searchToggleViewButton) {
        searchToggleViewButton.addEventListener('click', () => {
            isGridView = !isGridView;
            searchToggleViewButton.className = `codicon ${isGridView ? 'codicon-list-flat' : 'codicon-layout'}`;
            // Re-render search results with new view
            if (searchResults.length > 0) {
                renderSearchResults();
            }
        });
    }

    // Sort button in search screen
    if (searchSortButton) {
        searchSortButton.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Sort options in search screen
    const searchSortOptions = document.querySelectorAll('#search-header .sort-option');
    searchSortOptions.forEach(option => {
        option.addEventListener('click', () => {
            const sortType = option.getAttribute('data-sort');
            if (currentSortOption === sortType) {
                // Toggle direction if same option clicked
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortOption = sortType;
                sortDirection = 'asc';
            }
            // Update sort direction button text
            const searchSortDirection = document.getElementById('search-sort-direction');
            if (searchSortDirection) {
                searchSortDirection.textContent = sortDirection === 'asc' ? 'Ascending' : 'Descending';
            }
            // Re-render search results with new sort
            if (searchResults.length > 0) {
                renderSearchResults();
            }
        });
    });

    // Sort direction in search screen
    const searchSortDirection = document.getElementById('search-sort-direction');
    if (searchSortDirection) {
        searchSortDirection.addEventListener('click', () => {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            searchSortDirection.textContent = sortDirection === 'asc' ? 'Ascending' : 'Descending';
            if (searchResults.length > 0) {
                renderSearchResults();
            }
        });
    }

    if (globalSearchButton) {
        globalSearchButton.addEventListener('click', () => {
            enterSearchMode('', currentPath);
            document.getElementById('global-search-box').focus();
        });
    }

    if (searchBackButton) {
        searchBackButton.addEventListener('click', () => {
            vscode.postMessage({ command: 'exitSearchMode' });
            exitSearchMode();
        });
    }

    // Show searching state - cancel button visible, submit hidden, progress bar visible
    function showSearchingState() {
        const cancelBtn = document.getElementById('global-search-cancel');
        const submitBtn = document.getElementById('global-search-submit');
        const progressText = document.getElementById('search-progress-text');
        const progressContainer = document.getElementById('search-progress-container');
        if (cancelBtn) cancelBtn.style.display = 'flex';
        if (submitBtn) submitBtn.style.display = 'none';
        if (progressContainer) progressContainer.style.display = 'flex';
        if (progressText) progressText.textContent = 'Searching...';
    }

    // Show idle state - submit button visible, cancel hidden, progress bar hidden
    function showIdleState() {
        const cancelBtn = document.getElementById('global-search-cancel');
        const submitBtn = document.getElementById('global-search-submit');
        const progressContainer = document.getElementById('search-progress-container');
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'flex';
        if (progressContainer) progressContainer.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'flex';
    }

    if (globalSearchSubmit) {
        globalSearchSubmit.addEventListener('click', () => {
            const query = globalSearchBox.value.trim();
            if (query) {
                showSearchingState();
                vscode.postMessage({ command: 'startSearch', query: query, directory: currentPath });
            }
        });
    }

    if (globalSearchCancel) {
        globalSearchCancel.addEventListener('click', () => {
            vscode.postMessage({ command: 'cancelSearch' });
        });
    }

    if (globalSearchBox) {
        globalSearchBox.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = globalSearchBox.value.trim();
                if (query) {
                    showSearchingState();
                    vscode.postMessage({ command: 'startSearch', query: query, directory: currentPath });
                }
            }
        });
    }

    function saveState() {
        vscode.setState({
            sortOption: currentSortOption,
            sortDirection: sortDirection,
            searchQuery: currentSearchQuery,
            isGridView: isGridView
        });
    }


    function updateFileView(files) {
        const sortedFiles = sortFiles(files);

        fileContainer.innerHTML = '';
        if (sortedFiles.length === 0) {
            fileContainer.innerHTML = '<div class="no-results">No files found</div>';
            return;
        }
        const viewMethod = isGridView ? createGridItem : createListItem;
        sortedFiles.forEach(file => {
            const fileElement = viewMethod(file);
            fileContainer.appendChild(fileElement);
        });
    }

    function createGridItem(file) {
        const fileElement = document.createElement('div');
        fileElement.className = 'file-item grid-item';
        const iconClass = getFileIconClass(file);
        fileElement.innerHTML = `
            <i class="codicon ${iconClass}"></i>
            <span class="file-name">${file.name}</span>
            <span class="file-details">
                <span class="file-type">${file.type}</span>
                <span class="file-size">${formatFileSize(file.size)}</span>
                <span class="file-date">${new Date(file.lastModified).toLocaleString()}</span>
            </span>
        `;
        addFileEventListeners(fileElement, file);
        return fileElement;
    }

    function createListItem(file) {
        const fileElement = document.createElement('div');
        fileElement.className = 'file-item list-item';
        const iconClass = getFileIconClass(file);
        fileElement.innerHTML = `
            <i class="codicon ${iconClass}"></i>
            <span class="file-name">${file.name}</span>
            <span class="file-details">
                <span class="file-type">${file.type}</span>
                <span class="file-size">${formatFileSize(file.size)}</span>
                <span class="file-date">${new Date(file.lastModified).toLocaleString()}</span>
            </span>
        `;
        addFileEventListeners(fileElement, file);
        return fileElement;
    }

    function getFileIconClass(file) {
        if (file.isDirectory) {
            return 'codicon-folder';
        }
        // Add more file type checks here
        const extension = file.name.split('.').pop().toLowerCase();
        switch (extension) {
            // case 'js': return 'codicon-file-code';
            // case 'ts': return 'codicon-file-code';
            // case 'json': return 'codicon-file-json';
            // case 'md': return 'codicon-file-markdown';
            // case 'html': return 'codicon-file-html';
            // case 'css': return 'codicon-file-css';
            // case 'pdf': return 'codicon-file-pdf';
            case 'zip': case 'rar': case '7z': return 'codicon-file-zip';
            default: return 'codicon-file';
        }
    }

    function sortFiles(files) {
        return files.sort((a, b) => {
            let compareResult;
            switch (currentSortOption) {
                case 'name':
                    compareResult = a.name.localeCompare(b.name);
                    break;
                case 'modified':
                    compareResult = new Date(b.lastModified) - new Date(a.lastModified);
                    break;
                case 'type':
                    const extA = a.name.split('.').pop().toLowerCase();
                    const extB = b.name.split('.').pop().toLowerCase();
                    compareResult = extA.localeCompare(extB);
                    break;
                case 'size':
                    compareResult = a.size - b.size;
                    break;
                default:
                    compareResult = 0;
            }
            return sortDirection === 'asc' ? compareResult : -compareResult;
        });
    }

    function updateSortButtonIcons() {
        let className = `codicon codicon-arrow-small-${sortDirection === 'asc' ?  'down': 'up' }`
        sortButton.innerHTML = `
            <i class="${className}"></i>
        `;
        
        sortDirectionButton.innerHTML = `
                ${sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                <i class="${className}"></i>
            `;
    }

    function updateSortMenu() {
        sortOptions.forEach(option => {
            const sortType = option.dataset.sort;
            option.innerHTML = `
                ${sortType.charAt(0).toUpperCase() + sortType.slice(1)}
                ${currentSortOption === sortType ? '<i class="codicon codicon-check"></i>' : ''}
            `;
        });
    }

    sortOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            currentSortOption = e.target.dataset.sort;
            updateSortMenu();
            updateFileView(allFiles);
            saveState();
        });
    });

    sortDirectionButton.addEventListener('click', () => {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        updateSortButtonIcons();
        updateFileView(allFiles);
        saveState();
    });

    function showContextMenu(e, file) {
        e.preventDefault();
        
        if (currentContextMenu) {
            document.body.removeChild(currentContextMenu);
        }
    
        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.style.position = 'absolute';
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.top = `${e.pageY}px`;
    
        const actions = ['Open', 'Open in New Window', 'Copy', 'Cut', 'Paste', 'Delete', 'Rename', 'Properties'];
        if (file.isDirectory) {
            actions.push('New Folder', 'New File');
        }
        if (platform === 'win32' || platform === 'darwin') {
            actions.splice(2, 0, 'Open in Explorer');
        }

        actions.push('Sort');
        
        actions.forEach(action => {
            const actionItem = document.createElement('div');
            actionItem.textContent = action;
            actionItem.className = 'context-menu-item'
            if (action === 'Sort') {
                const sortSubMenu = createSortSubMenu();
                actionItem.appendChild(sortSubMenu);
            } else {
                actionItem.addEventListener('click', () => {
                    let command = action.toLowerCase().replaceAll(' ', '');
                    // Use file.path if available (from search results), otherwise construct from currentPath
                    const filePath = file.path || joinPath(currentPath, file.name);
                    vscode.postMessage({ command: 'performFileAction', action: command, path: filePath });
                    document.body.removeChild(contextMenu);
                    currentContextMenu = null;
                });
            }
            contextMenu.appendChild(actionItem);
        });
    
        document.body.appendChild(contextMenu);
        currentContextMenu = contextMenu;
    
        function removeContextMenu(event) {
            if (!contextMenu.contains(event.target)) {
                document.body.removeChild(contextMenu);
                currentContextMenu = null;
                document.removeEventListener('click', removeContextMenu);
            }
        }
    
        setTimeout(() => {
            document.addEventListener('click', removeContextMenu);
        }, 0);
    }
    
    function createSortSubMenu() {
        const sortSubMenu = document.createElement('div');
        sortSubMenu.className = 'sort-submenu';
        
        const sortOptions = ['Name', 'Modified', 'Type', 'Size'];
        sortOptions.forEach(option => {
            const sortItem = document.createElement('div');
            const optionLower = option.toLowerCase().replaceAll(' ', '');

            sortItem.className = 'sort-submenu-item sort-submenu-option-item';
            sortItem.innerHTML = `
                ${option}
                <i class="codicon ${currentSortOption === optionLower ? 'codicon-check' : 'codicon-blank'}"></i>
            `;
            sortItem.addEventListener('click', (e) => {
                e.stopPropagation();
                currentSortOption = optionLower;
                updateSortMenu();
                updateContextMenuSortOptions(sortSubMenu);
                updateFileView(allFiles);
                saveState();
            });
            sortSubMenu.appendChild(sortItem);
        });

        const directionItem = document.createElement('div');
        directionItem.className = 'sort-submenu-item sort-submenu-direction-item';
        directionItem.innerHTML = `
            ${sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            <i class="codicon codicon-arrow-small-${sortDirection === 'asc' ? 'down' : 'up' }"></i>
        `;
        directionItem.addEventListener('click', (e) => {
            e.stopPropagation();
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            updateSortButtonIcons();
            updateContextMenuSortDirection();
            updateFileView(allFiles);
            saveState();
        });
        sortSubMenu.appendChild(directionItem);

        return sortSubMenu;
    }

    function updateContextMenuSortOptions(sortSubMenu) {
        const sortItems = sortSubMenu.querySelectorAll('.sort-submenu-option-item');
        sortItems.forEach(item => {
            const option = item.textContent.trim().toLowerCase();
            const icon = item.querySelector('.codicon');
            if (option === currentSortOption) {
                icon.className = 'codicon codicon-check';
            } else {
                icon.className = 'codicon codicon-blank';
            }
        });
    }

    function updateContextMenuSortDirection() {
        const sortSubMenus = currentContextMenu.querySelectorAll('.sort-submenu');
        sortSubMenus.forEach(sortSubMenu => {
            const sortItems = sortSubMenu.querySelectorAll('.sort-submenu-direction-item');
            sortItems.forEach(directionItem => {
                directionItem.innerHTML = `
                    ${sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                    <i class="codicon codicon-arrow-small-${sortDirection === 'asc' ? 'down' : 'up' }"></i>
                `;
            });
        });
    }

    searchBox.addEventListener('input', () => {
        currentSearchQuery = searchBox.value.toLowerCase();
        if (currentSearchQuery === '') {
            updateFileView(allFiles);
        } else {
            const filteredFiles = allFiles.filter(file => 
                file.name.toLowerCase().includes(currentSearchQuery)
            );
            updateFileView(filteredFiles);
        }
        saveState();
    });

    toggleViewButton.addEventListener('click', () => {
        isGridView = !isGridView;
        toggleViewButton.className = `codicon ${isGridView ? 'codicon-list-flat' : 'codicon-layout'}`;
        updateFileView(allFiles);
        saveState();
    });

    searchBox.addEventListener('input', () => {
        const query = searchBox.value.toLowerCase();
        if (query === '') {
            updateFileView(allFiles);
        } else {
            const filteredFiles = allFiles.filter(file => 
                file.name.toLowerCase().includes(query)
            );
            updateFileView(filteredFiles);
        }
    });


    function addFileEventListeners(fileElement, file) {
        // Use file.path if available (from search results), otherwise construct from currentPath
        const filePath = file.path || joinPath(currentPath, file.name);

        fileElement.addEventListener('click', () => {
            if (file.isDirectory) {
                // If in search mode, switch to main header without reloading search directory
                if (isSearchMode) {
                    isSearchMode = false;
                    document.getElementById('toolbar').style.display = 'flex';
                    document.getElementById('search-header').style.display = 'none';
                    document.getElementById('search-progress-container').style.display = 'none';
                }
                // Update currentPath immediately before navigation
                currentPath = filePath;
                currentPathInput.value = currentPath;
                // Load the clicked folder
                vscode.postMessage({ command: 'loadDirectory', path: filePath });
            } else {
                vscode.postMessage({ command: 'performFileAction', action: 'open', path: filePath });
            }
        });

        fileElement.addEventListener('contextmenu', (e) => {
            showContextMenu(e, file);
        });
    }

    document.getElementById('new-file').addEventListener('click', () => {
        vscode.postMessage({ command: 'performFileAction', action: 'newFile', path: currentPath });
    });

    document.getElementById('new-folder').addEventListener('click', () => {
        vscode.postMessage({ command: 'performFileAction', action: 'newFolder', path: currentPath });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (currentContextMenu) {
                document.body.removeChild(currentContextMenu);
                currentContextMenu = null;
            }
            const suggestionList = document.getElementById('path-suggestions');
            if (suggestionList) {
                suggestionList.innerHTML = '';
            }
        }
    });

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    currentPathInput.addEventListener('input', () => {
        vscode.postMessage({ command: 'getDirectorySuggestions', path: currentPathInput.value });
    });

    currentPathInput.addEventListener('blur', () => {
        setTimeout(() => {
            if (suggestionList) {
                suggestionList.innerHTML = '';
            }
        }, 200);
    });

    function saveState() {
        vscode.setState({ currentPath: currentPath });
    }

    function restoreState() {
        const state = vscode.getState();
        if (state && state.currentPath) {
            currentPath = state.currentPath;
            vscode.postMessage({ command: 'loadDirectory', path: currentPath });
        } else {
            vscode.postMessage({ command: 'loadDirectory', path: '.' });
        }
    }

    function updateSuggestions(suggestions) {
        suggestionList = document.getElementById('path-suggestions');
        if (!suggestionList) {
            suggestionList = document.createElement('ul');
            suggestionList.id = 'path-suggestions';
            currentPathInput.parentNode.insertBefore(suggestionList, currentPathInput.nextSibling);
        }
        
        suggestionList.innerHTML = '';
        suggestions.forEach((suggestion, index) => {
            const li = document.createElement('li');
            li.textContent = suggestion;
            li.setAttribute('data-index', index);
            li.addEventListener('click', () => {
                selectSuggestion(index);
            });
            suggestionList.appendChild(li);
        });
        
        currentSuggestionIndex = -1;
    }

    function selectSuggestion(index) {
        const suggestions = suggestionList.getElementsByTagName('li');
        if (index >= 0 && index < suggestions.length) {
            currentSuggestionIndex = index;
            currentPathInput.value = suggestions[index].textContent;
            highlightSuggestion();
            suggestionList.innerHTML = '';
            vscode.postMessage({ command: 'loadDirectory', path: currentPathInput.value });
        }
    }

    function highlightSuggestion() {
        const suggestions = suggestionList.getElementsByTagName('li');
        for (let i = 0; i < suggestions.length; i++) {
            suggestions[i].classList.remove('selected');
        }
        if (currentSuggestionIndex >= 0 && currentSuggestionIndex < suggestions.length) {
            suggestions[currentSuggestionIndex].classList.add('selected');
            suggestions[currentSuggestionIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    function showEmptySpaceContextMenu(e) {
        e.preventDefault();
        
        if (currentContextMenu) {
            document.body.removeChild(currentContextMenu);
        }
    
        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.style.position = 'absolute';
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.top = `${e.pageY}px`;
    
        let actions = ['New Folder', 'New File', 'Paste', 'Open in New Window', ];
        if (platform === 'win32' || platform === 'darwin') {
            actions.splice(3, 0, 'Open in Explorer');
        }
        actions.forEach(action => {
            const actionItem = document.createElement('div');
            actionItem.textContent = action;
            actionItem.className = 'context-menu-item'
            actionItem.addEventListener('click', () => {
                let command = action.toLowerCase().replaceAll(' ', '');
                vscode.postMessage({ command: 'performFileAction', action: command, path: currentPath });
                document.body.removeChild(contextMenu);
                currentContextMenu = null;
            });
            contextMenu.appendChild(actionItem);
        });
    
        document.body.appendChild(contextMenu);
        currentContextMenu = contextMenu;
    
        function removeContextMenu(event) {
            if (!contextMenu.contains(event.target)) {
                document.body.removeChild(contextMenu);
                currentContextMenu = null;
                document.removeEventListener('click', removeContextMenu);
            }
        }
    
        setTimeout(() => {
            document.addEventListener('click', removeContextMenu);
        }, 0);
    }

    fileSpace.addEventListener('contextmenu', (e) => {
        if (e.target === fileSpace || e.target === fileContainer) {
            showEmptySpaceContextMenu(e);
        }
    });

    currentPathInput.addEventListener('keydown', (e) => {
        if (suggestionList && suggestionList.children.length > 0) {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    currentSuggestionIndex = Math.min(currentSuggestionIndex + 1, suggestionList.children.length - 1);
                    highlightSuggestion();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    currentSuggestionIndex = Math.max(currentSuggestionIndex - 1, -1);
                    highlightSuggestion();
                    break;
                case 'Enter':
                    e.preventDefault();
                    selectSuggestion(currentSuggestionIndex);
                    break;
                case 'Escape':
                    suggestionList.innerHTML = '';
                    break;
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const contextMenu = document.querySelector('.context-menu');
            if (contextMenu) {
                contextMenu.remove();
            }
            const suggestionList = document.getElementById('path-suggestions');
            if (suggestionList) {
                suggestionList.innerHTML = '';
            }
        }
    });

    goButton.addEventListener('click', () => {
        let path = currentPathInput.value.trim();
        const separator = path.includes('\\') ? '\\' : '/';

        // Normalize path - remove trailing separator for comparison
        let normalizedInput = path.endsWith(separator) ? path.slice(0, -1) : path;
        let normalizedCurrent = currentPath.endsWith(separator) ? currentPath.slice(0, -1) : currentPath;

        // Only add separator if the input is different from current path
        if (normalizedInput !== normalizedCurrent) {
            if (!path.endsWith(separator)) {
                path += separator;
            }
        }

        // Update currentPath immediately to prevent race conditions
        currentPath = path;
        currentPathInput.value = currentPath;

        vscode.postMessage({ command: 'loadDirectory', path: path });
    });

    backButton.addEventListener('click', () => {
        // Normalize currentPath - remove trailing separator for proper navigation
        let normalizedPath = currentPath;
        const separator = currentPath.includes('\\') ? '\\' : '/';

        // Remove trailing separator if present
        if (normalizedPath.endsWith(separator) && normalizedPath.length > 1) {
            normalizedPath = normalizedPath.slice(0, -1);
        }

        const parts = normalizedPath.split(/[/\\]/);
        let parentPath = parts.slice(0, -1).join(separator);

        // Handle Windows drive letter case: C: -> C:\
        if (parentPath.match(/^[a-zA-Z]:$/)) {
            parentPath = parentPath + separator;
        }

        // If path is empty or just a separator, stay at root
        if (!parentPath) {
            parentPath = separator;
        }

        // Update currentPath immediately to prevent race conditions
        currentPath = parentPath;
        currentPathInput.value = currentPath;

        vscode.postMessage({ command: 'loadDirectory', path: parentPath });
    });

    searchBox.addEventListener('input', () => {
        const query = searchBox.value.trim();
        if (query === '') {
            updateFileView(allFiles);
        } else {
            vscode.postMessage({ command: 'searchFiles', path: currentPath, query: query });
        }
    });

    window.addEventListener('focus', () => {
        vscode.window.showErrorMessage(`Unsupported action: On Focus`); // need to remove
        vscode.postMessage({ command: 'loadDirectory', path: currentPath });
    });

    // Load initial directory (current workspace folder or home directory)
    vscode.postMessage({ command: 'loadDirectory', path: '.' });

    restoreState();
    updateSortButtonIcons();
    updateSortMenu();
})();