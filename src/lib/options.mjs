//@ts-check
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { writeFile } from "fs/promises";
import { join } from "path";


class Configuration {
    /** @type {Record<string,string>} */
    data = {};

    /** If project melt enabled. */
    get meltEnabled() { return this.data["scrambleGodotFiles"] ? true : false; }

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
