"use strict";
// Type definitions for File Browser Extension
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileAction = exports.ViewMode = exports.SortDirection = exports.SortOption = void 0;
// ============= Enums =============
var SortOption;
(function (SortOption) {
    SortOption["Name"] = "name";
    SortOption["Modified"] = "modified";
    SortOption["Type"] = "type";
    SortOption["Size"] = "size";
})(SortOption = exports.SortOption || (exports.SortOption = {}));
var SortDirection;
(function (SortDirection) {
    SortDirection["Ascending"] = "asc";
    SortDirection["Descending"] = "desc";
})(SortDirection = exports.SortDirection || (exports.SortDirection = {}));
var ViewMode;
(function (ViewMode) {
    ViewMode["Grid"] = "grid";
    ViewMode["List"] = "list";
})(ViewMode = exports.ViewMode || (exports.ViewMode = {}));
var FileAction;
(function (FileAction) {
    FileAction["Open"] = "open";
    FileAction["OpenInNewWindow"] = "openinnewwindow";
    FileAction["OpenInExplorer"] = "openinexplorer";
    FileAction["Delete"] = "delete";
    FileAction["Rename"] = "rename";
    FileAction["NewFolder"] = "newFolder";
    FileAction["NewFile"] = "newFile";
    FileAction["Copy"] = "copy";
    FileAction["Cut"] = "cut";
    FileAction["Paste"] = "paste";
    FileAction["Properties"] = "properties";
})(FileAction = exports.FileAction || (exports.FileAction = {}));
//# sourceMappingURL=index.js.map