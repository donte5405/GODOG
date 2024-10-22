//@ts-check
import * as Path from "path";
import * as Fs from "fs";


const excludedDirsWithFiles = [ "godogignore" ];


/**
 * @param {string} dir 
 * @param {string[]} excludeDirsWithFiles 
 */
function isThisDirectoryExcluded(dir, excludeDirsWithFiles) {
	for (const indicatorFile of [ ...excludeDirsWithFiles, ...excludedDirsWithFiles ]) {
		const iAbsolute = Path.join(dir, indicatorFile);
		if (Fs.existsSync(iAbsolute)) {
			return true;
		}
	}
	return false;
}


/**
 * Convert specified paths to relative paths.
 * @param {string} rootPath
 * @param {string[]} paths 
 */
export function convertToRelativePaths(rootPath, paths) {
	for (let i = 0; i < paths.length; i++) {
		paths[i] = convertToRelativePath(rootPath, paths[i]);
	}
	return paths;
}


/**
 * Convert specified path to relative path.
 * @param {string} rootPath
 * @param {string} path
 */
export function convertToRelativePath(rootPath, path) {
	const destPart = path.split(rootPath).pop();
	if (destPart) {
		return destPart;
	}
	return path;
}


/**
 * Search for all files in the directory.
 * @param {string} dir Directory location.
 * @param {string[]} excludeDirsWithFiles List of files/directories that's an indicator to disregard the entire directory.
 * @param {string[]} ignoredFiles List of files/directories to be ignored.
 * @param {string[]} [files] List of previous files (blank if not specified).
 */
export function fileList(dir, excludeDirsWithFiles = [], ignoredFiles = [], files = []) {
	if (isThisDirectoryExcluded(dir, [ ...excludeDirsWithFiles, ...excludedDirsWithFiles ])) {
		return files;
	}
	Fs.readdirSync(dir).forEach(file => {
		if (ignoredFiles.includes(file)) return;
		// switch (file[0]) {
		//	 case ".":
		//		 return;
		// }
		const absolute = Path.join(dir, file);
		if (Fs.statSync(absolute).isDirectory()) {
			fileList(absolute, excludeDirsWithFiles, ignoredFiles, files);
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
export function dirList(dir, excludeDirsWithFiles = [], dirs = []) {
	if (isThisDirectoryExcluded(dir, [ ...excludeDirsWithFiles, ...excludedDirsWithFiles ])) {
		return dirs;
	}
	dirs.push(dir);
	Fs.readdirSync(dir).forEach(file => {
		switch (file[0]) {
			case ".":
				return;
		}
		const absolute = Path.join(dir, file);
		if (Fs.statSync(absolute).isDirectory()) {
			dirList(absolute, excludeDirsWithFiles, dirs);
			return;
		}
	});
	return dirs;
}
