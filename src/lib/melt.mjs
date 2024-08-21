//@ts-check
import { checkFileExtension, hasFile } from "./strings.mjs";
import { readFile, rename, writeFile } from "fs/promises";
import { readdirSync, rmdirSync, statSync } from "fs";
import { fileList } from "./file.list.mjs";
import { Labels } from "./labels.mjs";
import { join } from "path";


const PROJECT_FILE_NAME = "project.godot";


/** @type {string[]} List of file paths to not melt. */
const pathsToNotMelt = [];


/** @type {Record<string, Remap>} */
const allRemaps = {};
/** @type {Remap[]} */
const mapsToChange = [];
/** @type {Remap[]} */
const mapsToMelt = [];


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

	if (files.length === 0) {
		rmdirSync(folder);
		return;
	}
}


/**
 * @param {string} rootPath 
 * @param {string} filePath 
 */
function remap(rootPath, filePath) {
	const oldPath = filePath.split(rootPath)[1];
	if (!allRemaps[oldPath]) {
		allRemaps[oldPath] = new Remap(oldPath);
	}
	return allRemaps[oldPath];
}


/**
 * @param {Remap} map 
 * @param {Remap[]} to 
 */
function insertMap(map, to) {
	if (to.includes(map)) return;
	to.push(map);
}


class Remap {
	/** @type {Labels} */
	static labels;
	static rootPath = "";
	fileExtension = "";
	oldPath = "";
	myLabel = "";
	melted = false;
	/**
	 * @param {string} oldPath 
	 */
	constructor(oldPath) {
		const fileExtension = oldPath.split(".").pop();
		this.fileExtension = fileExtension ? fileExtension : "";
		this.oldPath = oldPath;
	}
	get filePath() {
		return this.melted ? this.newFilePath : this.oldFilePath;
	}
	get oldFilePath() {
		return join(Remap.rootPath, this.oldPath);
	}
	get newFilePath() {
		return join(Remap.rootPath, this.newPath);
	}
	get oldGodotPath() {
		return "res://" + this.oldPath;
	}
	get newGodotPath() {
		return "res://" + this.newPath;
	}
	get newPath() {
		if (!this.myLabel) {
			this.myLabel = Remap.labels.get(); // It must be here to prevent labels depletion by it getting spammed in the constructor.
		}
		return this.myLabel + "." + this.fileExtension;
	}
	melt() {
		this.melted = true;
		return this;
	}
}


/**
 * Tell Melt to not melt this path.
 * @param {string} path 
 */
export function dontMeltPath(path) {
	if (pathsToNotMelt.includes(path)) return;
	pathsToNotMelt.push(path);
}


/**
 * "Melt" directory into incomprehensible state.
 * @param {string} rootPath 
 * @param {Labels} labels
 */
export async function meltDirectory(rootPath, labels) {
	const filePaths = fileList(rootPath);
	Remap.rootPath = rootPath;
	Remap.labels = labels;
	// Search for project root.
	for (const path of filePaths) {
		if (hasFile(PROJECT_FILE_NAME, path)) {
			rootPath = path.split(PROJECT_FILE_NAME)[0];
			break;
		}
	}
	// Search for GDResource files.
	for (const filePath of filePaths) {
		const map = remap(rootPath, filePath);
		const oldPath = map.oldPath;
		if (pathsToNotMelt.includes(oldPath)) {
			// Don't melt user specified files.
			continue;
		}
		if (checkFileExtension(oldPath, [ "cfg", "godot", "csv" ]) || hasFile("default_env.tres", oldPath)) {
			insertMap(map, mapsToChange);
		}
		if (!checkFileExtension(oldPath, [ "tscn", "tres", "gd" ])) {
			continue;
		}
		insertMap(map, mapsToChange);
		insertMap(map.melt(), mapsToMelt);
	}
	// Move files.
	for (const map of mapsToMelt) {
		await rename(map.oldFilePath, map.newFilePath);
	}
	// Alternate paths.
	for (const map of mapsToChange) {
		const filePath = map.filePath;
		let str = await readFile(filePath, { encoding: "utf-8" });
		for (const meltedMap of mapsToMelt) {
			const oldGodotPath = meltedMap.oldGodotPath;
			const newGodotPath = meltedMap.newGodotPath;
			str = str
				.split(`'${oldGodotPath}'`).join(`'${newGodotPath}'`)
				.split(`"${oldGodotPath}"`).join(`"${newGodotPath}"`)
				.split(`'*${oldGodotPath}'`).join(`'*${newGodotPath}'`)
				.split(`"*${oldGodotPath}"`).join(`"*${newGodotPath}"`)
				.split(`\\"${oldGodotPath}\\"`).join(`\\"${newGodotPath}\\"`)
				.split(`\\"*${oldGodotPath}\\"`).join(`\\"*${newGodotPath}\\"`);
		}
		await writeFile(filePath, str);
	}
	// Clear empty directories.
	cleanEmptyFoldersRecursively(rootPath);
}
