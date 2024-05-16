//@ts-check
import { existsSync } from "fs";
import { mkdir, readFile, rename, rm, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { fileList } from "./lib/file.list.mjs";
import { labels } from "./lib/labels.mjs";
import { shuffleArray } from "./lib/shuffle.mjs";
import { GDParser, parserSetConfig } from "./lib/parser.mjs";
import { checkFileExtension } from "./lib/strings.mjs";
import { loadConfig } from "./lib/options.mjs";
import { flushTranslations, translations } from "./lib/locale.mjs";
import { parseLocaleCsv } from "./lib/locale.csv.mjs";
import { stripGdBlockFromFile } from "./lib/preprocessor.mjs";
import { filesCopySelectively } from "./lib/file.copy.mjs";
import { randomUUID } from "crypto";
import { meltDirectory } from "./lib/melt.mjs";


if (!process.argv[2]) {
    throw new Error("Project location must be specified");
}


// Set & check for project main directory location.
const dirLocation = resolve(process.argv[2]);
if (!existsSync(dirLocation)) {
    throw new Error("Project source directory invalid.");
}


// Get project config.
console.log("Loading project config...");
const config = await loadConfig(dirLocation);
parserSetConfig(config);


// Dry run.
const isDryRun = !process.argv[3];
console.log("Analysing the entire project...");
for (const fileLocation of fileList(dirLocation)) {
    if (checkFileExtension(fileLocation, "gd")) {
        // Check GDScripts.
        await GDParser.parseFile(fileLocation);
    } else if (checkFileExtension(fileLocation, [ "godot", "tscn", "tres", "cfg" ])) {
        // Check GDResources.
        await GDParser.parseFile(fileLocation, "tscn");
    } else if (checkFileExtension(fileLocation, "csv")) {
        // Check CSV.
        parseLocaleCsv(await readFile(fileLocation, { encoding: "utf-8" }));
    }
}


// If crucial preprocessors are detected while exporting without server, STOP.
const dirOutServerLocation = process.argv[4] ? resolve(process.argv[4]) : "";
if (!dirOutServerLocation && config.crucialPreprocessorsDetected && !config.ignoreCrucialPreprocessors) {
    if (isDryRun) {
        console.log("Tests passed, but the project seems to have special client-server preprocessors.");
        console.log("Only client-server exports will be supported for this project.");
        process.exit(0);
    } else {
        console.error("Crucial preprocessors detected (client & server preprocessors) but no server directory indicated.");
        console.error("GODOG will NOT allow client-only exports if client-server preprocessors are detected to prevent source code leak.");
        console.error("Failed to export the project.");
        process.exit(1);
    }
}


if (isDryRun) {
    console.log("Tests passed, your project seems to be fully compatible with GODOG!");
    process.exit(0);
}


// Prepare other variables.
const fsOptions = { recursive: true, force: true };
const tempLocation = dirLocation + "-" + randomUUID();
const translationLocation = join(tempLocation, "/tr");
const dirOutLocation = resolve(process.argv[3]);


if (!existsSync(dirOutLocation)) {
    throw new Error("Project destination directory invalid.");
}


// Creating a new temp directory.
console.log("Cleaning up messes...");
await mkdir(tempLocation, fsOptions);
await mkdir(translationLocation, fsOptions);


// Copy source files to the temp directory.
console.log("Copying source files...");
await filesCopySelectively(dirLocation, tempLocation);


// Note all files in the temp directory.
console.log("Listing all files...");
const tempLocationFiles = fileList(tempLocation);


// Compress labels length.
console.log("Compressing long-ass user labels...");
labels.compress();


// Flush translation (because we don't need dupes).
flushTranslations();


// Scramble!
console.log("Screwing entire project...");
for (const fileLocation of tempLocationFiles) {
    if (checkFileExtension(fileLocation, "gd")) {
        // Parse GDScript.
        await writeFile(fileLocation, await GDParser.parseFile(fileLocation));
    } else if (checkFileExtension(fileLocation, [ "godot", "tscn", "tres", "cfg" ])) {
        // Parse GDResources.
        await writeFile(fileLocation, await GDParser.parseFile(fileLocation, "tscn"));
    } else if (checkFileExtension(fileLocation, "csv")) {
        // Parse CSV.
        let str = await readFile(fileLocation, { encoding: "utf-8" });
        const lines = parseLocaleCsv(str).split("\n");
        const firstLine = lines.splice(0, 1);
        shuffleArray(lines);
        str = [...firstLine, ...lines].join("\n");
        await writeFile(fileLocation, str);
    }
}


// Port translations.
for (const translationKey of Object.keys(translations)) {
    await writeFile(join(translationLocation, translationKey + ".txt"), translations[translationKey]);
}


if (dirOutServerLocation) { // Export server version.
    console.log("Building both client and server versions...");
    for (const [ destPath, excludedDirWithFile, blockIndicator ] of [
        [ dirOutLocation, "godogserver", "#GODOG_SERVER" ], // Client directory.
        [ dirOutServerLocation, "godogclient", "#GODOG_CLIENT" ], // Server directory.
    ]) {
        console.log("Processing " + blockIndicator + "...");
        // Copy source files.
        if (existsSync(destPath)) await rm(destPath, fsOptions);
        await mkdir(destPath, fsOptions);
        await filesCopySelectively(tempLocation, destPath, [ excludedDirWithFile ]);
        // Strip code blocks.
        for (const fileLocation of fileList(destPath)) {
            if (checkFileExtension(fileLocation, "gd")) {
                await writeFile(fileLocation, await stripGdBlockFromFile(fileLocation, blockIndicator));
            }
        }
        // Melt directory.
        if (config.meltEnabled) {
            console.log("Scrambling project structure...");
            await meltDirectory(destPath, labels);
        }
    }
    // Delete temp directory.
    await rm(tempLocation, fsOptions);
} else { // Export standalone version.
    // Melt project.
    if (config.meltEnabled) {
        console.log("Scrambling project structure...");
        await meltDirectory(tempLocation, labels);
    }
    // Swap the directory to the target.
    await rm(dirOutLocation, fsOptions);
    await rename(tempLocation, dirOutLocation);
}


// Export debug symbols in dev folder.
await writeFile(join(dirLocation, "/dbg.sym.json"), labels.exportDebugSymbols());


// Indicate when it's done.
console.log("Done!");
console.warn(
    "If you're working with a Godot game that doesn't utilise string translation tables (CSV), majority of strings will be altered and become nonsense." +
    "This isn't a bug since Godot always mangle everything with strings and there's no way to alternate source code safely. Read 'README.DOC' for more details."
);
