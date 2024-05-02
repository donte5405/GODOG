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
export const allowedIndexedCharacters = "/:.0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-";


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
    if (!str) return "";
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
    if (!str) return false;
    if (isNumber(str)) return false;
    for (let i = 0; i < str.length; i++) {
        if (asciiSymbols.includes(str[i])) return false;
    }
    return true;
}


/**
 * If specified string is a number
 * @param {string} str 
 */
export function isNumber(str) {
    if (!str) return false;
    if (!asciiNumbers.includes(str[0])) return false;
    if (str[0] === "0" && str[1]) {
        if (str.length < 3) return false;
        switch (str[1]) {
            case "b":
                for (let i = 2; i < str.length; i++) {
                    if (!("01").includes(str[i])) return false;
                }
                return true;
            case "x":
                for (let i = 2; i < str.length; i++) {
                    if (!("0123456789abcdefABCDEF").includes(str[i])) return false;
                }
                return true;
        }
    }
    for (let i = 0; i < str.length; i++) {
        if (!allowedNumberSymbols.includes(str[i])) return false;
    }
    return true;
}


/**
 * Change the string quote from `'` to `"`.
 * @param {string} str 
 */
export function formatStringQuote(str) {
    if (!str) return "";
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
    if (!str) return false;
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
