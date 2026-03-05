"use strict";
// File Browser Panel - Main webview panel
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileBrowserPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const FileService_1 = require("../services/FileService");
const ClipboardService_1 = require("../services/ClipboardService");
const types_1 = require("../types");
class FileBrowserPanel {
    static createOrShow(extensionUri, configService) {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
        if (FileBrowserPanel.currentPanel) {
            FileBrowserPanel.currentPanel._panel.reveal(column);
            return;
        }
        const panel = vscode.window.createWebviewPanel('fileBrowser', 'File Browser', column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
        });
        FileBrowserPanel.currentPanel = new FileBrowserPanel(panel, extensionUri, configService);
    }
    constructor(panel, extensionUri, configService) {
        this._disposables = [];
        this._cutPath = '';
        this._folderSizeCancellation = { isCancelled: false };
        this._isCalculatingSize = false;
        this._searchCancellation = { isCancelled: false };
        this._isSearching = false;
        this._currentSearchQuery = '';
        this._panel = panel;
        this._extensionUri = extensionUri;
        this.configService = configService;
        // Initialize services
        this.fileService = new FileService_1.FileService();
        this.clipboardService = new ClipboardService_1.ClipboardService();
        this._update();
        this._registerEventHandlers();
    }
    _registerEventHandlers() {
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage((message) => __awaiter(this, void 0, void 0, function* () {
            yield this._handleMessage(message);
        }), null, this._disposables);
        this._panel.onDidChangeViewState((e) => {
            if (this._panel.visible) {
                this._panel.webview.postMessage({ command: 'restoreState' });
            }
        }, null, this._disposables);
    }
    _handleMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (message.command) {
                case 'loadDirectory':
                    yield this._loadDirectory(message.path);
                    return;
                case 'getDirectorySuggestions':
                    const suggestions = yield this._getDirectorySuggestions(message.path);
                    this._panel.webview.postMessage({ command: 'updateSuggestions', suggestions });
                    return;
                case 'performFileAction':
                    yield this._performFileAction(message.action, message.path);
                    return;
                case 'startSearch':
                    // Start recursive search from current directory
                    this._isSearching = true;
                    this._currentSearchQuery = message.query;
                    this._searchCancellation = { isCancelled: false };
                    // Tell frontend to show search mode
                    this._panel.webview.postMessage({
                        command: 'enterSearchMode',
                        query: message.query,
                        directory: message.directory
                    });
                    // Start searching with streaming results
                    const allResults = [];
                    yield this.fileService.searchFilesRecursive(message.directory, message.query, 
                    // On each result found
                    (file) => {
                        allResults.push(file);
                        this._panel.webview.postMessage({
                            command: 'addSearchResult',
                            file: file
                        });
                    }, 
                    // On progress
                    (processed, found) => {
                        this._panel.webview.postMessage({
                            command: 'updateSearchProgress',
                            processed: processed,
                            found: found
                        });
                    }, this._searchCancellation);
                    this._panel.webview.postMessage({
                        command: 'searchComplete',
                        totalFound: allResults.length
                    });
                    this._isSearching = false;
                    return;
                case 'cancelSearch':
                    this._searchCancellation.isCancelled = true;
                    this._isSearching = false;
                    this._panel.webview.postMessage({ command: 'searchCancelled' });
                    return;
                case 'exitSearchMode':
                    this._searchCancellation.isCancelled = true;
                    this._isSearching = false;
                    return;
            }
        });
    }
    _update() {
        return __awaiter(this, void 0, void 0, function* () {
            const webview = this._panel.webview;
            this._panel.title = 'File Browser';
            this._panel.webview.html = yield this._getHtmlForWebview(webview);
        });
    }
    _getHtmlForWebview(webview) {
        return __awaiter(this, void 0, void 0, function* () {
            const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
            const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css'));
            const codiconUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'codicon.css'));
            return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${styleUri}" rel="stylesheet">
            <link href="${codiconUri}" rel="stylesheet">
            <title>File Browser</title>
        </head>
        <body>
            <div id="toolbar">
                <button id="back-button" class="codicon codicon-arrow-left"></button>
                <div id="address-bar-container">
                    <button id="address-edit-btn" class="codicon codicon-edit" title="Edit address"></button>
                    <div id="address-bar" class="address-bar">
                        <span class="address-path"></span>
                    </div>
                    <input type="text" id="current-path" placeholder="Enter path..." style="display: none;">
                    <button id="address-close-btn" class="codicon codicon-close" title="Close edit" style="display: none;"></button>
                </div>
                <button id="go-button">Go</button>
                <input type="text" id="search-box" placeholder="Search files...">
                <button id="global-search" class="codicon codicon-search" title="Global Search (recursive)"></button>
                <button id="new-file" class="codicon codicon-new-file"></button>
                <button id="new-folder" class="codicon codicon-new-folder"></button>
                <button id="toggle-view" class="codicon codicon-layout" title="Toggle Grid/List View"></button>
                <div class="sort-dropdown">
                    <button id="sort-button" class="codicon codicon-sort-precedence"></button>
                    <div class="sort-menu">
                        <button class="sort-option" data-sort="name">Name</button>
                        <button class="sort-option" data-sort="modified">Modified Date</button>
                        <button class="sort-option" data-sort="type">Type</button>
                        <button class="sort-option" data-sort="size">Size</button>
                        <hr>
                        <button id="sort-direction"></button>
                    </div>
                </div>
            </div>

            <!-- Global Search Header (hidden by default) -->
            <div id="search-header" style="display: none;">
                <button id="search-back-button" class="codicon codicon-arrow-left"></button>
                <div class="search-input-wrapper">
                    <input type="text" id="global-search-box" placeholder="Search in subfolders...">
                    <button id="global-search-submit" class="codicon codicon-search"></button>
                </div>
                <button id="global-search-cancel" class="codicon codicon-close" title="Cancel search"></button>
                <button id="search-toggle-view" class="codicon codicon-layout" title="Toggle Grid/List View"></button>
                <div class="sort-dropdown">
                    <button id="search-sort-button" class="codicon codicon-sort-precedence"></button>
                    <div class="sort-menu">
                        <button class="sort-option" data-sort="name">Name</button>
                        <button class="sort-option" data-sort="modified">Modified Date</button>
                        <button class="sort-option" data-sort="type">Type</button>
                        <button class="sort-option" data-sort="size">Size</button>
                        <hr>
                        <button id="search-sort-direction"></button>
                    </div>
                </div>
            </div>

            <!-- Search Progress Bar (hidden by default) -->
            <div id="search-progress-container" style="display: none;">
                <div id="search-progress-bar"></div>
                <span id="search-progress-text">Searching...</span>
            </div>

            <div id="file-space">
            <div id="file-container"></div>
            </div>
            <script src="${scriptUri}"></script>
        </body>
        </html>`;
        });
    }
    // Get list of Windows drives
    _getWindowsDrives() {
        return __awaiter(this, void 0, void 0, function* () {
            const drives = [];
            const driveLetters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
            for (const letter of driveLetters) {
                const drivePath = `${letter}:\\`;
                try {
                    yield fs.promises.access(drivePath, fs.constants.R_OK);
                    drives.push({
                        name: `${letter}:`,
                        isDirectory: true,
                        lastModified: new Date().toISOString(),
                        type: 'Drive',
                        size: 0
                    });
                }
                catch (_a) {
                    // Drive doesn't exist or not accessible
                }
            }
            return drives;
        });
    }
    _resolvePath(inputPath) {
        var _a, _b, _c, _d;
        // Handle root path on Windows only - return signal for drives view
        if (process.platform === 'win32' && (inputPath === '/' || inputPath === '\\')) {
            return '__DRIVES__';
        }
        // Handle Windows drive letter without trailing separator
        if (inputPath.match(/^[a-zA-Z]:$/)) {
            return inputPath + path.sep;
        }
        if (path.isAbsolute(inputPath)) {
            return inputPath;
        }
        if (inputPath === '.' || inputPath === './') {
            return ((_b = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.uri.fsPath) || os.homedir();
        }
        const currentDir = ((_d = (_c = vscode.workspace.workspaceFolders) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.uri.fsPath) || os.homedir();
        return path.resolve(currentDir, inputPath);
    }
    _loadDirectory(directoryPath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const resolvedPath = this._resolvePath(directoryPath);
                // Handle drives view on Windows
                if (resolvedPath === '__DRIVES__' && process.platform === 'win32') {
                    const drives = yield this._getWindowsDrives();
                    this._panel.webview.postMessage({
                        command: 'updateFiles',
                        files: drives,
                        path: '/',
                        platform: process.platform
                    });
                    return;
                }
                const files = yield this.fileService.readDirectory(resolvedPath);
                this._panel.webview.postMessage({
                    command: 'updateFiles',
                    files,
                    path: resolvedPath,
                    platform: process.platform
                });
            }
            catch (error) {
                if (error instanceof Error) {
                    if (error.message.includes('EPERM') || error.message.includes('EACCES')) {
                        vscode.window.showWarningMessage(`Access denied: "${directoryPath}". Run VS Code as Administrator to access this folder.`);
                    }
                    else {
                        vscode.window.showErrorMessage(`Error loading directory: ${error.message}`);
                    }
                }
                else {
                    vscode.window.showErrorMessage(`Error loading directory: An unknown error occurred`);
                }
            }
        });
    }
    _getDirectorySuggestions(partialPath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const resolvedPath = this._resolvePath(partialPath);
                let dirPath;
                let baseName;
                if (resolvedPath.endsWith(path.sep)) {
                    dirPath = resolvedPath;
                    baseName = '';
                }
                else {
                    dirPath = path.dirname(resolvedPath);
                    baseName = path.basename(resolvedPath).toLowerCase();
                }
                const files = yield this.fileService.readDirectory(dirPath);
                return files
                    .filter(file => file.isDirectory && file.name.toLowerCase().startsWith(baseName))
                    .map(file => path.join(dirPath, file.name, path.sep));
            }
            catch (error) {
                console.error('Error getting directory suggestions:', error);
                return [];
            }
        });
    }
    _performFileAction(action, filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (action) {
                case types_1.FileAction.Open:
                    yield this._handleOpen(filePath);
                    break;
                case types_1.FileAction.OpenInNewWindow:
                    vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(filePath), true);
                    break;
                case types_1.FileAction.OpenInExplorer:
                    this._openInExplorer(filePath);
                    break;
                case types_1.FileAction.Delete:
                    yield this._handleDelete(filePath);
                    break;
                case types_1.FileAction.Rename:
                    yield this._handleRename(filePath);
                    break;
                case types_1.FileAction.NewFolder:
                    yield this._handleNewFolder(filePath);
                    break;
                case types_1.FileAction.NewFile:
                    yield this._handleNewFile(filePath);
                    break;
                case types_1.FileAction.Copy:
                    yield this._handleCopy(filePath);
                    break;
                case types_1.FileAction.Cut:
                    yield this._handleCut(filePath);
                    break;
                case types_1.FileAction.Paste:
                    yield this._handlePaste(filePath);
                    break;
                case types_1.FileAction.Properties:
                    this._showFileProperties(filePath);
                    break;
                default:
                    vscode.window.showErrorMessage(`Unsupported action: ${action}`);
            }
        });
    }
    _handleOpen(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const isDir = yield this.fileService.isDirectory(filePath);
                if (isDir) {
                    yield this._loadDirectory(filePath);
                }
                else {
                    const document = yield vscode.workspace.openTextDocument(filePath);
                    yield vscode.window.showTextDocument(document);
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                vscode.window.showErrorMessage(`Error opening file or directory: ${errorMessage}`);
            }
        });
    }
    _handleDelete(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const confirmation = yield vscode.window.showWarningMessage(`Are you sure you want to delete ${filePath}?`, 'Yes', 'No');
            if (confirmation === 'Yes') {
                yield this.fileService.deleteFile(filePath);
                yield this._loadDirectory(path.dirname(filePath));
            }
        });
    }
    _handleRename(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const oldName = path.basename(filePath);
            const newName = yield vscode.window.showInputBox({
                prompt: 'Enter new name',
                value: oldName
            });
            if (newName && newName !== oldName) {
                const newPath = path.join(path.dirname(filePath), newName);
                yield this.fileService.renameFile(filePath, newPath);
                yield this._loadDirectory(path.dirname(filePath));
            }
        });
    }
    _handleNewFolder(parentPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const folderName = yield vscode.window.showInputBox({ prompt: 'Enter folder name' });
            if (folderName) {
                const newFolderPath = path.join(parentPath, folderName);
                yield this.fileService.createFolder(newFolderPath);
                yield this._loadDirectory(parentPath);
            }
        });
    }
    _handleNewFile(parentPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const fileName = yield vscode.window.showInputBox({ prompt: 'Enter file name' });
            if (fileName) {
                const newFilePath = path.join(parentPath, fileName);
                yield this.fileService.createFile(newFilePath);
                yield this._loadDirectory(parentPath);
            }
        });
    }
    _handleCopy(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.clipboardService.writeClipboard(filePath);
        });
    }
    _handleCut(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.clipboardService.writeClipboard(filePath);
            this._cutPath = filePath;
        });
    }
    _handlePaste(destinationPath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._cutPath) {
                const destPath = path.join(destinationPath, path.basename(this._cutPath));
                yield this.fileService.moveFile(this._cutPath, destPath);
                this._cutPath = '';
            }
            else {
                const clipboardText = yield this.clipboardService.readClipboard();
                if (clipboardText) {
                    const destPath = path.join(destinationPath, path.basename(clipboardText));
                    yield this.fileService.copyFile(clipboardText, destPath);
                }
            }
            yield this._loadDirectory(destinationPath);
        });
    }
    _showFileProperties(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const properties = yield this.fileService.getFileStats(filePath);
                const isDirectory = yield this.fileService.isDirectory(filePath);
                let sizeInfo = `Size: ${properties.size} bytes`;
                // If it's a directory, calculate folder size with progress
                if (isDirectory) {
                    // Check if calculation is already in progress
                    if (this._isCalculatingSize) {
                        vscode.window.showWarningMessage('A folder size calculation is already in progress. Please wait for it to complete.');
                        return;
                    }
                    this._isCalculatingSize = true;
                    this._folderSizeCancellation = { isCancelled: false };
                    // Show status bar item
                    const loadingItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
                    loadingItem.text = '$(loading~spin) Calculating folder size...';
                    loadingItem.show();
                    // Send loading message to webview to show modal
                    this._panel.webview.postMessage({
                        command: 'showLoading',
                        message: 'Calculating folder size...'
                    });
                    // Calculate size with cancellation support
                    const folderSize = yield this.fileService.calculateFolderSize(filePath, (current) => {
                        loadingItem.text = `$(loading~spin) Processed ${current} items...`;
                        this._panel.webview.postMessage({
                            command: 'updateLoadingProgress',
                            message: `Processed ${current} items...`
                        });
                    }, this._folderSizeCancellation);
                    // Cleanup
                    loadingItem.dispose();
                    // Hide loading modal
                    this._panel.webview.postMessage({
                        command: 'hideLoading'
                    });
                    if (this._folderSizeCancellation.isCancelled) {
                        // Still show result even if modal was closed
                        sizeInfo = `Size: Calculation cancelled`;
                        this._isCalculatingSize = false;
                    }
                    else {
                        sizeInfo = `Size: ${this._formatSize(folderSize)} (${folderSize} bytes)`;
                        this._isCalculatingSize = false;
                    }
                }
                const info = `
                Name: ${properties.name}
                Path: ${properties.path}
                ${sizeInfo}
                Created: ${properties.created}
                Modified: ${properties.modified}
                Permissions: ${properties.permissions}
            `;
                vscode.window.showInformationMessage(info, { modal: true });
            }
            catch (error) {
                // Hide loading on error
                this._panel.webview.postMessage({ command: 'hideLoading' });
                this._isCalculatingSize = false;
                vscode.window.showErrorMessage(`Error getting file properties: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    _formatSize(bytes) {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    _openInExplorer(filePath) {
        const directoryPath = path.dirname(filePath);
        if (process.platform === 'win32') {
            (0, child_process_1.exec)(`explorer "${directoryPath}"`);
        }
        else if (process.platform === 'darwin') {
            (0, child_process_1.exec)(`open "${directoryPath}"`);
        }
        else if (process.platform === 'linux') {
            (0, child_process_1.exec)(`xdg-open "${directoryPath}"`);
        }
        else {
            vscode.window.showErrorMessage('This feature is only available on Windows and macOS.');
        }
    }
    dispose() {
        FileBrowserPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
exports.FileBrowserPanel = FileBrowserPanel;
//# sourceMappingURL=FileBrowserPanel.js.map