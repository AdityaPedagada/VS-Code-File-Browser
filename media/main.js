(function() {
    const vscode = acquireVsCodeApi();
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

    // Restore state
    const state = vscode.getState() || {};
    currentSortOption = state.sortOption || 'name';
    sortDirection = state.sortDirection || 'asc';
    currentSearchQuery = state.searchQuery || '';
    isGridView = state.isGridView !== undefined ? state.isGridView : true;

    toggleViewButton.className = `codicon ${isGridView ? 'codicon-list-flat' : 'codicon-grid'}`;
    searchBox.value = currentSearchQuery;

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'updateFiles':
                allFiles = message.files;
                updateFileView(message.files);
                currentPath = message.path;
                currentPathInput.value = currentPath;
                saveState();
                break;
            case 'updateSuggestions':
                updateSuggestions(message.suggestions);
                break;
            case 'updateSearchResults':
                updateFileView(message.results);
                break;
        }
    });

    function saveState() {
        vscode.setState({
            sortOption: currentSortOption,
            sortDirection: sortDirection,
            searchQuery: currentSearchQuery,
            isGridView: isGridView
        });
    }

    function updateSortButtonText() {
        let className = `codicon codicon-arrow-small-${sortDirection === 'asc' ?  'down': 'up' }`
        sortButton.innerHTML = `
            <i class="${className}"></i>
        `;
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
        
        sortDirectionButton.textContent = sortDirection === 'asc' ? 'Ascending' : 'Descending';
        sortDirectionButton.className = `${className}`;
    }

    function updateSortMenu() {
        sortOptions.forEach(option => {
            const sortType = option.dataset.sort;
            option.innerHTML = `
                ${sortType.charAt(0).toUpperCase() + sortType.slice(1)}
                ${currentSortOption === sortType ? '<i class="codicon codicon-check"></i>' : '<i class="codicon codicon-blank"></i>'}
            `;
        });
    }

    sortOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            currentSortOption = e.target.dataset.sort;
            updateSortMenu();
            updateSortButtonIcons();
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
    
        const actions = ['Open', 'Copy', 'Cut', 'Paste', 'Delete', 'Rename', 'Properties'];
        if (file.isDirectory) {
            actions.push('New Folder', 'New File');
        }

        actions.push('Sort');
        
        actions.forEach(action => {
            const actionItem = document.createElement('div');
            actionItem.textContent = action;
            if (action === 'Sort') {
                const sortSubMenu = createSortSubMenu();
                actionItem.appendChild(sortSubMenu);
            } else {
                actionItem.addEventListener('click', () => {
                    let command = action.toLowerCase().replace(' ', '');
                    vscode.postMessage({ command: 'performFileAction', action: command, path: `${currentPath}/${file.name}` });
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
            const optionLower = option.toLowerCase().replace(' ', '');

            sortItem.className = 'sort-submenu-item';
            sortItem.innerHTML = `
                ${option}
                <i class="codicon ${currentSortOption === optionLower ? 'codicon-check' : 'codicon-blank'}"></i>
            `;
            sortItem.addEventListener('click', (e) => {
                e.stopPropagation();
                currentSortOption = optionLower;
                updateContextMenuSortOptions(sortSubMenu);
                updateFileView(allFiles);
                saveState();
            });
            sortSubMenu.appendChild(sortItem);
        });

        const directionItem = document.createElement('div');
        directionItem.className = 'sort-submenu-item';
        directionItem.innerHTML = `
            ${sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            <i class="codicon codicon-arrow-small-${sortDirection === 'asc' ? 'up' : 'down'}"></i>
        `;
        directionItem.addEventListener('click', (e) => {
            e.stopPropagation();
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            updateContextMenuSortDirection(directionItem);
            updateFileView(allFiles);
            saveState();
        });
        sortSubMenu.appendChild(directionItem);

        return sortSubMenu;
    }

    function updateContextMenuSortOptions(sortSubMenu) {
        const sortItems = sortSubMenu.querySelectorAll('.sort-submenu-item');
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

    function updateContextMenuSortDirection(directionItem) {
        directionItem.innerHTML = `
            ${sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            <i class="codicon codicon-arrow-small-${sortDirection === 'asc' ? 'up' : 'down'}"></i>
        `;
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
        toggleViewButton.className = `codicon ${isGridView ? 'codicon-list-flat' : 'codicon-grid'}`;
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
        fileElement.addEventListener('click', () => {
            if (file.isDirectory) {
                vscode.postMessage({ command: 'loadDirectory', path: `${currentPath}/${file.name}` });
            } else {
                vscode.postMessage({ command: 'performFileAction', action: 'open', path: `${currentPath}/${file.name}` });
            }
        });

        fileElement.addEventListener('contextmenu', (e) => {
            showContextMenu(e, file);
        });
    }

    document.getElementById('new-file').addEventListener('click', () => {
        vscode.postMessage({ command: 'performFileAction', action: 'newFile', path: currentPath });
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
    
        const actions = ['New Folder', 'New File'];
        actions.forEach(action => {
            const actionItem = document.createElement('div');
            actionItem.textContent = action;
            actionItem.addEventListener('click', () => {
                let command = action.toLowerCase().replace(' ', '');
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

    fileContainer.addEventListener('contextmenu', (e) => {
        if (e.target === fileContainer) {
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
        let path = currentPathInput.value;
        if (!path.endsWith(path.sep)) {
            path += path.sep;
        }
        vscode.postMessage({ command: 'loadDirectory', path: path });
    });

    backButton.addEventListener('click', () => {
        const parentPath = currentPath.split(/[/\\]/).slice(0, -1).join('/') || '/';
        vscode.postMessage({ command: 'loadDirectory', path: parentPath });
    });

    toggleViewButton.addEventListener('click', () => {
        isGridView = !isGridView;
        toggleViewButton.className = `codicon ${isGridView ? 'codicon-list-flat' : 'codicon-layout'}`;
        vscode.postMessage({ command: 'loadDirectory', path: currentPath });
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
    updateSortButtonText();
    updateSortDirectionButton();
})();