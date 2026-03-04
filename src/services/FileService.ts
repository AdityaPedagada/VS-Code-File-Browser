// File Service - Handles all file system operations

import * as fs from 'fs';
import * as path from 'path';
import { FileInfo, FileProperties, IFileService } from '../types';

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
}
