//@ts-check
import * as Path from "path";
import * as Fs from "fs";


/**
 * Search for all files in the directory.
 * @param {string} dir Directory location.
 * @param {string[]} ignoredFiles List of files/directories to be ignored.
 * @param {string[]} [files] List of previous files (blank if not specified).
 */
export function fileList(dir, ignoredFiles = [], files = []) {
    Fs.readdirSync(dir).forEach(file => {
        if (ignoredFiles.includes(file)) return;
        switch (file[0]) {
            case ".":
                return;
        }
        const absolute = Path.join(dir, file);
        if (Fs.statSync(absolute).isDirectory()) {
            fileList(absolute, ignoredFiles, files);
            return;
        }
        files.push(absolute);
    });
    return files;
}


/**
 * Search for all directories in the directory.
 * @param {string} dir Directory location.
 * @param {string[]} excludeDirsWithFiles List of files/directories that's an indicator to disregard the entire directory.
 * @param {string[]} [dirs] List of previous directories (blank if not specified).
 */
export function dirList(dir, excludeDirsWithFiles = [ ".gdignore" ], dirs = []) {
    for (const indicatorFile of excludeDirsWithFiles) {
        const iAbsolute = Path.join(dir, indicatorFile);
        if (Fs.statSync(iAbsolute).isFile()) {
            return dirs;
        }
    }
    Fs.readdirSync(dir).forEach(file => {
        if (excludeDirsWithFiles.includes(file)) return;
        switch (file[0]) {
            case ".":
                return;
        }
        const absolute = Path.join(dir, file);
        if (Fs.statSync(absolute).isDirectory()) {
            dirList(absolute, excludeDirsWithFiles, dirs);
            dirs.push(absolute);
            return;
        }
    });
    return dirs;
}
