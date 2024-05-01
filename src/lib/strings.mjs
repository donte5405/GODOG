//@ts-check
/** @param {number} num */
function char(num) { return String.fromCharCode(num); }


/** @type {string[]} */
const symbols = [];


for (let i = 0; i < 128; i++) {
    if (i >= 48 && i <= 57) continue;
    if (i >= 65 && i <= 90) continue;
    if (i == 95) continue;
    if (i >= 97 && i <= 122) continue;
    symbols.push(char(i));
}


/** List of ASCII symbols. */
export const asciiSymbols = symbols;


/** List of ASCII numbers. */
export const asciiNumbers = "0123456789";


/** Characters allowed for number. */
export const allowedNumberSymbols = "0123456789xbe-_.";


/** List of ASCII characters allowed in indexed strings. */
export const allowedIndexedCharacters = "/:.0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_";


/**
 * Check if a path has a speficied file extension.
 * @param {string} path
 * @param {string|string[]} extension 
 */
export function checkFileExtension(path, extension) {
    if (typeof extension === "string") {
        extension = [ extension ];
    }
    for (const e of extension) {
        if (path.length - path.indexOf("." + e) === e.length + 1) return true;
    }
    return false;
}


/**
 * Check if the path as specified file name at the end of the path.
 * @param {string} filename 
 * @param {string} path 
 */
export function hasFile(filename, path) {
    return path.indexOf(filename) === path.length - filename.length;
}


/**
 * Check the string if this contains `"` or `'`. Returns as the symbol of the string bracket. Will NOT detect multiline strings.
 * @param {string} str 
 */
export function isString(str) {
    const sym = str[0];
    switch (sym) {
        case `"`: case "'":
            if (str[str.length - 1] == sym) {
                if (str[1] != sym && str[2] != sym) {
                    return sym;
                }
            }
            break;
    }
    return "";
}


/**
 * If specified token is a label.
 * @param {string} str 
 */
export function isLabel(str) {
    for (let i = 0; i < str.length; i++) {
        if (asciiSymbols.includes(str[i])) return false;
    }
    return true;
}


/**
 * Change the string quote from `'` to `"`.
 * @param {string} str 
 */
export function formatStringQuote(str) {
    if (str[0] === "'" && str[str.length - 1] === "'") {
        return `"${str.substring(1, str.length - 2)}"`;
    }
    return str;
}


/**
 * Convert Godot JSON string into standardisted JSON string.
 * @param {string} json 
 */
export function toStandardJson(json) {
    return formatStringQuote(json).split("\n").join("\\n").split("\t").join("\\t");
}


/**
 * Convert standardisted JSON string into Godot JSON string.
 * @param {string} json 
 */
export function toGodotJson(json) {
    return json.split("\\n").join("\n").split("\\t").join("\t");
}

/**
 * If specified string is likely a string path that's used for label references.
 * @param {string} str 
 */
export function looksLikeStringPath(str) {
    // Test if it's not protocol path.
    if (str.includes("://")) return false;
    if (str.indexOf("./") === 0) return false;
    // Deep test.
    for (let i = 0; i < str.length; i++) {
        if (allowedIndexedCharacters.includes(str[i])) continue;
        return false;
    }
    return true;
}
