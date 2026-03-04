"use strict";
// File Service - Handles all file system operations
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class FileService {
    readDirectory(directoryPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const files = yield fs.promises.readdir(directoryPath, { withFileTypes: true });
            const fileDetails = [];
            for (const file of files) {
                try {
                    const filePath = path.join(directoryPath, file.name);
                    const stats = yield fs.promises.stat(filePath);
                    fileDetails.push({
                        name: file.name,
                        isDirectory: file.isDirectory(),
                        lastModified: stats.mtime.toISOString(),
                        type: file.isDirectory() ? 'Directory' : path.extname(file.name) || 'File',
                        size: stats.size
                    });
                }
                catch (error) {
                    // Skip files that can't be accessed (permission denied, system files, etc.)
                    console.warn(`Skipping inaccessible file: ${file.name}`, error);
                    continue;
                }
            }
            return fileDetails;
        });
    }
    createFile(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            yield fs.promises.writeFile(filePath, '');
        });
    }
    createFolder(folderPath) {
        return __awaiter(this, void 0, void 0, function* () {
            yield fs.promises.mkdir(folderPath, { recursive: true });
        });
    }
    deleteFile(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const stats = yield fs.promises.stat(filePath);
            if (stats.isDirectory()) {
                yield fs.promises.rmdir(filePath, { recursive: true });
            }
            else {
                yield fs.promises.unlink(filePath);
            }
        });
    }
    renameFile(oldPath, newPath) {
        return __awaiter(this, void 0, void 0, function* () {
            yield fs.promises.rename(oldPath, newPath);
        });
    }
    copyFile(source, destination) {
        return __awaiter(this, void 0, void 0, function* () {
            yield fs.promises.copyFile(source, destination);
        });
    }
    moveFile(source, destination) {
        return __awaiter(this, void 0, void 0, function* () {
            yield fs.promises.rename(source, destination);
        });
    }
    getFileStats(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const stats = yield fs.promises.stat(filePath);
            return {
                name: path.basename(filePath),
                path: filePath,
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                permissions: stats.mode
            };
        });
    }
    searchFiles(directoryPath, query) {
        return __awaiter(this, void 0, void 0, function* () {
            const files = yield fs.promises.readdir(directoryPath, { withFileTypes: true });
            const searchResults = [];
            for (const file of files) {
                try {
                    if (!file.name.toLowerCase().includes(query.toLowerCase())) {
                        continue;
                    }
                    const filePath = path.join(directoryPath, file.name);
                    const stats = yield fs.promises.stat(filePath);
                    searchResults.push({
                        name: file.name,
                        isDirectory: file.isDirectory(),
                        path: filePath,
                        lastModified: stats.mtime.toISOString(),
                        type: file.isDirectory() ? 'Directory' : path.extname(file.name) || 'File',
                        size: stats.size
                    });
                }
                catch (error) {
                    // Skip inaccessible files
                    console.warn(`Skipping inaccessible file: ${file.name}`, error);
                    continue;
                }
            }
            return searchResults;
        });
    }
    exists(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield fs.promises.access(filePath);
                return true;
            }
            catch (_a) {
                return false;
            }
        });
    }
    isDirectory(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const stats = yield fs.promises.stat(filePath);
            return stats.isDirectory();
        });
    }
    calculateFolderSize(folderPath, onProgress, cancellationToken) {
        return __awaiter(this, void 0, void 0, function* () {
            let totalSize = 0;
            let processedItems = 0;
            const calculateSize = (dirPath) => __awaiter(this, void 0, void 0, function* () {
                if (cancellationToken === null || cancellationToken === void 0 ? void 0 : cancellationToken.isCancelled) {
                    return;
                }
                try {
                    const entries = yield fs.promises.readdir(dirPath, { withFileTypes: true });
                    for (const entry of entries) {
                        if (cancellationToken === null || cancellationToken === void 0 ? void 0 : cancellationToken.isCancelled) {
                            return;
                        }
                        const fullPath = path.join(dirPath, entry.name);
                        try {
                            if (entry.isDirectory()) {
                                yield calculateSize(fullPath);
                            }
                            else {
                                const stats = yield fs.promises.stat(fullPath);
                                totalSize += stats.size;
                            }
                        }
                        catch (_a) {
                            // Skip inaccessible files
                            continue;
                        }
                        processedItems++;
                        if (onProgress) {
                            onProgress(processedItems, -1); // -1 indicates unknown total
                        }
                    }
                }
                catch (_b) {
                    // Skip inaccessible directories
                }
            });
            yield calculateSize(folderPath);
            return totalSize;
        });
    }
    searchFilesRecursive(directoryPath, query, onResult, onProgress, cancellationToken, maxResults = 1000, maxFilesToProcess = 50000) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = [];
            let processedItems = 0;
            const queryLower = query.toLowerCase();
            // Small delay to prevent blocking
            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            const searchDirectory = (dirPath) => __awaiter(this, void 0, void 0, function* () {
                // Check limits and cancellation
                if (cancellationToken === null || cancellationToken === void 0 ? void 0 : cancellationToken.isCancelled) {
                    return false;
                }
                if (results.length >= maxResults) {
                    return false; // Stop if max results reached
                }
                if (processedItems >= maxFilesToProcess) {
                    return false; // Stop if max files processed
                }
                try {
                    const entries = yield fs.promises.readdir(dirPath, { withFileTypes: true });
                    for (const entry of entries) {
                        // Check limits and cancellation
                        if (cancellationToken === null || cancellationToken === void 0 ? void 0 : cancellationToken.isCancelled) {
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
                                const stats = yield fs.promises.stat(fullPath);
                                const fileInfo = {
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
                                const shouldContinue = yield searchDirectory(fullPath);
                                if (!shouldContinue) {
                                    return false;
                                }
                            }
                        }
                        catch (_a) {
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
                            yield delay(1);
                        }
                    }
                }
                catch (_b) {
                    // Skip inaccessible directories
                }
                return true;
            });
            yield searchDirectory(directoryPath);
            // Final progress update
            if (onProgress) {
                onProgress(processedItems, results.length);
            }
            return results;
        });
    }
    // Optimized search using native OS commands (much faster)
    searchFilesNative(directoryPath, query, onResult, onProgress, cancellationToken, maxResults = 1000) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = [];
            const platform = process.platform;
            const queryLower = query.toLowerCase();
            let isLimited = false;
            return new Promise((resolve) => {
                let command;
                if (platform === 'win32') {
                    // Windows: use dir with recursive search
                    command = `dir /s /b /a "${directoryPath}"`;
                }
                else {
                    // Unix/Mac: use find
                    command = `find "${directoryPath}" -type f -o -type d`;
                }
                let processed = 0;
                const child = (0, child_process_1.exec)(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout) => __awaiter(this, void 0, void 0, function* () {
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
                        if (cancellationToken === null || cancellationToken === void 0 ? void 0 : cancellationToken.isCancelled) {
                            break;
                        }
                        const fileName = path.basename(line);
                        if (fileName.toLowerCase().includes(queryLower)) {
                            try {
                                const stats = yield fs.promises.stat(line);
                                const fileInfo = {
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
                            }
                            catch (_a) {
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
                }));
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
        });
    }
}
exports.FileService = FileService;
//# sourceMappingURL=FileService.js.map