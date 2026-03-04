// File Service - Handles all file system operations

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { FileInfo, FileProperties, IFileService } from '../types';

const execAsync = promisify(exec);

export class FileService implements IFileService {
    async readDirectory(directoryPath: string): Promise<FileInfo[]> {
        const files = await fs.promises.readdir(directoryPath, { withFileTypes: true });
        const fileDetails: FileInfo[] = [];

        for (const file of files) {
            try {
                const filePath = path.join(directoryPath, file.name);
                const stats = await fs.promises.stat(filePath);
                fileDetails.push({
                    name: file.name,
                    isDirectory: file.isDirectory(),
                    lastModified: stats.mtime.toISOString(),
                    type: file.isDirectory() ? 'Directory' : path.extname(file.name) || 'File',
                    size: stats.size
                });
            } catch (error) {
                // Skip files that can't be accessed (permission denied, system files, etc.)
                console.warn(`Skipping inaccessible file: ${file.name}`, error);
                continue;
            }
        }

        return fileDetails;
    }

    async createFile(filePath: string): Promise<void> {
        await fs.promises.writeFile(filePath, '');
    }

    async createFolder(folderPath: string): Promise<void> {
        await fs.promises.mkdir(folderPath, { recursive: true });
    }

    async deleteFile(filePath: string): Promise<void> {
        const stats = await fs.promises.stat(filePath);
        if (stats.isDirectory()) {
            await fs.promises.rmdir(filePath, { recursive: true });
        } else {
            await fs.promises.unlink(filePath);
        }
    }

    async renameFile(oldPath: string, newPath: string): Promise<void> {
        await fs.promises.rename(oldPath, newPath);
    }

    async copyFile(source: string, destination: string): Promise<void> {
        await fs.promises.copyFile(source, destination);
    }

    async moveFile(source: string, destination: string): Promise<void> {
        await fs.promises.rename(source, destination);
    }

    async getFileStats(filePath: string): Promise<FileProperties> {
        const stats = await fs.promises.stat(filePath);
        return {
            name: path.basename(filePath),
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            permissions: stats.mode
        };
    }

    async searchFiles(directoryPath: string, query: string): Promise<FileInfo[]> {
        const files = await fs.promises.readdir(directoryPath, { withFileTypes: true });
        const searchResults: FileInfo[] = [];

        for (const file of files) {
            try {
                if (!file.name.toLowerCase().includes(query.toLowerCase())) {
                    continue;
                }
                const filePath = path.join(directoryPath, file.name);
                const stats = await fs.promises.stat(filePath);
                searchResults.push({
                    name: file.name,
                    isDirectory: file.isDirectory(),
                    path: filePath,
                    lastModified: stats.mtime.toISOString(),
                    type: file.isDirectory() ? 'Directory' : path.extname(file.name) || 'File',
                    size: stats.size
                });
            } catch (error) {
                // Skip inaccessible files
                console.warn(`Skipping inaccessible file: ${file.name}`, error);
                continue;
            }
        }

        return searchResults;
    }

    async exists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async isDirectory(filePath: string): Promise<boolean> {
        const stats = await fs.promises.stat(filePath);
        return stats.isDirectory();
    }

    async calculateFolderSize(
        folderPath: string,
        onProgress?: (current: number, total: number) => void,
        cancellationToken?: { isCancelled: boolean }
    ): Promise<number> {
        let totalSize = 0;
        let processedItems = 0;

        const calculateSize = async (dirPath: string): Promise<void> => {
            if (cancellationToken?.isCancelled) {
                return;
            }

            try {
                const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

                for (const entry of entries) {
                    if (cancellationToken?.isCancelled) {
                        return;
                    }

                    const fullPath = path.join(dirPath, entry.name);

                    try {
                        if (entry.isDirectory()) {
                            await calculateSize(fullPath);
                        } else {
                            const stats = await fs.promises.stat(fullPath);
                            totalSize += stats.size;
                        }
                    } catch {
                        // Skip inaccessible files
                        continue;
                    }

                    processedItems++;
                    if (onProgress) {
                        onProgress(processedItems, -1); // -1 indicates unknown total
                    }
                }
            } catch {
                // Skip inaccessible directories
            }
        };

        await calculateSize(folderPath);
        return totalSize;
    }

