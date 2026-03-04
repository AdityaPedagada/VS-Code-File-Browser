"use strict";
// Status Bar Manager - Handles status bar item
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
exports.StatusBarManager = void 0;
const vscode = __importStar(require("vscode"));
class StatusBarManager {
    constructor(configService) {
        this.configService = configService;
    }
    create(context) {
        this.context = context;
        if (!this.configService.getShowStatusBar()) {
            return;
        }
        try {
            this.statusBarItem = vscode.window.createStatusBarItem(this.configService.getStatusBarPosition(), this.configService.getStatusBarPriority());
            this.statusBarItem.command = 'extension.openFileBrowser';
            this.statusBarItem.text = '$(file-directory) File Browser';
            this.statusBarItem.tooltip = 'Open File Browser';
            this.statusBarItem.show();
            context.subscriptions.push(this.statusBarItem);
            console.log('Status bar item created and shown');
        }
        catch (error) {
            console.error('Error creating status bar item:', error);
            vscode.window.showErrorMessage('Failed to create File Browser status bar item');
        }
    }
    update() {
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
            this.statusBarItem = undefined;
        }
        if (this.context && this.configService.getShowStatusBar()) {
            this.create(this.context);
        }
    }
    dispose() {
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
            this.statusBarItem = undefined;
        }
    }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=StatusBarManager.js.map