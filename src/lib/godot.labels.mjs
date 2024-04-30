//@ts-check
import { fileList } from "./file.list.mjs";
import { XMLParser } from "fast-xml-parser";
import { readFile } from "fs/promises";
import { join } from "path";
import { gdKeywords } from "./gd.keywords.mjs";


const classesPath = join(process.cwd(), "/classes");


const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix : "@",
});


/**
 * Get all internal strings from Godot class references (XML).
 * @param {string} fromDir 
 */
export async function getLabels(fromDir = classesPath) {
    /** @type {string[]} */
    const labels = [];

    const push = (str = "") => {
        if (labels.includes(str)) return;
        labels.push(str);
    };

    const files = fileList(fromDir);
    for (const file of files) {
        const xml = parser.parse(await readFile(file, {encoding: "utf-8"}));
        const classInfo = xml["class"];
        push(classInfo["@name"]);
        push(classInfo["@inherits"]);
        if (classInfo["constants"]) {
            const xmlConstants = classInfo["constants"]["constant"];
            if (xmlConstants) {
                for (const constant of xmlConstants instanceof Array ? xmlConstants : [ xmlConstants ]) {
                    push(constant["@name"]);
                }
            }
        }
        if (classInfo["members"]) {
            const xmlMembers = classInfo["members"]["member"];
            if (xmlMembers) {
                for (const member of xmlMembers instanceof Array ? xmlMembers : [ xmlMembers ]) {
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
                for (const method of xmlMethods instanceof Array ? xmlMethods : [ xmlMethods ]) {
                    push(method["@name"]);
                    const xmlArgs = method["argument"];
                    const xmlReturns = method["return"];
                    if (xmlReturns) {
                        push(xmlReturns["@type"]);
                    }
                    if (xmlArgs) {
                        for (const arg of xmlArgs instanceof Array ? xmlArgs : [ xmlArgs ]) {
                            push(arg["@name"]);
                        }
                    }
                }
            }
        }
        if (classInfo["signals"]) {
            const xmlSignal = classInfo["signals"]["signal"];
            if (xmlSignal) {
                for (const signal of xmlSignal instanceof Array ? xmlSignal : [ xmlSignal ]) {
                    push(signal["@name"]);
                }
            }
        }
        if (classInfo["theme_items"]) {
            const xmlThemeItems = classInfo["theme_items"]["theme_item"];
            if (xmlThemeItems) {
                for (const themeItem of xmlThemeItems instanceof Array ? xmlThemeItems : [ xmlThemeItems ]) {
                    push(themeItem["@name"]);
                    push(themeItem["@type"]);
                }
            }
        }
    }
    return labels;
}


/** All Godot internal labels. */
export const godotLabels = [ ...gdKeywords, ...await getLabels() ];
