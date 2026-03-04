// File Browser Panel - Main webview panel

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
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
            case 'searchFiles':
                const searchResults = await this.fileService.searchFiles(message.path, message.query);
                this._panel.webview.postMessage({ command: 'updateSearchResults', results: searchResults });
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
                <input type="text" id="current-path" placeholder="Enter path...">
                <button id="go-button">Go</button>
                <input type="text" id="search-box" placeholder="Search files...">
                <button id="new-file" class="codicon codicon-new-file"></button>
                <button id="new-folder" class="codicon codicon-new-folder"></button>
                <button id="toggle-view" class="codicon codicon-list-flat"></button>
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

            <div id="file-space">
            <div id="file-container"></div>
            </div>
            <script src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    private _resolvePath(inputPath: string): string {
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
            const files = await this.fileService.readDirectory(resolvedPath);
            this._panel.webview.postMessage({
                command: 'updateFiles',
                files,
                path: resolvedPath,
                platform: process.platform
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            vscode.window.showErrorMessage(`Error loading directory: ${errorMessage}`);
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

    private _showFileProperties(filePath: string): void {
        this.fileService.getFileStats(filePath).then((properties) => {
            const info = `
                Name: ${properties.name}
                Path: ${properties.path}
                Size: ${properties.size} bytes
                Created: ${properties.created}
                Modified: ${properties.modified}
                Permissions: ${properties.permissions}
            `;
            vscode.window.showInformationMessage(info, { modal: true });
        }).catch((error) => {
            vscode.window.showErrorMessage(`Error getting file properties: ${error instanceof Error ? error.message : 'Unknown error'}`);
        });
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
