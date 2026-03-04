// Enterprise-grade File Browser Extension

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from './services/ConfigService';
import { StatusBarManager } from './panel/StatusBarManager';
import { FileBrowserPanel } from './panel/FileBrowserPanel';

let statusBarManager: StatusBarManager | undefined;
let configService: ConfigService;

export function activate(context: vscode.ExtensionContext): void {
    console.log('File Browser Extension is now active!');

    // Copy codicons to media folder
    copyCodicons(context);

    // Initialize services
    configService = new ConfigService();

    // Register commands
    registerCommands(context);

    // Setup status bar
    setupStatusBar(context);

    // Listen for configuration changes
    setupConfigurationListener(context);
}

function copyCodicons(context: vscode.ExtensionContext): void {
    const codiconSrc = path.join(context.extensionPath, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css');
    const codiconDest = path.join(context.extensionPath, 'media', 'codicon.css');
    fs.copyFileSync(codiconSrc, codiconDest);

    const codiconFntSrc = path.join(context.extensionPath, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.ttf');
    const codiconFntDest = path.join(context.extensionPath, 'media', 'codicon.ttf');
    fs.copyFileSync(codiconFntSrc, codiconFntDest);
}

function registerCommands(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand('extension.openFileBrowser', () => {
        FileBrowserPanel.createOrShow(context.extensionUri, configService);
    });
    context.subscriptions.push(disposable);
}

function setupStatusBar(context: vscode.ExtensionContext): void {
    statusBarManager = new StatusBarManager(configService);
    statusBarManager.create(context);
}

function setupConfigurationListener(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        configService.onConfigurationChange((e) => {
            if (e.affectsConfiguration('file-browser.status-bar-position') ||
                e.affectsConfiguration('file-browser.status-bar-priority') ||
                e.affectsConfiguration('file-browser.show-status-bar')) {
                if (statusBarManager) {
                    statusBarManager.update();
                }
            }
        })
    );
}

export function deactivate(): void {
    if (statusBarManager) {
        statusBarManager.dispose();
    }
    return undefined;
}
