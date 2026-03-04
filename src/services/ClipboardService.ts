// Clipboard Service - Manages clipboard state for cut/copy/paste

import * as vscode from 'vscode';
import { IClipboardService } from '../types';

export class ClipboardService implements IClipboardService {
    private cutPath: string | null = null;

    setCutPath(path: string | null): void {
        this.cutPath = path;
    }

    getCutPath(): string | null {
        return this.cutPath;
    }

    async readClipboard(): Promise<string> {
        return await vscode.env.clipboard.readText();
    }

    async writeClipboard(text: string): Promise<void> {
        await vscode.env.clipboard.writeText(text);
    }

    clear(): void {
        this.cutPath = null;
    }
}
