//@ts-check
import { checkFileExtension, hasFile } from "./strings.mjs";
import { access, constants, readFile, rename, writeFile } from "fs/promises";
import { readdirSync, rmdirSync, statSync } from "fs";
import { fileList } from "./file.list.mjs";
import { Labels } from "./labels.mjs";
import { join } from "path";
import { getConfig } from "./options.mjs";

const PROJECT_FILE_NAME = "project.godot";

/** @type {Record<string,boolean>} */
const userDefinedPathsToNotMelt = {};

/** @type {Record<string,boolean>} */
const possibleGodotPaths = {};

/** @type {Record<string, string>} */
const fileRemaps = {};


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


class Remap {
	/** @type {Labels} */
	static labels;
	static rootPath = "";
	fileExtension = "";
	oldPath = "";
	myLabel = "";
	melted = false;
	isImportable = false;
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
		if (!this.melted) {
			return this.oldPath;
		}
		if (!this.myLabel) {
			this.myLabel = Remap.labels.get(); // It must be here to prevent labels depletion by it getting spammed in the constructor.
		}
		return this.myLabel + "." + this.fileExtension;
	}
	melt() {
		this.melted = true;
		return this;
	}
	importable() {
		this.isImportable = true;
		return this;
	}
}


/**
 * @param {string} str 
 * @param {string} old
 * @param {string} newOne
 */
function formatAllPossibleStringTypes(str, old, newOne) {
	return str.split(`'${old}'`).join(`'${newOne}'`)
	.split(`"${old}"`).join(`"${newOne}"`)
	.split(`'*${old}'`).join(`'*${newOne}'`)
	.split(`"*${old}"`).join(`"*${newOne}"`)
	.split(`\\"${old}\\"`).join(`\\"${newOne}\\"`)
	.split(`\\"*${old}\\"`).join(`\\"*${newOne}\\"`);
}


/**
 * Tell Melt to not melt this path.
 * @param {string} path 
 */
export function dontMeltPath(path) {
	path = "res://" + path;
	userDefinedPathsToNotMelt[path] = true;
}


/**
 * Add specified Godot path to the list of all possible Godot paths.
 * @param {string} path 
 */
export function addPossibleGodotPath(path) {
	path = "res://" + path;
	possibleGodotPaths[path] = true;
}


/**
 * Generate null files for non-existing file references.
 * @param {string} rootPath 
 */
export async function generateNullFiles(rootPath) {
	await writeFile(rootPath + "/_null.cs", "\n");
	await writeFile(rootPath + "/_null.gd", "extends Object\n");
	await writeFile(rootPath + "/_null.tres", "[gd_resource type=\"Resource\" format=2]\n\n[resource]\n");
	await writeFile(rootPath + "/_null.tscn", "[gd_scene format=2]\n\n[node name=\"NullScene\" type=\"Node\"]\n");
}


/**
 * "Melt" directory into incomprehensible state.
 * @param {string} rootPath 
 * @param {Labels} labels
 */
export async function meltDirectory(rootPath, labels) {
	/** @type {Record<string, Remap>} */
	const allRemaps = {};

	/** @type {Remap[]} */
	const mapsToMelt = [];

	/** @type {Remap[]} */
	const mapsToChange = [];
	
	const {
		files: filePaths,
		filesToNotMelt,
	} = fileList(rootPath);
	
	const toNotMelt = [
		...filesToNotMelt,
		...Object.keys(userDefinedPathsToNotMelt),
	];

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

	const config = getConfig();
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
		if (oldPath.endsWith(".import")) continue;
		/** @param {Remap} m */
		const decideToMelt = (m) => {
			if (toNotMelt.includes(oldPath)) {
				return false;
			}
			m.melt();
			insertMap(m, mapsToMelt);
			return true;
		};
		if (checkFileExtension(oldPath, ["cfg", "godot", "csv"]) || hasFile("default_env.tres", oldPath)) {
			insertMap(map, mapsToChange);
			continue;
		}
		if (checkFileExtension(oldPath, ["tscn", "tres", "gd", "cs"])) {
			insertMap(map, mapsToChange);
			decideToMelt(map);
			continue;
		}
		if (checkFileExtension(oldPath, config.meltImports)) {
			try {
				await access(map.oldFilePath + ".import", constants.F_OK);
			} catch {
				// If it can't open the file, skip (as the file isn't imported).
				continue;
			}
			insertMap(map, mapsToChange);
			if (decideToMelt(map)) {
				map.importable();
			}
			continue;
		}
		if (!checkFileExtension(oldPath, config.meltFiles)) {
			decideToMelt(map);
			continue;
		}
	}
	// Move files.
	for (const map of mapsToMelt) {
		await rename(map.oldFilePath, map.newFilePath);
		if (map.isImportable) {
			await rename(map.oldFilePath + ".import", map.newFilePath + ".import");
		}
	}
	// Re-scan
	const { files: movedFiles } = fileList(rootPath);
	// Alternate paths.
	for (const map of mapsToChange) {
		const filePath = map.filePath + (map.isImportable ? ".import" : "");
		let str = await readFile(filePath, { encoding: "utf-8" });
		for (const meltedMap of mapsToMelt) {
			str = formatAllPossibleStringTypes(str, meltedMap.oldGodotPath, meltedMap.newGodotPath);
			if (!movedFiles.includes(meltedMap.newPath)) {
				// If there's nonexisting files (e.g., server files that somehow get referenced to the client),
				// they will be replaced with dummy file references.
				let path = meltedMap.oldGodotPath;
				if (checkFileExtension(path, "gd")) {
					str = formatAllPossibleStringTypes(str, path, "res://_null.gd");
				} else if (checkFileExtension(path, "cs")) {
					str = formatAllPossibleStringTypes(str, path, "res://_null.cs");
				} else if (checkFileExtension(path, "tres")) {
					str = formatAllPossibleStringTypes(str, path, "res://_null.tres");
				} else if (checkFileExtension(path, "tscn")) {
					str = formatAllPossibleStringTypes(str, path, "res://_null.tscn");
				}
			}
		}
		await writeFile(filePath, str);
	}
	// Clear empty directories.
	cleanEmptyFoldersRecursively(rootPath);
	for (const remap of mapsToMelt) {
		fileRemaps[remap.oldGodotPath] = remap.newGodotPath;
		fileRemaps[remap.newGodotPath] = remap.oldGodotPath;
	}
	return fileRemaps;
}

export function getFileRemaps() {
	return fileRemaps;
}
