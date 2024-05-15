//@ts-check
import * as Path from "path";
import * as Fs from "fs";


/**
 * Search for all files in the directory.
 * @param {string} dir Directory location.
 * @param {string[]} [files] List of previous files (blank if not specified).
 */
export function fileList(dir, files = []) {
    Fs.readdirSync(dir).forEach(file => {
        switch (file[0]) {
            case ".":
                return;
        }
        const absolute = Path.join(dir, file);
        if (Fs.statSync(absolute).isDirectory()) {
            fileList(absolute, files);
            return;
        }
        files.push(absolute);
    });
    return files;
}


/**
 * Search for all directories in the directory.
 * @param {string} dir Directory location.
 * @param {string[]} [dirs] List of previous directories (blank if not specified).
 */
export function dirList(dir, dirs = []) {
    Fs.readdirSync(dir).forEach(file => {
        switch (file[0]) {
            case ".":
                return;
        }
        const absolute = Path.join(dir, file);
        if (Fs.statSync(absolute).isDirectory()) {
            dirList(absolute, dirs);
            dirs.push(absolute);
            return;
        }
    });
    return dirs;
}
