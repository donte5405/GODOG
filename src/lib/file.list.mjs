//@ts-check
import * as Path from "path";
import * as Fs from "fs";


/**
 * Search for all files in the directory.
 * @param {string} dir Directory location.
 * @param {boolean} ignoreFilesWithPrefixes Ignore files with '.' or '_' prefixes.
 * @param {string[]} [files] List of previous files (blank if not specified)
 */
export function fileList(dir, ignoreFilesWithPrefixes = true, files = []) {
    Fs.readdirSync(dir).forEach(file => {
        if (ignoreFilesWithPrefixes) {
            switch (file[0]) {
                case ".": case "_":
                    return;
            }
        }
        const absolute = Path.join(dir, file);
        if (Fs.statSync(absolute).isDirectory()) {
            fileList(absolute, ignoreFilesWithPrefixes, files);
            return;
        }
        files.push(absolute);
    });
    return files;
}


/**
 * Search for all directories in the directory.
 * @param {string} dir Directory location.
 * @param {boolean} ignoreDirsWithPrefixes Ignore directories with '.' or '_' prefixes.
 * @param {string[]} [dirs] List of previous directories (blank if not specified)
 */
export function dirList(dir, ignoreDirsWithPrefixes = true, dirs = []) {
    Fs.readdirSync(dir).forEach(file => {
        if (ignoreDirsWithPrefixes) {
            switch (file[0]) {
                case ".": case "_":
                    return;
            }
        }
        const absolute = Path.join(dir, file);
        if (Fs.statSync(absolute).isDirectory()) {
            dirList(absolute, ignoreDirsWithPrefixes, dirs);
            dirs.push(absolute);
            return;
        }
    });
    return dirs;
}
