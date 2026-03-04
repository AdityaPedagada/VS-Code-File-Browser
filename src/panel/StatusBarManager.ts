// Status Bar Manager - Handles status bar item

import * as vscode from 'vscode';
import { IConfigService, IStatusBarManager } from '../types';

export class StatusBarManager implements IStatusBarManager {
    private statusBarItem: vscode.StatusBarItem | undefined;
    private context: vscode.ExtensionContext | undefined;
    private configService: IConfigService;

    constructor(configService: IConfigService) {
        this.configService = configService;
    }

    create(context: vscode.ExtensionContext): void {
        this.context = context;

        if (!this.configService.getShowStatusBar()) {
            return;
        }

        try {
            this.statusBarItem = vscode.window.createStatusBarItem(
                this.configService.getStatusBarPosition(),
                this.configService.getStatusBarPriority()
            );
            this.statusBarItem.command = 'extension.openFileBrowser';
            this.statusBarItem.text = '$(file-directory) File Browser';
            this.statusBarItem.tooltip = 'Open File Browser';
            this.statusBarItem.show();

            context.subscriptions.push(this.statusBarItem);
            console.log('Status bar item created and shown');
        } catch (error) {
            console.error('Error creating status bar item:', error);
            vscode.window.showErrorMessage('Failed to create File Browser status bar item');
        }
    }

    update(): void {
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
            this.statusBarItem = undefined;
        }

        if (this.context && this.configService.getShowStatusBar()) {
            this.create(this.context);
        }
    }

    dispose(): void {
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
            this.statusBarItem = undefined;
        }
    }
}
