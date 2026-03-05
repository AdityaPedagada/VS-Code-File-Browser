// File Browser Panel - Main webview panel

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { exec } from 'child_process';
import { FileService } from '../services/FileService';
import { ClipboardService } from '../services/ClipboardService';
import { ConfigService } from '../services/ConfigService';
import { FileAction, FileInfo, IncomingWebviewMessage } from '../types';

export class FileBrowserPanel {
    public static currentPanel: FileBrowserPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _cutPath: string = '';
    private _folderSizeCancellation: { isCancelled: boolean } = { isCancelled: false };
    private _isCalculatingSize: boolean = false;
    private _searchCancellation: { isCancelled: boolean } = { isCancelled: false };
    private _isSearching: boolean = false;
    private _currentSearchQuery: string = '';

    // Services
    private readonly fileService: FileService;
    private readonly clipboardService: ClipboardService;
    private readonly configService: ConfigService;

    public static createOrShow(extensionUri: vscode.Uri, configService: ConfigService): void {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        if (FileBrowserPanel.currentPanel) {
            FileBrowserPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'fileBrowser',
            'File Browser',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        FileBrowserPanel.currentPanel = new FileBrowserPanel(panel, extensionUri, configService);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, configService: ConfigService) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this.configService = configService;

        // Initialize services
        this.fileService = new FileService();
        this.clipboardService = new ClipboardService();

        this._update();
        this._registerEventHandlers();
    }

    private _registerEventHandlers(): void {
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async (message: IncomingWebviewMessage) => {
                await this._handleMessage(message);
            },
            null,
            this._disposables
        );

