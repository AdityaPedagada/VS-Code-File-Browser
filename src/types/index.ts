// Type definitions for File Browser Extension

import * as vscode from 'vscode';

// ============= Enums =============

export enum SortOption {
    Name = 'name',
    Modified = 'modified',
    Type = 'type',
    Size = 'size'
}

export enum SortDirection {
    Ascending = 'asc',
    Descending = 'desc'
}

export enum ViewMode {
    Grid = 'grid',
    List = 'list'
}

export enum FileAction {
    Open = 'open',
    OpenInNewWindow = 'openinnewwindow',
    OpenInExplorer = 'openinexplorer',
    Delete = 'delete',
    Rename = 'rename',
    NewFolder = 'newFolder',
    NewFile = 'newFile',
    Copy = 'copy',
    Cut = 'cut',
    Paste = 'paste',
    Properties = 'properties'
}

// ============= Interfaces =============

export interface FileInfo {
    name: string;
    isDirectory: boolean;
    lastModified: string;
    type: string;
    size: number;
    path?: string;
}

export interface FileProperties {
    name: string;
    path: string;
    size: number;
    created: Date;
    modified: Date;
    permissions: number;
}

export interface SortConfig {
    option: SortOption;
    direction: SortDirection;
}

export interface ViewState {
    currentPath: string;
    sortOption: SortOption;
    sortDirection: SortDirection;
    searchQuery: string;
    isGridView: boolean;
}

// ============= Webview Message Types =============

export interface WebviewMessage {
    command: string;
    [key: string]: unknown;
}

export interface LoadDirectoryMessage extends WebviewMessage {
    command: 'loadDirectory';
    path: string;
}

export interface GetDirectorySuggestionsMessage extends WebviewMessage {
    command: 'getDirectorySuggestions';
    path: string;
}

export interface PerformFileActionMessage extends WebviewMessage {
    command: 'performFileAction';
    action: FileAction;
    path: string;
}

export interface SearchFilesMessage extends WebviewMessage {
    command: 'searchFiles';
    path: string;
    query: string;
}

export interface StartSearchMessage extends WebviewMessage {
    command: 'startSearch';
    query: string;
    directory: string;
}

export interface CancelSearchMessage extends WebviewMessage {
    command: 'cancelSearch';
}

export interface ExitSearchModeMessage extends WebviewMessage {
    command: 'exitSearchMode';
}

export interface AddSearchResultMessage {
    command: 'addSearchResult';
    file: FileInfo;
}

export interface UpdateSearchProgressMessage {
    command: 'updateSearchProgress';
    processed: number;
    found: number;
}

export interface SearchCompleteMessage {
    command: 'searchComplete';
    totalFound: number;
    limited?: boolean;
}

export interface SearchCancelledMessage {
    command: 'searchCancelled';
}

export interface EnterSearchModeMessage {
    command: 'enterSearchMode';
    query: string;
    directory: string;
}

export interface UpdateFilesMessage {
    command: 'updateFiles';
    files: FileInfo[];
    path: string;
    platform: string;
}

export interface UpdateSuggestionsMessage {
    command: 'updateSuggestions';
    suggestions: string[];
}

export interface UpdateSearchResultsMessage {
    command: 'updateSearchResults';
    results: FileInfo[];
}

export interface RestoreStateMessage {
    command: 'restoreState';
}

export type IncomingWebviewMessage =
    | LoadDirectoryMessage
    | GetDirectorySuggestionsMessage
    | PerformFileActionMessage
    | SearchFilesMessage
    | StartSearchMessage
    | CancelSearchMessage
    | ExitSearchModeMessage;

export type OutgoingWebviewMessage =
    | UpdateFilesMessage
    | UpdateSuggestionsMessage
    | UpdateSearchResultsMessage
    | RestoreStateMessage
    | AddSearchResultMessage
    | UpdateSearchProgressMessage
    | SearchCompleteMessage
    | SearchCancelledMessage
    | EnterSearchModeMessage;

// ============= Configuration Types =============

export interface ExtensionConfig {
    showStatusBar: 'enable' | 'disable';
    statusBarPosition: 'left' | 'right';
    statusBarPriority: number;
}

// ============= Service Interfaces =============

export interface IFileService {
    readDirectory(directoryPath: string): Promise<FileInfo[]>;
    createFile(filePath: string): Promise<void>;
    createFolder(folderPath: string): Promise<void>;
    deleteFile(filePath: string): Promise<void>;
    renameFile(oldPath: string, newPath: string): Promise<void>;
    copyFile(source: string, destination: string): Promise<void>;
    moveFile(source: string, destination: string): Promise<void>;
    getFileStats(filePath: string): Promise<FileProperties>;
    searchFiles(directoryPath: string, query: string): Promise<FileInfo[]>;
    exists(filePath: string): Promise<boolean>;
    isDirectory(filePath: string): Promise<boolean>;
}

export interface IClipboardService {
    setCutPath(path: string | null): void;
    getCutPath(): string | null;
    readClipboard(): Promise<string>;
    writeClipboard(text: string): Promise<void>;
    clear(): void;
}

export interface IConfigService {
    getShowStatusBar(): boolean;
    getStatusBarPosition(): vscode.StatusBarAlignment;
    getStatusBarPriority(): number;
    getConfig(): ExtensionConfig;
    onConfigurationChange(callback: (e: vscode.ConfigurationChangeEvent) => void): vscode.Disposable;
}

export interface IStatusBarManager {
    create(context: vscode.ExtensionContext): void;
    update(): void;
    dispose(): void;
}
