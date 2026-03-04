// Configuration Service - Manages extension configuration

import * as vscode from 'vscode';
import { ExtensionConfig, IConfigService } from '../types';

export class ConfigService implements IConfigService {
    private static readonly CONFIG_PREFIX = 'file-browser';

    getShowStatusBar(): boolean {
        const config = vscode.workspace.getConfiguration(ConfigService.CONFIG_PREFIX);
        return config.get('show-status-bar') === 'enable';
    }

    getStatusBarPosition(): vscode.StatusBarAlignment {
        const config = vscode.workspace.getConfiguration(ConfigService.CONFIG_PREFIX);
        const position = config.get<string>('status-bar-position');
        return position === 'left' ? vscode.StatusBarAlignment.Left : vscode.StatusBarAlignment.Right;
    }

    getStatusBarPriority(): number {
        const config = vscode.workspace.getConfiguration(ConfigService.CONFIG_PREFIX);
        return config.get<number>('status-bar-priority') || 0;
    }

    getConfig(): ExtensionConfig {
        const config = vscode.workspace.getConfiguration(ConfigService.CONFIG_PREFIX);
        return {
            showStatusBar: config.get<'enable' | 'disable'>('show-status-bar') || 'enable',
            statusBarPosition: config.get<'left' | 'right'>('status-bar-position') || 'left',
            statusBarPriority: config.get<number>('status-bar-priority') || 0
        };
    }

    onConfigurationChange(callback: (e: vscode.ConfigurationChangeEvent) => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(callback);
    }
}
