"use strict";
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
exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
function activate(context) {
    console.log('File Browser Extension is now active!');
    const codiconSrc = path.join(context.extensionPath, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css');
    const codiconDest = path.join(context.extensionPath, 'media', 'codicon.css');
    fs.copyFileSync(codiconSrc, codiconDest);
    const codiconFntSrc = path.join(context.extensionPath, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.ttf');
    const codiconFntDest = path.join(context.extensionPath, 'media', 'codicon.ttf');
    fs.copyFileSync(codiconFntSrc, codiconFntDest);
    let disposable = vscode.commands.registerCommand('extension.openFileBrowser', () => {
        FileBrowserPanel.createOrShow(context.extensionUri);
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
class FileBrowserPanel {
    static createOrShow(extensionUri) {
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
        FileBrowserPanel.currentPanel = new FileBrowserPanel(panel, extensionUri);
    }
    constructor(panel, extensionUri) {
        this._disposables = [];
        this._cutPath = '';
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage((message) => __awaiter(this, void 0, void 0, function* () {
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
                case 'searchFiles':
                    const searchResults = yield this._searchFiles(message.path, message.query);
                    this._panel.webview.postMessage({ command: 'updateSearchResults', results: searchResults });
                    return;
            }
        }), null, this._disposables);
        this._panel.onDidChangeViewState(e => {
            if (this._panel.visible) {
                this._panel.webview.postMessage({ command: 'restoreState' });
            }
        }, null, this._disposables);
    }
    _update() {
        return __awaiter(this, void 0, void 0, function* () {
            const webview = this._panel.webview;
            this._panel.title = "File Browser";
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
            <input type="text" id="current-path" placeholder="Enter path...">
            <button id="go-button">Go</button>
            <input type="text" id="search-box" placeholder="Search files...">
            <button id="new-file" class="codicon codicon-new-file"></button>
            <button id="toggle-view" class="codicon codicon-list-flat"></button>
            <div class="sort-dropdown">
                <button id="sort-button" class="codicon codicon-sort-precedence"></button>
                <div class="sort-menu">
                    <button class="sort-option" data-sort="name">Name</button>
                    <button class="sort-option" data-sort="modified">Modified Date</button>
                    <button class="sort-option" data-sort="type">Type</button>
                    <button class="sort-option" data-sort="size">Size</button>
                    <hr>
                    <button id="sort-direction" class="codicon codicon-sort-precedence">Ascending</button>
                </div>
            </div>
        </div>
            <div id="file-container"></div>
            <script src="${scriptUri}"></script>
        </body>
        </html>`;
        });
    }
    _loadDirectory(directoryPath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const resolvedPath = this._resolvePath(directoryPath);
                const files = yield fs.promises.readdir(resolvedPath, { withFileTypes: true });
                const fileDetails = yield Promise.all(files.map((file) => __awaiter(this, void 0, void 0, function* () {
                    const filePath = path.join(resolvedPath, file.name);
                    const stats = yield fs.promises.stat(filePath);
                    return {
                        name: file.name,
                        isDirectory: file.isDirectory(),
                        lastModified: stats.mtime.toISOString(),
                        type: file.isDirectory() ? 'Directory' : path.extname(file.name) || 'File',
                        size: stats.size
                    };
                })));
                this._panel.webview.postMessage({ command: 'updateFiles', files: fileDetails, path: resolvedPath });
            }
            catch (error) {
                if (error instanceof Error) {
                    vscode.window.showErrorMessage(`Error loading directory: ${error.message}`);
                }
                else {
                    vscode.window.showErrorMessage(`Error loading directory: An unknown error occurred`);
                }
            }
        });
    }
    _resolvePath(inputPath) {
        var _a, _b, _c, _d;
        if (path.isAbsolute(inputPath)) {
            return inputPath;
        }
        if (inputPath === '.' || inputPath === './') {
            return ((_b = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.uri.fsPath) || os.homedir();
        }
        const currentDir = ((_d = (_c = vscode.workspace.workspaceFolders) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.uri.fsPath) || os.homedir();
        return path.resolve(currentDir, inputPath);
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
                const files = yield fs.promises.readdir(dirPath, { withFileTypes: true });
                return files
                    .filter(file => file.isDirectory() && file.name.toLowerCase().startsWith(baseName))
                    .map(file => path.join(dirPath, file.name, path.sep));
            }
            catch (error) {
                if (error instanceof Error) {
                    console.error(`Error getting directory suggestions: ${error.message}`);
                }
                else {
                    console.error('An unknown error occurred while getting directory suggestions');
                }
                return [];
            }
        });
    }
    _performFileAction(action, filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (action) {
                case 'open':
                    const document = yield vscode.workspace.openTextDocument(filePath);
                    yield vscode.window.showTextDocument(document);
                    break;
                case 'delete':
                    const confirmation = yield vscode.window.showWarningMessage(`Are you sure you want to delete ${filePath}?`, 'Yes', 'No');
                    if (confirmation === 'Yes') {
                        yield fs.promises.unlink(filePath);
                        yield this._loadDirectory(path.dirname(filePath));
                    }
                    break;
                case 'rename':
                    const oldName = path.basename(filePath);
                    const newName = yield vscode.window.showInputBox({
                        prompt: 'Enter new name',
                        value: oldName
                    });
                    if (newName && newName !== oldName) {
                        const newPath = path.join(path.dirname(filePath), newName);
                        yield fs.promises.rename(filePath, newPath);
                        yield this._loadDirectory(path.dirname(filePath));
                    }
                    break;
                case 'newFolder':
                    const folderName = yield vscode.window.showInputBox({ prompt: 'Enter folder name' });
                    if (folderName) {
                        const newFolderPath = path.join(filePath, folderName);
                        yield fs.promises.mkdir(newFolderPath);
                        yield this._loadDirectory(filePath);
                    }
                    break;
                case 'newFile':
                    const fileName = yield vscode.window.showInputBox({ prompt: 'Enter file name' });
                    if (fileName) {
                        const newFilePath = path.join(filePath, fileName);
                        yield fs.promises.writeFile(newFilePath, '');
                        yield this._loadDirectory(filePath);
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
                        yield fs.promises.rename(this._cutPath, destPath);
                        this._cutPath = '';
                    }
                    else {
                        const clipboardText = yield vscode.env.clipboard.readText();
                        if (clipboardText) {
                            const destPath = path.join(filePath, path.basename(clipboardText));
                            yield fs.promises.copyFile(clipboardText, destPath);
                        }
                    }
                    yield this._loadDirectory(filePath);
                    break;
                case 'properties':
                    this._showFileProperties(filePath);
                    break;
                default:
                    vscode.window.showErrorMessage(`Unsupported action: ${action}`);
            }
        });
    }
    _showFileProperties(filePath) {
        if (process.platform === 'win32') {
            (0, child_process_1.exec)(`explorer /select,"${filePath}"`);
        }
        else if (process.platform === 'darwin') {
            (0, child_process_1.exec)(`open -R "${filePath}"`);
        }
        else {
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
    _searchFiles(directoryPath, query) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const files = yield fs.promises.readdir(directoryPath, { withFileTypes: true });
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
            }
            catch (error) {
                if (error instanceof Error) {
                    vscode.window.showErrorMessage(`Error searching files: ${error.message}`);
                    console.error(`Error searching files: ${error.message}`);
                }
                else {
                    vscode.window.showErrorMessage(`Error searching files: An unknown error occurred`);
                    console.error(`Error searching files: An unknown error occurred`);
                }
                return [];
            }
        });
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
//# sourceMappingURL=extension.js.map