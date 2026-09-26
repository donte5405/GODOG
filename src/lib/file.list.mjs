//@ts-check
import * as Path from "path";
import * as Fs from "fs";


const dontMeltDirsWithFiles = [ "godogexpose" ];
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
 * @param {string} dir 
 */
function isThisDirectoryMarkedToNotMelt(dir) {
	for (const indicatorFile of [ ...dontMeltDirsWithFiles ]) {
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
 * @param {Record<string, boolean>} [filesToNotMelt] List of files to not be melted.
 */
export function fileList(dir, excludeDirsWithFiles = [], ignoredFiles = [], files = [], filesToNotMelt = {}, markedToNotMelt = false, isRoot = true) {
	const ret = () => {
		const toNotMelt = Object.keys(filesToNotMelt);
		if (isRoot) {
			for (let i = 0; i < toNotMelt.length; i++) {
				toNotMelt[i] = toNotMelt[i].slice(dir.length + 1, toNotMelt[i].length)
			}
		}
		return { files, filesToNotMelt: toNotMelt };
	};
	markedToNotMelt = markedToNotMelt || isThisDirectoryMarkedToNotMelt(dir);
	if (!markedToNotMelt) {
		if (isThisDirectoryExcluded(dir, [ ...excludeDirsWithFiles, ...excludedDirsWithFiles ])) {
			return ret();
		}
	}
	Fs.readdirSync(dir).forEach(file => {
		if (ignoredFiles.includes(file)) return;
		// switch (file[0]) {
		//	 case ".":
		//		 return;
		// }
		switch (file) {
			case ".git":
				return;
			case ".import":
				return;
		}
		const absolute = Path.join(dir, file);
		if (Fs.statSync(absolute).isDirectory()) {
			fileList(absolute, excludeDirsWithFiles, ignoredFiles, files, filesToNotMelt, markedToNotMelt, false);
			return;
		}
		if (markedToNotMelt) {
			filesToNotMelt[absolute] = true;
		}
		files.push(absolute);
	});
	return ret();
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
