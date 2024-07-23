//@ts-check
import { fileList } from "./file.list.mjs";
import { XMLParser } from "fast-xml-parser";
import { readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { checkFileExtension, isLabel, isString, getLabelsFromStringBlocksInCLangString } from "./strings.mjs";
import { tokenise } from "./token.mjs";
import { existsSync } from "fs";


const errNoLabelCache = new Error("Godot labels cache file not found.");
const errInvalidSrcPath = new Error("Specified Godot source path is invalid.");
/** @param {string} cachePath */
const errFailLabelCacheLoad = (cachePath) => new Error("Can't load labels cache from the path'" + cachePath + "'");


const cachePath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "godot_labels_cache.json");
const includedDirs = ["core", "drivers", "doc", "editor", "main", "modules", "platform", "scene", "servers"]; // excludes: thirdparty
const ignoredCalls = [ "TTR", "RTR", "get_icon", "plus_file" ];


const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
});


/** @type {string[]} */
let loadedLabels = [];


/**
 * @param {string[]} labels
 * @param {string} str 
 */
function parseXml(labels, str) {
    const push = (str = "") => {
        for (const nameTop of str.split("/")) {
            for (const name of nameTop.split(".")) {
                if (labels.includes(name)) continue;
                if (isLabel(name)) labels.push(name);
            }
        }
    };

    const xml = parser.parse(str);
    const classInfo = xml["class"];
    push(classInfo["@name"]);
    push(classInfo["@inherits"]);
    if (classInfo["constants"]) {
        const xmlConstants = classInfo["constants"]["constant"];
        if (xmlConstants) {
            for (const constant of xmlConstants instanceof Array ? xmlConstants : [xmlConstants]) {
                push(constant["@name"]);
            }
        }
    }
    if (classInfo["members"]) {
        const xmlMembers = classInfo["members"]["member"];
        if (xmlMembers) {
            for (const member of xmlMembers instanceof Array ? xmlMembers : [xmlMembers]) {
                push(member["@name"]);
                push(member["@type"]);
            }
        }
    }
    if (classInfo["methods"]) {
        const xmlMethods = classInfo["methods"]["method"];
        if (xmlMethods) {
            for (const method of xmlMethods instanceof Array ? xmlMethods : [xmlMethods]) {
                push(method["@name"]);
                const xmlArgs = method["argument"];
                const xmlReturns = method["return"];
                if (xmlReturns) {
                    push(xmlReturns["@type"]);
                }
                if (xmlArgs) {
                    for (const arg of xmlArgs instanceof Array ? xmlArgs : [xmlArgs]) {
                        push(arg["@name"]);
                    }
                }
            }
        }
    }
    if (classInfo["signals"]) {
        const xmlSignal = classInfo["signals"]["signal"];
        if (xmlSignal) {
            for (const signal of xmlSignal instanceof Array ? xmlSignal : [xmlSignal]) {
                push(signal["@name"]);
            }
        }
    }
    if (classInfo["theme_items"]) {
        const xmlThemeItems = classInfo["theme_items"]["theme_item"];
        if (xmlThemeItems) {
            for (const themeItem of xmlThemeItems instanceof Array ? xmlThemeItems : [xmlThemeItems]) {
                push(themeItem["@name"]);
                push(themeItem["@type"]);
            }
        }
    }
}


/**
 * HUNT DOWN LABELS FROM GODOT'S SOURCE CODE.
 * @param {string} sourcePath
 */
export async function huntLabels(sourcePath) {
    /** @type {string[]} */
    const xmlLabels = [];
    /** @type {Record<string,boolean>} */
    const labels = {};
    /** @type {Record<string,boolean>} */
    let bannedLabels = {};

    const push = (str = "") => {
        if (bannedLabels[str]) return;
        if (labels[str]) return;
        labels[str] = true;
    };

    // HUNT
    for (const includedDir of includedDirs) {
        for (const filePath of fileList(join(sourcePath, includedDir))) {
            if (checkFileExtension(filePath, [ "h", "hpp", "c", "cpp", "xml" ])) {
                console.log("Processing '" + filePath + "'...");
                const srcStr = await readFile(filePath, { encoding: "utf-8" });
                if (checkFileExtension(filePath, "xml")) {
                    try { parseXml(xmlLabels, srcStr); } catch {}
                } else if (checkFileExtension(filePath, [ "h", "hpp", "c", "cpp", ])) {
                    if (checkFileExtension(filePath, [ "gen.h", "gen.c", "gen.cpp"] )) continue; // Ignore generated files.
                    const tokens = tokenise(srcStr, "clang");
                    for (let i = 0; i < tokens.length; i++) {
                        let token = tokens[i];
                        if (!isString(token)) continue;
                        if (ignoredCalls.includes(tokens[i - 2])) {
                            continue;
                        } else {
                            for (const label of getLabelsFromStringBlocksInCLangString(token)) {
                                push(label);
                            }
                        }
                    }
                }
            }
        }
        console.log(`Currently there are ${Object.keys(labels).length} labels in total.`);
    }

    // Always include XML labels.
    bannedLabels = {};
    for (const name of xmlLabels) {
        push(name);
    }

    push("_"); // FIX: Default case not being included.
    const labelsKeys = Object.keys(labels);
    console.log(`There are ${labelsKeys.length} labels in total.`);
    return labelsKeys;
}


/**
 * Load Godot labels from specified directory, fi a
 * @param {string} sourcePath
 * @returns {Promise<string[]>}
 */
export async function loadGodotLabels(sourcePath = "") {
    if (!existsSync(cachePath)) {
        if (!sourcePath) {
            throw errNoLabelCache;
        }
        if (!existsSync(sourcePath)) {
            throw errInvalidSrcPath;
        }
        console.log(">>"+sourcePath)
        const labels = await huntLabels(sourcePath);
        await writeFile(cachePath, JSON.stringify(labels, null, "\t"));
        return labels;
    }
    try {
        if (loadedLabels.length === 0) {
            loadedLabels = JSON.parse(await readFile(cachePath, { encoding: "utf-8" }))
        }
        return loadedLabels;
    } catch (e) {
        console.error(e);
        throw errFailLabelCacheLoad(cachePath);
    }
}
