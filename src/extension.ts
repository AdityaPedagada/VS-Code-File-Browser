import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
    console.log('File Browser Extension is now active!');

    let disposable = vscode.commands.registerCommand('extension.openFileBrowser', () => {
        FileBrowserPanel.createOrShow(context.extensionUri);
    });

    context.subscriptions.push(disposable);
}

class FileBrowserPanel {
    public static currentPanel: FileBrowserPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
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
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        FileBrowserPanel.currentPanel = new FileBrowserPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async message => {
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
                        const searchResults = await this._searchFiles(message.path, message.query);
                        this._panel.webview.postMessage({ command: 'updateSearchResults', results: searchResults });
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private async _update() {
        const webview = this._panel.webview;
        this._panel.title = "File Browser";
        this._panel.webview.html = await this._getHtmlForWebview(webview);
    }

    private async _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css'));
        const codiconUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

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
                <button id="toggle-view" class="codicon codicon-list-flat"></button>
            </div>
            <div id="file-container"></div>
            <script src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    private async _loadDirectory(directoryPath: string) {
        try {
            const resolvedPath = this._resolvePath(directoryPath);
            const files = await fs.promises.readdir(resolvedPath, { withFileTypes: true });
            const fileDetails = await Promise.all(files.map(async file => {
                const filePath = path.join(resolvedPath, file.name);
                const stats = await fs.promises.stat(filePath);
                return {
                    name: file.name,
                    isDirectory: file.isDirectory(),
                    lastModified: stats.mtime.toISOString(),
                    type: file.isDirectory() ? 'Directory' : path.extname(file.name) || 'File',
                    size: stats.size
                };
            }));

            this._panel.webview.postMessage({ command: 'updateFiles', files: fileDetails, path: resolvedPath });
        } catch (error) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Error loading directory: ${error.message}`);
            } else {
                vscode.window.showErrorMessage(`Error loading directory: An unknown error occurred`);
            }
        }
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

    private async _getDirectorySuggestions(partialPath: string) {
        try {
            const resolvedPath = this._resolvePath(partialPath);
            const dirPath = path.dirname(resolvedPath);
            const files = await fs.promises.readdir(dirPath, { withFileTypes: true });
            return files
                .filter(file => file.isDirectory() && file.name.toLowerCase().startsWith(path.basename(resolvedPath).toLowerCase()))
                .map(file => path.join(dirPath, file.name, path.sep));
        } catch (error) {
            if (error instanceof Error) {
                console.error(`Error getting directory suggestions: ${error.message}`);
            } else {
                console.error('An unknown error occurred while getting directory suggestions');
            }
            return [];
        }
    }

    private async _performFileAction(action: string, filePath: string) {
        switch (action) {
            case 'open':
                const document = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(document);
                break;
            case 'delete':
                const confirmation = await vscode.window.showWarningMessage(`Are you sure you want to delete ${filePath}?`, 'Yes', 'No');
                if (confirmation === 'Yes') {
                    await fs.promises.unlink(filePath);
                    await this._loadDirectory(path.dirname(filePath));
                }
                break;
            case 'rename':
                const oldName = path.basename(filePath);
                const newName = await vscode.window.showInputBox({ 
                    prompt: 'Enter new name', 
                    value: oldName 
                });
                if (newName && newName !== oldName) {
                    const newPath = path.join(path.dirname(filePath), newName);
                    await fs.promises.rename(filePath, newPath);
                    await this._loadDirectory(path.dirname(filePath));
                }
                break;
            case 'newFolder':
                const folderName = await vscode.window.showInputBox({ prompt: 'Enter folder name' });
                if (folderName) {
                    const newFolderPath = path.join(filePath, folderName);
                    await fs.promises.mkdir(newFolderPath);
                    await this._loadDirectory(filePath);
                }
                break;
            case 'newFile':
                const fileName = await vscode.window.showInputBox({ prompt: 'Enter file name' });
                if (fileName) {
                    const newFilePath = path.join(filePath, fileName);
                    await fs.promises.writeFile(newFilePath, '');
                    await this._loadDirectory(filePath);
                }
                break;
            case 'copy':
            case 'cut':
                vscode.env.clipboard.writeText(filePath);
                if (action === 'cut') {
                    this._cutPath = filePath;
                }
                break;
            case 'paste':
                if (this._cutPath) {
                    const destPath = path.join(filePath, path.basename(this._cutPath));
                    await fs.promises.rename(this._cutPath, destPath);
                    this._cutPath = '';
                } else {
                    const clipboardText = await vscode.env.clipboard.readText();
                    if (clipboardText) {
                        const destPath = path.join(filePath, path.basename(clipboardText));
                        await fs.promises.copyFile(clipboardText, destPath);
                    }
                }
                await this._loadDirectory(filePath);
                break;
            case 'properties':
                this._showFileProperties(filePath);
                break;
            default:
                vscode.window.showErrorMessage(`Unsupported action: ${action}`);
        }
    }

    private _cutPath: string = '';

    private _showFileProperties(filePath: string) {
        if (process.platform === 'win32') {
            exec(`explorer /select,"${filePath}"`);
        } else if (process.platform === 'darwin') {
            exec(`open -R "${filePath}"`);
        } else {
            // For Linux, we'll show a simple properties dialog
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    vscode.window.showErrorMessage(`Error getting file properties: ${err.message}`);
                    return;
                }
                const properties = `
                    Name: ${path.basename(filePath)}
                    Path: ${filePath}
                    Size: ${stats.size} bytes
                    Created: ${stats.birthtime}
                    Modified: ${stats.mtime}
                    Permissions: ${stats.mode}
                `;
                vscode.window.showInformationMessage(properties, { modal: true });
            });
        }
    }

    private async _searchFiles(directoryPath: string, query: string) {
        try {
            const files = await fs.promises.readdir(directoryPath, { withFileTypes: true });
            const searchResults = files
                .filter(file => file.name.toLowerCase().includes(query.toLowerCase()))
                .map(file => {
                    const filePath = path.join(directoryPath, file.name);
                    const stats = fs.statSync(filePath);
                    return {
                        name: file.name,
                        isDirectory: file.isDirectory(),
                        path: filePath,
                        lastModified: stats.mtime.toISOString(),
                        type: file.isDirectory() ? 'Directory' : path.extname(file.name) || 'File',
                        size: stats.size
                    };
                });
            return searchResults;
        } catch (error: unknown) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Error searching files: ${error.message}`);
                console.error(`Error searching files: ${error.message}`);
            } else {
                vscode.window.showErrorMessage(`Error searching files: An unknown error occurred`);
                console.error(`Error searching files: An unknown error occurred`);
            }
            return [];
        }
    }

    public dispose() {
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