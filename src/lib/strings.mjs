//@ts-check
/** @param {number} num */
function char(num) { return String.fromCharCode(num); }


/** @type {string[]} */
const symbols = [];


for (let i = 0; i < 128; i++) {
    if (i >= 48 && i <= 57) continue;
    if (i >= 65 && i <= 90) continue;
    if (i === 95) continue;
    if (i >= 97 && i <= 122) continue;
    symbols.push(char(i));
}


/** List of ASCII symbols. */
export const asciiSymbols = symbols;


/** List of ASCII numbers. */
export const asciiNumbers = "0123456789";


/** Characters allowed for number. */
export const allowedNumberSymbols = "0123456789xbe-_.";


/** List of path navigation symbols. */
export const pathNavSymbols = [ ".", "..", ":", "/" ];


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
        const ind = path.indexOf("." + e);
        if (ind < 0) continue;
        if (path.length - ind === e.length + 1) return true;
    }
    return false;
}


/**
 * Check if the path as specified file name at the end of the path.
 * @param {string} filename 
 * @param {string} path 
 */
export function hasFile(filename, path) {
    const ind = path.indexOf(filename);
    if (ind < 0) return false;
    return ind === path.length - filename.length;
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
            if (str[str.length - 1] === sym) {
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
        if (str.charCodeAt(i) > 127) return false; // Disallow non-ASCII characters.
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
 * Parse JSON-encoded string into a string.
 * @param {string} str 
 * @param {boolean} fromGodot If this string is from GDResource files (such as TSCN/TRES).
 * @returns {string}
 */
export function jsonStringParse(str, fromGodot = false) {
    if (fromGodot) {
        str = toStandardJson(str);
    } else {
        str = formatStringQuote(str);
    }
    return JSON.parse(str);
}


/**
 * Stringify specified string into JSON-encoded or GDResource-encoded string.
 * @param {string} str 
 * @param {boolean} toGodot If this string is going to be converted into GDResource-encoded string.
 */
export function jsonStringStringify(str, toGodot = false) {
    str = JSON.stringify(str);
    if (toGodot) {
        str = toGodotJson(str);
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
 * Check if specified string is a string format symbol.
 * @param {string} str 
 */
export function isStringFormat(str) {
    if (str[0] === "%" && "scdoxXfv".includes(str[str.length - 1])) {
        for(let i = 1; i < str.length - 2; i++) {
            if ("-+*.0123456789abcdefABCDEF".includes(str[i])) continue;
            return false;
        }
        return true;
    }
    return false;
}


/**
 * If specified string is likely a Godot's node path that's used for label references.
 * @param {string} str 
 */
export function looksLikeNodePath(str) {
    if (!str) return false;
    // Test if it's not protocol path.
    if (looksLikeProtocolPath(str)) return false;
    // Deep test.
    for (const section of splitNodePath(str)) {
        if (pathNavSymbols.includes(section)) continue;
        if (isStringFormat(section)) continue;
        for (let i = 0; i < section.length; i++) {
            if (isLabel(section)) continue;
            return false;
        }
    }
    return true;
}


/**
 * @callback ProcessNodePathCallback
 * @param {string} str
 * @param {number} index
 * @param {string[]} array
 */


/**
 * Process NodePath and return processed string.
 * @param {string} str 
 * @param {ProcessNodePathCallback} func 
 */
export function processNodePath(str, func) {
    const strSplit = splitNodePath(str);
    strSplit.forEach((section, i, arr) => {
        if (pathNavSymbols.includes(section)) return;
        if (isStringFormat(section)) return;
        arr[i] = func(arr[i], i, arr);
    });
    return strSplit.join("");
}


/**
 * Split NodePath (this is needed because NodePath has "/" and ":" splitters).
 * @param {string} str 
 */
export function splitNodePath(str) {
    /** @type {string[]} */
    const processed = [];
    let buffer = "";
    const submitBuffer = () => {
        if (buffer) {
            processed.push(buffer);
            buffer = "";
        }
    };
    str.split("").forEach((val) => {
        if ("/:".includes(val)) {
            submitBuffer();
            processed.push(val);
        } else {
            buffer += val;
        }
    });
    submitBuffer();
    return processed;
}

                    
/**
 * If specified string is likely a file string path that's used for label references.
 * @param {string} str 
 */
export function looksLikeProtocolPath(str) {
    return str.includes("://") || (str.indexOf("./") === 0);
}


/**
 * Get path's protocol and path.
 * @param {string} str
 * @returns {[string, string]} 
 */
export function getProtocolAndPath(str) {
    if (str.indexOf("./") === 0) {
        const strSplit = str.split("./");
        if (strSplit.length !== 2) return [ "", "" ];
        return [ ".", strSplit[1] ];
    }
    const strSplit = str.split("://");
    if (strSplit.length !== 2) return [ "", "" ];
    return [ strSplit[0], strSplit[1] ];
}