        this._panel.onDidChangeViewState(
            (e) => {
                if (this._panel.visible) {
                    this._panel.webview.postMessage({ command: 'restoreState' });
                }
            },
            null,
            this._disposables
        );
    }

    private async _handleMessage(message: IncomingWebviewMessage): Promise<void> {
        switch (message.command) {
            case 'loadDirectory':
                await this._loadDirectory(message.path);
                return;
            case 'getDirectorySuggestions':
                const suggestions = await this._getDirectorySuggestions(message.path);
                this._panel.webview.postMessage({ command: 'updateSuggestions', suggestions });
                return;
            case 'performFileAction':
                await this._performFileAction(message.action, message.path);
                return;
            case 'startSearch':
                // Start recursive search from current directory
                this._isSearching = true;
                this._currentSearchQuery = message.query as string;
                this._searchCancellation = { isCancelled: false };

                // Tell frontend to show search mode
                this._panel.webview.postMessage({
                    command: 'enterSearchMode',
                    query: message.query,
                    directory: message.directory
                });

                // Start searching with streaming results
                const allResults: FileInfo[] = [];
                await this.fileService.searchFilesRecursive(
                    message.directory as string,
                    message.query as string,
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
                    },
                    this._searchCancellation
                );

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
    }

    private async _update(): Promise<void> {
        const webview = this._panel.webview;
        this._panel.title = 'File Browser';
        this._panel.webview.html = await this._getHtmlForWebview(webview);
    }

    private async _getHtmlForWebview(webview: vscode.Webview): Promise<string> {
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
    }

    // Get list of Windows drives
    private async _getWindowsDrives(): Promise<FileInfo[]> {
        const drives: FileInfo[] = [];
        const driveLetters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

        for (const letter of driveLetters) {
            const drivePath = `${letter}:\\`;
            try {
                await fs.promises.access(drivePath, fs.constants.R_OK);
                drives.push({
                    name: `${letter}:`,
                    isDirectory: true,
                    lastModified: new Date().toISOString(),
                    type: 'Drive',
                    size: 0
                });
            } catch {
                // Drive doesn't exist or not accessible
            }
        }

        return drives;
    }

    private _resolvePath(inputPath: string): string {
        // Handle root path on Windows - return empty string to signal drives view
        if (inputPath === '/' || inputPath === '\\') {
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
            return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || os.homedir();
        }
        const currentDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || os.homedir();
        return path.resolve(currentDir, inputPath);
    }

    private async _loadDirectory(directoryPath: string): Promise<void> {
        try {
            const resolvedPath = this._resolvePath(directoryPath);

            // Handle drives view on Windows
            if (resolvedPath === '__DRIVES__' && process.platform === 'win32') {
                const drives = await this._getWindowsDrives();
                this._panel.webview.postMessage({
                    command: 'updateFiles',
                    files: drives,
                    path: '/',
                    platform: process.platform
                });
                return;
            }

            const files = await this.fileService.readDirectory(resolvedPath);
            this._panel.webview.postMessage({
                command: 'updateFiles',
                files,
                path: resolvedPath,
                platform: process.platform
            });
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('EPERM') || error.message.includes('EACCES')) {
                    vscode.window.showWarningMessage(
                        `Access denied: "${directoryPath}". Run VS Code as Administrator to access this folder.`
                    );
                } else {
                    vscode.window.showErrorMessage(`Error loading directory: ${error.message}`);
                }
            } else {
                vscode.window.showErrorMessage(`Error loading directory: An unknown error occurred`);
            }
        }
    }

    private async _getDirectorySuggestions(partialPath: string): Promise<string[]> {
        try {
            const resolvedPath = this._resolvePath(partialPath);
            let dirPath: string;
            let baseName: string;

            if (resolvedPath.endsWith(path.sep)) {
                dirPath = resolvedPath;
                baseName = '';
            } else {
                dirPath = path.dirname(resolvedPath);
                baseName = path.basename(resolvedPath).toLowerCase();
            }

            const files = await this.fileService.readDirectory(dirPath);
            return files
                .filter(file => file.isDirectory && file.name.toLowerCase().startsWith(baseName))
                .map(file => path.join(dirPath, file.name, path.sep));
        } catch (error) {
            console.error('Error getting directory suggestions:', error);
            return [];
        }
    }

    private async _performFileAction(action: FileAction, filePath: string): Promise<void> {
        switch (action) {
            case FileAction.Open:
                await this._handleOpen(filePath);
                break;
            case FileAction.OpenInNewWindow:
                vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(filePath), true);
                break;
            case FileAction.OpenInExplorer:
                this._openInExplorer(filePath);
                break;
            case FileAction.Delete:
                await this._handleDelete(filePath);
                break;
            case FileAction.Rename:
                await this._handleRename(filePath);
                break;
            case FileAction.NewFolder:
                await this._handleNewFolder(filePath);
                break;
            case FileAction.NewFile:
                await this._handleNewFile(filePath);
                break;
            case FileAction.Copy:
                await this._handleCopy(filePath);
                break;
            case FileAction.Cut:
                await this._handleCut(filePath);
                break;
            case FileAction.Paste:
                await this._handlePaste(filePath);
                break;
            case FileAction.Properties:
                this._showFileProperties(filePath);
                break;
            default:
                vscode.window.showErrorMessage(`Unsupported action: ${action}`);
        }
    }

    private async _handleOpen(filePath: string): Promise<void> {
        try {
            const isDir = await this.fileService.isDirectory(filePath);
            if (isDir) {
                await this._loadDirectory(filePath);
            } else {
                const document = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(document);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Error opening file or directory: ${errorMessage}`);
        }
    }

    private async _handleDelete(filePath: string): Promise<void> {
        const confirmation = await vscode.window.showWarningMessage(
            `Are you sure you want to delete ${filePath}?`,
            'Yes',
            'No'
        );
        if (confirmation === 'Yes') {
            await this.fileService.deleteFile(filePath);
            await this._loadDirectory(path.dirname(filePath));
        }
    }

    private async _handleRename(filePath: string): Promise<void> {
        const oldName = path.basename(filePath);
        const newName = await vscode.window.showInputBox({
            prompt: 'Enter new name',
            value: oldName
        });
        if (newName && newName !== oldName) {
            const newPath = path.join(path.dirname(filePath), newName);
            await this.fileService.renameFile(filePath, newPath);
            await this._loadDirectory(path.dirname(filePath));
        }
    }

    private async _handleNewFolder(parentPath: string): Promise<void> {
        const folderName = await vscode.window.showInputBox({ prompt: 'Enter folder name' });
        if (folderName) {
            const newFolderPath = path.join(parentPath, folderName);
            await this.fileService.createFolder(newFolderPath);
            await this._loadDirectory(parentPath);
        }
    }

    private async _handleNewFile(parentPath: string): Promise<void> {
        const fileName = await vscode.window.showInputBox({ prompt: 'Enter file name' });
        if (fileName) {
            const newFilePath = path.join(parentPath, fileName);
            await this.fileService.createFile(newFilePath);
            await this._loadDirectory(parentPath);
        }
    }

    private async _handleCopy(filePath: string): Promise<void> {
        await this.clipboardService.writeClipboard(filePath);
    }

    private async _handleCut(filePath: string): Promise<void> {
        await this.clipboardService.writeClipboard(filePath);
        this._cutPath = filePath;
    }

    private async _handlePaste(destinationPath: string): Promise<void> {
        if (this._cutPath) {
            const destPath = path.join(destinationPath, path.basename(this._cutPath));
            await this.fileService.moveFile(this._cutPath, destPath);
            this._cutPath = '';
        } else {
            const clipboardText = await this.clipboardService.readClipboard();
            if (clipboardText) {
                const destPath = path.join(destinationPath, path.basename(clipboardText));
                await this.fileService.copyFile(clipboardText, destPath);
            }
        }
        await this._loadDirectory(destinationPath);
    }

    private async _showFileProperties(filePath: string): Promise<void> {
        try {
            const properties = await this.fileService.getFileStats(filePath);
            const isDirectory = await this.fileService.isDirectory(filePath);
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
                const folderSize = await this.fileService.calculateFolderSize(
                    filePath,
                    (current) => {
                        loadingItem.text = `$(loading~spin) Processed ${current} items...`;
                        this._panel.webview.postMessage({
                            command: 'updateLoadingProgress',
                            message: `Processed ${current} items...`
                        });
                    },
                    this._folderSizeCancellation
                );

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
                } else {
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
        } catch (error) {
            // Hide loading on error
            this._panel.webview.postMessage({ command: 'hideLoading' });
            this._isCalculatingSize = false;
            vscode.window.showErrorMessage(`Error getting file properties: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private _formatSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    private _openInExplorer(filePath: string): void {
        const directoryPath = path.dirname(filePath);
        if (process.platform === 'win32') {
            exec(`explorer "${directoryPath}"`);
        } else if (process.platform === 'darwin') {
            exec(`open "${directoryPath}"`);
        } else if (process.platform === 'linux') {
            exec(`xdg-open "${directoryPath}"`);
        } else {
            vscode.window.showErrorMessage('This feature is only available on Windows and macOS.');
        }
    }

    public dispose(): void {
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
