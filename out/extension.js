"use strict";
// Enterprise-grade File Browser Extension
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ConfigService_1 = require("./services/ConfigService");
const StatusBarManager_1 = require("./panel/StatusBarManager");
const FileBrowserPanel_1 = require("./panel/FileBrowserPanel");
let statusBarManager;
let configService;
function activate(context) {
    console.log('File Browser Extension is now active!');
    // Copy codicons to media folder
    copyCodicons(context);
    // Initialize services
    configService = new ConfigService_1.ConfigService();
    // Register commands
    registerCommands(context);
    // Setup status bar
    setupStatusBar(context);
    // Listen for configuration changes
    setupConfigurationListener(context);
}
exports.activate = activate;
function copyCodicons(context) {
    const codiconSrc = path.join(context.extensionPath, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css');
    const codiconDest = path.join(context.extensionPath, 'media', 'codicon.css');
    fs.copyFileSync(codiconSrc, codiconDest);
    const codiconFntSrc = path.join(context.extensionPath, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.ttf');
    const codiconFntDest = path.join(context.extensionPath, 'media', 'codicon.ttf');
    fs.copyFileSync(codiconFntSrc, codiconFntDest);
}
function registerCommands(context) {
    const disposable = vscode.commands.registerCommand('extension.openFileBrowser', () => {
        FileBrowserPanel_1.FileBrowserPanel.createOrShow(context.extensionUri, configService);
    });
    context.subscriptions.push(disposable);
}
function setupStatusBar(context) {
    statusBarManager = new StatusBarManager_1.StatusBarManager(configService);
    statusBarManager.create(context);
}
function setupConfigurationListener(context) {
    context.subscriptions.push(configService.onConfigurationChange((e) => {
        if (e.affectsConfiguration('file-browser.status-bar-position') ||
            e.affectsConfiguration('file-browser.status-bar-priority') ||
            e.affectsConfiguration('file-browser.show-status-bar')) {
            if (statusBarManager) {
                statusBarManager.update();
            }
        }
    }));
}
function deactivate() {
    if (statusBarManager) {
        statusBarManager.dispose();
    }
    return undefined;
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map