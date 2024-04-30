//@ts-check
import { existsSync } from "fs";
import { cp, mkdir, readFile, rm, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { dirList, fileList } from "./lib/file.list.mjs";
import { labels } from "./lib/labels.mjs";
import { shuffleArray } from "./lib/shuffle.mjs";
import { GDParser, gdscriptUserLabels } from "./lib/gd.token.mjs";
import { checkFileExtension } from "./lib/strings.mjs";
import { loadConfig } from "./lib/options.mjs";
import { meltDirectory } from "./melt.mjs";


if (!process.argv[2] || !process.argv[3]) {
    throw new Error("Project location/destination must be specified");
}


const dirLocation = resolve(process.argv[2]);
const dirOutLocation = resolve(process.argv[3]);
const translationLocation = join(dirOutLocation, "/tr");


if (!existsSync(dirLocation)) {
    throw new Error("Project source directory invalid.");
}

if (!existsSync(dirOutLocation)) {
    throw new Error("Project destination directory invalid.");
}


// Get project config.
console.log("Loading project config...");
const config = await loadConfig(dirLocation);


// Get all Godot labels.
console.log("Getting Godot labels...");


// Cleanup export directory.
console.log("Cleaning up messes...");
await rm(dirOutLocation, { recursive: true, force: true });
await mkdir(dirOutLocation);
await mkdir(translationLocation);


// Copy source files.
console.log("Copying source files...");
for (const dir of dirList(dirLocation)) {
    const destPart = dir.split(dirLocation).pop();
    if (destPart) {
        await mkdir(join(dirOutLocation, destPart), { recursive: true });
    }
}
for (const file of fileList(dirLocation)) {
    const destPart = file.split(dirLocation).pop();
    if (destPart) {
        await cp(file, join(dirOutLocation, destPart));
    }
}


// Note all files in the out directory.
console.log("Listing all files...");
const dirOutFiles = fileList(dirOutLocation);


// Parse GDScript to find user labels.
console.log("ANALysing project...");
for (const fileLocation of dirOutFiles) {
    if (!checkFileExtension(fileLocation, "gd")) continue;
    await writeFile(fileLocation, GDParser.parseStr(await readFile(fileLocation, { encoding: "utf-8" })));
}


// Start processing all files.
console.log("Screwing up files...");
for (const fileLocation of dirOutFiles) {
    if (
        checkFileExtension(fileLocation, "godot") ||
        checkFileExtension(fileLocation, "tscn") ||
        checkFileExtension(fileLocation, "tres") ||
        checkFileExtension(fileLocation, "gd") ||
        checkFileExtension(fileLocation, "csv")
    ) {
        let str = await readFile(fileLocation, { encoding: "utf-8" });
        // Reformat strings to scrambled ones.
        for (const splitter of ["____"]) {
            const lines = str.split(splitter);
            if (lines.length % 2 === 0)
                throw new Error(`There's incomplete enclosed quad underscore in the file ${fileLocation}`);
            for (let i = 1; i < lines.length; i += 2) {
                lines[i] = labels.get(lines[i]);
            }
            str = lines.join("");
        }
        // Scramble rows to confuse deobfuscator.
        if (checkFileExtension(fileLocation, "csv")) {
            const lines = str.split("\n");
            const firstLine = lines.splice(0, 1);
            shuffleArray(lines);
            str = [...firstLine, ...lines].join("\n");
        }
        // Replace all known user labels.
        for (const userLabel of gdscriptUserLabels) {
            str = str.split(`"${userLabel}"`).join(`"${labels.get(userLabel)}"`).split(`'${userLabel}'`).join(`"${labels.get(userLabel)}"`);
        }
        // Parse GDResources.
        if (
            checkFileExtension(fileLocation, "godot") ||
            checkFileExtension(fileLocation, "tscn") ||
            checkFileExtension(fileLocation, "tres")
        ) {
            str = GDParser.parseStr(str, true);
        }
        await writeFile(fileLocation, str);
    }
}


// Melt project
if (config.meltEnabled) {
    console.log("Scrambling project structure...");
    await meltDirectory(dirOutLocation, labels);
}


// Export debug symbols in dev folder.
await writeFile(join(dirLocation, "/dbg.sym.json"), labels.exportDebugSymbols());
