//@ts-check
import { checkFileExtension, hasFile } from "./strings.mjs";
import { readFile, rename, writeFile } from "fs/promises";
import { readdirSync, rmdirSync, statSync } from "fs";
import { fileList } from "./file.list.mjs";
import { Labels } from "./labels.mjs";
import { join } from "path";


const PROJECT_FILE_NAME = "project.godot";


/** @type {Record<string, Remap>} */
const mapsToChange = {}
/** @type {Record<string, Remap>} */
const mapsToMelt = {};


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
	/**
	 * @param {string} rootPath 
	 * @param {string} filePath 
	 */
	constructor(rootPath, filePath) {
		const oldPath = filePath.split(rootPath)[1];
		const fileExtension = oldPath.split(".").pop();
		this.fileExtension = fileExtension ? fileExtension : "";
		this.oldPath = oldPath;
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
	for (const path of filePaths) {
        if (hasFile(PROJECT_FILE_NAME, path)) {
            rootPath = path.split(PROJECT_FILE_NAME)[0];
            break;
        }
    }
	for (const filePath of filePaths) {
		const map = new Remap(rootPath, filePath);
		const oldPath = map.oldPath;
		if (checkFileExtension(oldPath, [ "cfg", "godot", "csv" ]) || hasFile("default_env.tres", oldPath)) {
			if (mapsToChange[oldPath]) continue;
			mapsToChange[oldPath] = map;
            continue;
        }
        if (!checkFileExtension(oldPath, [ "tscn", "tres", "gd" ])) {
            continue;
        }
		if (mapsToMelt[oldPath]) continue;
		mapsToMelt[oldPath] = map;
	}
	const allMapsToMelt = Object.values(mapsToMelt);
	const allMapsToChange = Object.values(mapsToChange);
	// Move files.
	for (const map of allMapsToMelt) {
		await rename(map.oldFilePath, map.newFilePath);
	}
	// Alternate paths.
	for (const map of allMapsToChange) {
		const newFilePath = allMapsToMelt.includes(map) ? map.newFilePath : map.oldFilePath;
        let str = await readFile(newFilePath, { encoding: "utf-8" });
        for (const meltedMap of allMapsToMelt) {
			const oldGodotPath = meltedMap.oldGodotPath;
			const newGodotPath = meltedMap.newGodotPath;
            str = str
                .split(`'${oldGodotPath}'`).join(`'${newGodotPath}'`)
                .split(`"${oldGodotPath}"`).join(`"${newGodotPath}"`)
                .split(`'*${oldGodotPath}'`).join(`'${newGodotPath}'`)
                .split(`"*${oldGodotPath}"`).join(`"${newGodotPath}"`)
                .split(`\\"${oldGodotPath}\\"`).join(`\\"${newGodotPath}\\"`);
		}
		await writeFile(newFilePath, str);
    }
	// Clear empty directories.
    cleanEmptyFoldersRecursively(rootPath);
	await writeFile("./TEST.json", JSON.stringify(mapsToMelt));
	await writeFile("./TEST2.json", JSON.stringify(mapsToChange));
}
