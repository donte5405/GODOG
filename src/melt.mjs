//@ts-check
// This module swaps around file and directory entries.
import { checkFileExtension, hasFile } from "./lib/strings.mjs";
import { readFile, rename, writeFile } from "fs/promises";
import { readdirSync, rmdirSync, statSync } from "fs";
import { fileList } from "./lib/file.list.mjs";
import { Labels } from "./lib/labels.mjs";
import { join } from "path";


const PROJECT_FILE_NAME = "project.godot";


/**
 * From: https://gist.github.com/jakub-g/5903dc7e4028133704a4
 * @param {string} folder 
 */
function cleanEmptyFoldersRecursively(folder) {
    var isDir = statSync(folder).isDirectory();
    if (!isDir) {
        return;
    }
    var files = readdirSync(folder);
    if (files.length > 0) {
        files.forEach(function (file) {
            var fullPath = join(folder, file);
            cleanEmptyFoldersRecursively(fullPath);
        });

        // re-evaluate files; after deleting subfolder
        // we may have parent folder empty now
        files = readdirSync(folder);
    }

    if (files.length == 0) {
        rmdirSync(folder);
        return;
    }
}


/**
 * "Melt" directory into incomprehensible state.
 * @param {string} realPath 
 * @param {Labels} labels
 */
export async function meltDirectory(realPath, labels) {
    const filePaths = fileList(realPath);
    let rootPath = "";
    for (const path of filePaths) {
        if (hasFile(PROJECT_FILE_NAME, path)) {
            rootPath = path.split(PROJECT_FILE_NAME)[0];
            break;
        }
    }
    /** @type {string[]} */
    const filesToChange = [];
    /** @type {[string, string][]} [oldFilePath, newFilePath] */
    const newPaths = [];
    /** @type {[string, string][]} [oldGodotPath, newGodotPath]*/
    const newGodotPaths = [];
    for (const i in filePaths) {
        const oldFilePath = filePaths[i];
        const pathDotSplit = oldFilePath.split(".");
        const fileExtension = pathDotSplit[pathDotSplit.length - 1];
        const newFileName = labels.get() + "." + fileExtension;
        const newFilePath = rootPath + newFileName;
        if (checkFileExtension(oldFilePath, [ "cfg", "godot", "csv" ]) || hasFile("default_env.tres", oldFilePath)) {
            filesToChange.push(oldFilePath);
            continue;
        }
        if (!checkFileExtension(oldFilePath, [ "tscn", "tres", "gd" ])) {
            continue;
        }
        const oldGodotPath = "res://" + oldFilePath.split(rootPath)[1];
        const newGodotPath = "res://" + newFileName;
        filesToChange.push(newFilePath);
        labels.map(oldGodotPath, newGodotPath);
        newPaths.push([oldFilePath, newFilePath]);
        newGodotPaths.push([oldGodotPath, newGodotPath]);
    }
    // Move files.
    for (const [oldFilePath, newFilePath] of newPaths) {
        await rename(oldFilePath, newFilePath);
    }
    // Alternate paths.
    for (const path of filesToChange) {
        let str = await readFile(path, { encoding: "utf-8" });
        for (const [oldGodotPath, newGodotPath] of newGodotPaths) {
            str = str
                .split(`'${oldGodotPath}'`).join(`'${newGodotPath}'`)
                .split(`"${oldGodotPath}"`).join(`"${newGodotPath}"`)
                .split(`'*${oldGodotPath}'`).join(`'${newGodotPath}'`)
                .split(`"*${oldGodotPath}"`).join(`"${newGodotPath}"`)
                .split(`\\"${oldGodotPath}\\"`).join(`\\"${newGodotPath}\\"`);
            await writeFile(path, str);
        }
    }
    // Clear empty directories.
    cleanEmptyFoldersRecursively(realPath);
}
