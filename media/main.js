(function() {
    const vscode = acquireVsCodeApi();
    const fileContainer = document.getElementById('file-container');
    const currentPathInput = document.getElementById('current-path');
    const goButton = document.getElementById('go-button');
    const backButton = document.getElementById('back-button');
    const toggleViewButton = document.getElementById('toggle-view');
    const searchBox = document.getElementById('search-box');

    let currentPath = '';
    let isGridView = true;
    let currentContextMenu = null;
    let allFiles = [];

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'updateFiles':
                allFiles = message.files;
                updateFileView(message.files);
                currentPath = message.path;
                currentPathInput.value = currentPath;
                break;
            case 'updateSuggestions':
                updateSuggestions(message.suggestions);
                break;
            case 'updateSearchResults':
                updateFileView(message.results);
                break;
        }
    });

    function updateFileView(files) {
        fileContainer.innerHTML = '';
        if (files.length === 0) {
            fileContainer.innerHTML = '<div class="no-results">No files found</div>';
            return;
        }
        const viewMethod = isGridView ? createGridItem : createListItem;
        files.forEach(file => {
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
            case 'js': return 'codicon-file-code';
            case 'ts': return 'codicon-file-code';
            case 'json': return 'codicon-file-json';
            case 'md': return 'codicon-file-markdown';
            case 'html': return 'codicon-file-html';
            case 'css': return 'codicon-file-css';
            case 'pdf': return 'codicon-file-pdf';
            case 'zip': case 'rar': case '7z': return 'codicon-file-zip';
            default: return 'codicon-file';
        }
    }

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
        actions.forEach(action => {
            const actionItem = document.createElement('div');
            actionItem.textContent = action;
            actionItem.addEventListener('click', () => {
                let command = action.toLowerCase().replace(' ', '');
                vscode.postMessage({ command: 'performFileAction', action: command, path: `${currentPath}/${file.name}` });
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

    function updateSuggestions(suggestions) {
        let suggestionList = document.getElementById('path-suggestions');
        if (!suggestionList) {
            suggestionList = document.createElement('ul');
            suggestionList.id = 'path-suggestions';
            currentPathInput.parentNode.insertBefore(suggestionList, currentPathInput.nextSibling);
        }
        
        suggestionList.innerHTML = '';
        suggestions.forEach(suggestion => {
            const li = document.createElement('li');
            li.textContent = suggestion;
            li.addEventListener('click', () => {
                currentPathInput.value = suggestion;
                suggestionList.innerHTML = '';
                vscode.postMessage({ command: 'loadDirectory', path: suggestion });
            });
            suggestionList.appendChild(li);
        });
    }

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
        vscode.postMessage({ command: 'loadDirectory', path: currentPathInput.value });
    });

    backButton.addEventListener('click', () => {
        const parentPath = currentPath.split(/[/\\]/).slice(0, -1).join('/') || '/';
        vscode.postMessage({ command: 'loadDirectory', path: parentPath });
    });

    toggleViewButton.addEventListener('click', () => {
        isGridView = !isGridView;
        toggleViewButton.className = `codicon ${isGridView ? 'codicon-list-flat' : 'codicon-grid'}`;
        vscode.postMessage({ command: 'loadDirectory', path: currentPath });
    });

    searchBox.addEventListener('input', () => {
        vscode.postMessage({ command: 'searchFiles', path: currentPath, query: searchBox.value });
    });

    window.addEventListener('focus', () => {
        vscode.window.showErrorMessage(`Focused now again..`);
        vscode.postMessage({ command: 'loadDirectory', path: currentPath });
    });

    // Load initial directory (current workspace folder or home directory)
    vscode.postMessage({ command: 'loadDirectory', path: '.' });
})();