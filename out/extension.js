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
function activate(context) {
    console.log('File Browser Extension is now active!');
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
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
        });
        FileBrowserPanel.currentPanel = new FileBrowserPanel(panel, extensionUri);
    }
    constructor(panel, extensionUri) {
        this._disposables = [];
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
        });
    }
    _loadDirectory(directoryPath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const files = yield fs.promises.readdir(directoryPath, { withFileTypes: true });
                const fileDetails = yield Promise.all(files.map((file) => __awaiter(this, void 0, void 0, function* () {
                    const filePath = path.join(directoryPath, file.name);
                    const stats = yield fs.promises.stat(filePath);
                    return {
                        name: file.name,
                        isDirectory: file.isDirectory(),
                        lastModified: stats.mtime.toISOString(),
                        type: file.isDirectory() ? 'Directory' : path.extname(file.name) || 'File',
                        size: stats.size
                    };
                })));
                this._panel.webview.postMessage({ command: 'updateFiles', files: fileDetails, path: directoryPath });
            }
            catch (error) {
                if (error instanceof Error) {
                    vscode.window.showErrorMessage(`Error getting directory suggestions: ${error.message}`);
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
                const dirPath = path.dirname(partialPath);
                const files = yield fs.promises.readdir(dirPath, { withFileTypes: true });
                return files
                    .filter(file => file.isDirectory() && file.name.toLowerCase().startsWith(path.basename(partialPath).toLowerCase()))
                    .map(file => path.join(dirPath, file.name));
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
                // Add more actions as needed
            }
        });
    }
    _searchFiles(directoryPath, query) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const files = yield fs.promises.readdir(directoryPath, { withFileTypes: true });
                return files
                    .filter(file => file.name.toLowerCase().includes(query.toLowerCase()))
                    .map(file => ({
                    name: file.name,
                    isDirectory: file.isDirectory(),
                    path: path.join(directoryPath, file.name)
                }));
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