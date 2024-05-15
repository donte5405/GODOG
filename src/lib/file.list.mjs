//@ts-check
import * as Path from "path";
import * as Fs from "fs";


/**
 * Search for all files in the directory.
 * @param {string} dir Directory location.
 * @param {string[]} ignoreNames List of files/directories to be ignored.
 * @param {string[]} [files] List of previous files (blank if not specified).
 */
export function fileList(dir, ignoreNames = [], files = []) {
    Fs.readdirSync(dir).forEach(file => {
        if (ignoreNames.includes(file)) return;
        switch (file[0]) {
            case ".":
                return;
        }
        const absolute = Path.join(dir, file);
        if (Fs.statSync(absolute).isDirectory()) {
            fileList(absolute, ignoreNames, files);
            return;
        }
        files.push(absolute);
    });
    return files;
}


/**
 * Search for all directories in the directory.
 * @param {string} dir Directory location.
 * @param {string[]} ignoreNames List of files/directories to be ignored.
 * @param {string[]} [dirs] List of previous directories (blank if not specified).
 */
export function dirList(dir, ignoreNames = [ ".gdignore" ], dirs = []) {
    for (const ignoreName of ignoreNames) {
        const iAbsolute = Path.join(dir, ignoreName);
        if (Fs.statSync(iAbsolute).isFile()) {
            return dirs;
        }
    }
    Fs.readdirSync(dir).forEach(file => {
        if (ignoreNames.includes(file)) return;
        switch (file[0]) {
            case ".":
                return;
        }
        const absolute = Path.join(dir, file);
        if (Fs.statSync(absolute).isDirectory()) {
            dirList(absolute, ignoreNames, dirs);
            dirs.push(absolute);
            return;
        }
    });
    return dirs;
}
