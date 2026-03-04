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
class FileService {
    readDirectory(directoryPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const files = yield fs.promises.readdir(directoryPath, { withFileTypes: true });
            const fileDetails = yield Promise.all(files.map((file) => __awaiter(this, void 0, void 0, function* () {
                const filePath = path.join(directoryPath, file.name);
                const stats = yield fs.promises.stat(filePath);
                return {
                    name: file.name,
                    isDirectory: file.isDirectory(),
                    lastModified: stats.mtime.toISOString(),
                    type: file.isDirectory() ? 'Directory' : path.extname(file.name) || 'File',
                    size: stats.size
                };
            })));
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
            const searchResults = files
                .filter(file => file.name.toLowerCase().includes(query.toLowerCase()))
                .map(file => {
                const filePath = path.join(directoryPath, file.name);
                const stats = fs.statSync(filePath);
                return {
                    name: file.name,
                    isDirectory: file.isDirectory(),
                    path: filePath,
                    lastModified: stats.mtime.toISOString(),
                    type: file.isDirectory() ? 'Directory' : path.extname(file.name) || 'File',
                    size: stats.size
                };
            });
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
}
exports.FileService = FileService;
//# sourceMappingURL=FileService.js.map