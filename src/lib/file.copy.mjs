//@ts-check
import { convertToRelativePath, dirList, fileList } from "./file.list.mjs";
import { cp, mkdir } from "fs/promises";
import { join } from "path";


const fsOptions = { recursive: true, force: true };


/**
 * Selectively copy files from specified source directory to specified destination directory.
 * @param {string} source 
 * @param {string} destination 
 * @param {string[]} excludeDirsWithFiles 
 * @param {string[]} ignoredFiles
 */
export async function filesCopySelectively(source, destination, excludeDirsWithFiles = [ ".gdignore", "godogignore" ], ignoredFiles = []) {
	for (const sourceDir of [ source, ...dirList(source, excludeDirsWithFiles)]) {
		const destDir = join(destination, convertToRelativePath(source, sourceDir));
		await mkdir(destDir, fsOptions);
		for (const sourceFile of fileList(sourceDir, ignoredFiles)) {
			const destFile = join(destination, convertToRelativePath(source, sourceFile));
			await cp(sourceFile, destFile, fsOptions);
		}
	}
}
