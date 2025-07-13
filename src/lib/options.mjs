//@ts-check
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { writeFile } from "fs/promises";
import { join } from "path";


const errHuman = new Error("Developer's fault detected, configuration not loaded yet.");


export class Configuration {
	/** This is for internal use, indicates if any of crucial preprocessors are detected. */
	crucialPreprocessorsDetected = false;
	/** @type {string[]} List of process arguments.*/
	processArgs = [];
	/** @type {Record<string,string>} */
	data = {};

	/** Project's directory path. */
	projDirPath = "";

	/**
	 * Check if specified key exists in either process arguments or the configuration file.
	 * @param {string} key 
	 */
	check(key) {
		return this.data[key] ? true : false;
	}

	/** If project melt enabled. */
	get meltEnabled() { return this.check("scrambleGodotFiles"); }
	/** List of importable files that can be melted. */
	get meltImports() { return this.data["scrambleImports"] || []; }
	/** List of non-importable files that can be melted. */
	get meltFiles() { return this.data["scrambleFiles"] || []; }
	/** If type casting should be bothered. */
	get removeTypeCasting() { return this.check("removeTypeCasting"); }
	/** If this project will ignore crucial preprocessors and skip source code leak risks altogether. */
	get ignoreCrucialPreprocessors() { return this.check("ignoreCrucialPreprocessors"); }
	/** If this project will keep all ignore blocks, useful for exporting debug builds. */
	get keepIgnoreBlocks() { return this.check("keepIgnoreBlocks"); }
	/** If this project will have export parameters stripped. */
	get stripExportParams() { return this.check("noExportParams"); }

	constructor(o) {
		if (o) this.data = o;
		if (o["scrambleImports"] === true) {
			// Set default for imports.
			o["scrambleImports"] = [ "gltf", "glb", "obj", "fbx", "dae", "bmp", "tga", "png", "jpg", "webp", "gif", "svg", "wav", "ogg", "mp3" ];
		}
	}
}


/** @type {Configuration} Currently active config. */
let config;


/**
 * Load configuration blob.
 * @param {string} projectPath 
 */
export async function loadConfig(projectPath) {
	const configPath = join(projectPath, "/godog.json");
	if (!existsSync(configPath)) {
		await writeFile(configPath, "{}");
	}
	config = new Configuration(JSON.parse(await readFile(configPath, {encoding: "utf-8"})));
	return config;
}


/** Get currently active config. */
export function getConfig() {
	if (!config) {
		throw errHuman;
	}
	return config;
}
