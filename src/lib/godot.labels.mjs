//@ts-check
import { fileList } from "./file.list.mjs";
import { XMLParser } from "fast-xml-parser";
import { readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from 'url';
import { checkFileExtension, formatStringQuote, isLabel, isString, looksLikeStringPath } from "./strings.mjs";
import { tokenise } from "./token.mjs";
import { existsSync } from "fs";


const __filename = fileURLToPath(import.meta.url);
const godotSourcePath = join(dirname(__filename), "../", "../", "/godot");
const godotLabelsCachePath = join(godotSourcePath, "godog.json");
const includedDirs = ["core", "doc", "editor", "main", "modules", "platform", "scene", "servers"];


const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
});


/**
 * @param {string[]} targetLabels
 * @param {string} str 
 */
function parseXml(targetLabels, str) {
    /** @type {string[]} */
    const labels = [];

    const push = (str = "") => {
        if (labels.includes(str)) return;
        labels.push(str);
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
                /** @type {string[]} */
                const memberPart = member["@name"].split("/");
                if (memberPart.length > 1) {
                    for (const m of memberPart) {
                        push(m);
                    }
                }
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

    const pushToTarget = (str = "") => {
        if (targetLabels.includes(str)) return;
        targetLabels.push(str);
    }

    // Final.
    for (const label of labels) {
        pushToTarget(label);
    }
}


/** HUNT DOWN LABELS FROM GODOT'S SOURCE CODE. */
export async function huntLabels() {
    /** @type {string[]} */
    const labels = [ "_" ];

    const push = (str = "") => {
        if (labels.includes(str)) return;
        labels.push(str);
    };

    // HUNT
    console.log("")
    for (const includedDir of includedDirs) {
        for (const filePath of fileList(join(godotSourcePath, includedDir))) {
            if (checkFileExtension(filePath, [ "h", "hpp", "c", "cpp", "xml" ])) {
                console.log("Processing '" + filePath + "'...");
                const srcStr = await readFile(filePath, { encoding: "utf-8" });
                if (checkFileExtension(filePath, "xml")) {
                    try { parseXml(labels, srcStr); } catch {}
                } else if (checkFileExtension(filePath, [ "h", "hpp", "c", "cpp", ])) {
                    const tokens = tokenise(srcStr, "clang");
                    for (let token of tokens) {
                        try {
                            if (!isString(token)) continue;
                            token = JSON.parse(formatStringQuote(token));
                            if (!looksLikeStringPath(token)) continue;
                            // If it looks like index access.
                            const strSplitSlash = token.split("/");
                            const strSplitColon = strSplitSlash.splice(strSplitSlash.length - 1)[0].split(":");
                            for (const subToken of [...strSplitSlash, ...strSplitColon ]) {
                                if (isLabel(subToken)) push(subToken);
                            }
                        } catch {}
                    }
                }
            }
        }
        console.log(`Currently there are ${labels.length} labels in total.`);
    }

    // Save
    await writeFile(godotLabelsCachePath, JSON.stringify(labels, null, "\t"));
}


if (!existsSync(godotLabelsCachePath)) {
    console.log("Godot labels cache not found, trying to generate from './godot/godog.json'...");
    await huntLabels();
    console.log("Godot labels cache generation completed and stored in './godot/godog.json'.");
}


/** @type {string[]} All Godot internal labels. */
export const godotLabels = JSON.parse(await readFile(godotLabelsCachePath, { encoding: "utf-8" }));
