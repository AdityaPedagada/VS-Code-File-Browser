"use strict";
// Configuration Service - Manages extension configuration
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
exports.ConfigService = void 0;
const vscode = __importStar(require("vscode"));
class ConfigService {
    getShowStatusBar() {
        const config = vscode.workspace.getConfiguration(ConfigService.CONFIG_PREFIX);
        return config.get('show-status-bar') === 'enable';
    }
    getStatusBarPosition() {
        const config = vscode.workspace.getConfiguration(ConfigService.CONFIG_PREFIX);
        const position = config.get('status-bar-position');
        return position === 'left' ? vscode.StatusBarAlignment.Left : vscode.StatusBarAlignment.Right;
    }
    getStatusBarPriority() {
        const config = vscode.workspace.getConfiguration(ConfigService.CONFIG_PREFIX);
        return config.get('status-bar-priority') || 0;
    }
    getConfig() {
        const config = vscode.workspace.getConfiguration(ConfigService.CONFIG_PREFIX);
        return {
            showStatusBar: config.get('show-status-bar') || 'enable',
            statusBarPosition: config.get('status-bar-position') || 'left',
            statusBarPriority: config.get('status-bar-priority') || 0
        };
    }
    onConfigurationChange(callback) {
        return vscode.workspace.onDidChangeConfiguration(callback);
    }
}
exports.ConfigService = ConfigService;
ConfigService.CONFIG_PREFIX = 'file-browser';
//# sourceMappingURL=ConfigService.js.map