//@ts-check
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { writeFile } from "fs/promises";
import { join } from "path";


export class Configuration {
    /** This is for internal use, indicates if any of crucial preprocessors are detected. */
    crucialPreprocessorsDetected = false;
    /** @type {string[]} List of process arguments.*/
    processArgs = [];
    /** @type {Record<string,string>} */
    data = {};

    /**
     * Check if specified key exists in either process arguments or the configuration file.
     * @param {string} key 
     */
    check(key) {
        return this.data[key] ? true : false;
    }

    /** If project melt enabled. */
    get meltEnabled() { return this.check("scrambleGodotFiles"); }
    /** If this is configured to ignore string formattings. */
    get ignoreStringFormattings() { return this.check("ignoreStringFormattings"); }
    /** If type casting should be bothered. */
    get removeTypeCasting() { return this.check("removeTypeCasting"); }
    /** This tells directory path for the version with   */
    get exportDebugTo() { return process.argv[4];}
    /** If this project will ignore crucial preprocessors and skip source code leak risks altogether. */
    get ignoreCrucialPreprocessors() { return this.check("ignoreCrucialPreprocessors"); }

    constructor(o) {
        if (o) this.data = o;
    }
}


/**
 * Load configuration blob.
 * @param {string} projectPath 
 */
export async function loadConfig(projectPath) {
    const configPath = join(projectPath, "/godog.json");
    if (!existsSync(configPath)) {
        await writeFile(configPath, "{}");
    }
    return new Configuration(JSON.parse(await readFile(configPath, {encoding: "utf-8"})));
}