    async searchFilesRecursive(
        directoryPath: string,
        query: string,
        onResult?: (file: FileInfo) => void,
        onProgress?: (current: number, filesFound: number) => void,
        cancellationToken?: { isCancelled: boolean },
        maxResults: number = 1000,
        maxFilesToProcess: number = 50000
    ): Promise<FileInfo[]> {
        const results: FileInfo[] = [];
        let processedItems = 0;
        const queryLower = query.toLowerCase();

        // Small delay to prevent blocking
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        const searchDirectory = async (dirPath: string): Promise<boolean> => {
            // Check limits and cancellation
            if (cancellationToken?.isCancelled) {
                return false;
            }
            if (results.length >= maxResults) {
                return false; // Stop if max results reached
            }
            if (processedItems >= maxFilesToProcess) {
                return false; // Stop if max files processed
            }

            try {
                const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

                for (const entry of entries) {
                    // Check limits and cancellation
                    if (cancellationToken?.isCancelled) {
                        return false;
                    }
                    if (results.length >= maxResults) {
                        return false;
                    }
                    if (processedItems >= maxFilesToProcess) {
                        return false;
                    }

                    const fullPath = path.join(dirPath, entry.name);

                    try {
                        if (entry.name.toLowerCase().includes(queryLower)) {
                            const stats = await fs.promises.stat(fullPath);
                            const fileInfo: FileInfo = {
                                name: entry.name,
                                isDirectory: entry.isDirectory(),
                                lastModified: stats.mtime.toISOString(),
                                type: entry.isDirectory() ? 'Directory' : path.extname(entry.name) || 'File',
                                size: stats.size,
                                path: fullPath
                            };
                            results.push(fileInfo);
                            if (onResult) {
                                onResult(fileInfo);
                            }
                        }

                        if (entry.isDirectory()) {
                            const shouldContinue = await searchDirectory(fullPath);
                            if (!shouldContinue) {
                                return false;
                            }
                        }
                    } catch {
                        // Skip inaccessible files
                        continue;
                    }

                    processedItems++;

                    // Report progress every 100 files
                    if (processedItems % 100 === 0) {
                        if (onProgress) {
                            onProgress(processedItems, results.length);
                        }
                        // Small delay every batch to prevent complete blocking
                        await delay(1);
                    }
                }
            } catch {
                // Skip inaccessible directories
            }

            return true;
        };

        await searchDirectory(directoryPath);

        // Final progress update
        if (onProgress) {
            onProgress(processedItems, results.length);
        }

        return results;
    }

    // Optimized search using native OS commands (much faster)
    async searchFilesNative(
        directoryPath: string,
        query: string,
        onResult?: (file: FileInfo) => void,
        onProgress?: (processed: number, filesFound: number) => void,
        cancellationToken?: { isCancelled: boolean },
        maxResults: number = 1000
    ): Promise<{ results: FileInfo[], limited: boolean }> {
        const results: FileInfo[] = [];
        const platform = process.platform;
        const queryLower = query.toLowerCase();
        let isLimited = false;

        return new Promise((resolve) => {
            let command: string;

            if (platform === 'win32') {
                // Windows: use dir with recursive search
                command = `dir /s /b /a "${directoryPath}"`;
            } else {
                // Unix/Mac: use find
                command = `find "${directoryPath}" -type f -o -type d`;
            }

            let processed = 0;

            const child = exec(command, { maxBuffer: 1024 * 1024 * 10 }, async (error, stdout) => {
                if (error) {
                    console.error('Search error:', error);
                    resolve({ results, limited: isLimited });
                    return;
                }

                const lines = stdout.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    // Check limits
                    if (results.length >= maxResults) {
                        isLimited = true;
                        break;
                    }
                    if (cancellationToken?.isCancelled) {
                        break;
                    }

                    const fileName = path.basename(line);
                    if (fileName.toLowerCase().includes(queryLower)) {
                        try {
                            const stats = await fs.promises.stat(line);
                            const fileInfo: FileInfo = {
                                name: fileName,
                                isDirectory: stats.isDirectory(),
                                lastModified: stats.mtime.toISOString(),
                                type: stats.isDirectory() ? 'Directory' : path.extname(fileName) || 'File',
                                size: stats.size,
                                path: line
                            };
                            results.push(fileInfo);
                            if (onResult) {
                                onResult(fileInfo);
                            }
                        } catch {
                            // Skip inaccessible files
                        }
                    }

                    processed++;
                    if (processed % 500 === 0 && onProgress) {
                        onProgress(processed, results.length);
                    }
                }

                if (onProgress) {
                    onProgress(processed, results.length);
                }

                resolve({ results, limited: isLimited });
            });

            // Handle cancellation
            if (cancellationToken) {
                const originalCheck = () => {
                    if (cancellationToken.isCancelled) {
                        child.kill();
                    }
                };
                setInterval(originalCheck, 100);
            }
        });
    }
}
