//@ts-check
import { labels } from "./labels.mjs";
import { godotLabels } from "./godot.labels.mjs";
import { hasTranslations, parseTranslations } from "./locale.mjs";
import { allowedNumberSymbols, asciiNumbers, asciiSymbols, formatStringQuote, isLabel, isString, looksLikeStringPath, toGodotJson, toStandardJson } from "./strings.mjs";
// import { writeFileSync } from "fs";
// import { randomUUID } from "crypto";


/** @type {string[]} User-defined labels. */
export const gdscriptUserLabels = [];


const gdComboSymbols = [
    // Common in most languages.
    "**=", "<<=", ">>=",
    "<<", ">>", "==", "!=", "<=", ">=", "+=",
    "-=", "*=", "/=", "%=", "|=", "&&", "||",
    "^^", "++", "--",
    // GDScript
    "->", ":=",
];


/**
 * Converts space to tab.
 * @param {string} str 
 */
function convertSpaceToTab(str) {
    const strs = str.split("\n");
    let inString = false;
    for (let i = 0; i < strs.length; i++) {
        if (!inString) {
            const lines = strs[i].split("");
            if (lines[0] !== " ") continue;
            for (let j = 0; j < lines.length; j++) {
                if (lines[j] === " ") {
                    lines[j] = "\t";
                    continue;
                }
                break;
            }
            strs[i] = lines.join("");
        }
        if (strs[i].includes(`"""`)) {
            if (strs[i].split(`"""`).length > 2) {
                throw new Error(`Multiple multiline strings in single line isn't supported.`);
            }
            inString = !inString;
        }
    }
    return strs.join("\n");
}


/** Token parser object. */
export class GDParser {
    /** @type {string[]} Private labels. */
    privateLabels = [];
    /** @type {Record<string,string>} Newly mapped private labels. */
    newPrivateLabels = {}

    /** Parse result. */
    result = "";

    /**
     * Construct a token parser.
     * @param {boolean} isTscn
     */
    constructor(isTscn = false) {
        this.isTscn = isTscn;
        this.commentSymbol = isTscn ? ";" : "#";
    }

    /**
     * Parse a string and get the result immediately.
     * @param {string} str 
     * @param {boolean} isTscn 
     */
    static parseStr(str, isTscn = false) {
        const o = new this(isTscn);
        // const a = o.tokenise(str);
        // const b = o.parseTokens(a);
        // const c = o.assemble(b);
        // writeFileSync(process.cwd() + "/TEST/" + randomUUID() + ".json", JSON.stringify(a) );
        // return c;
        // return o.assemble(o.parseTokens(a));
        return o.assemble(o.parseTokens(o.tokenise(str)));
    }

    /**
     * Tokenise GDScript into something able to be processed.
     * @param {string} str 
     */
    tokenise(str) {
        const commentSymbol = this.commentSymbol;
        str = convertSpaceToTab(str);

        /** @type {string[]} */
        const strs = [];
        let i = 0;
        let buffer = "";
        let escapeChar = 0;
        let strThreeQuotes = false;

        const entryState = () => {
            submitBuffer();
            const c = str[i];
            if (asciiSymbols.includes(c)) {
                switch (c) {
                    case " ":
                        skipBuffer();
                        break;
                    case commentSymbol:
                        setState("comment");
                        break;
                    case `"`: case `'`:
                        if (str[i + 1] === c && str[i + 2] === c) {
                            i += 2;
                            strThreeQuotes = true;
                            setState("string", 3);
                        } else {
                            setState("string");
                        }
                        break;
                    default: setState("symbol"); break;
                }
            } else if (asciiNumbers.includes(c)) {
                setState("number");
            } else {
                setState("label");
            }
        };

        const setState = (state = "", pushBufferCount = 0) => {
            pushBuffer(pushBufferCount);
            while (runState(state)) {
                if (i < str.length) continue;
                break;
            }
        };

        const runState = (state = "") => {
            const c = str[i];
            switch (state) {
                default:
                    throw new Error("unknown state reached");
                case "comment":
                    if (c === "\n") {
                        return false;
                    }
                    pushBuffer();
                    return true;
                case "label":
                    if (asciiSymbols.includes(c)) {
                        return false;
                    }
                    pushBuffer();
                    return true;
                case "number":
                    if (allowedNumberSymbols.includes(c)) {
                        pushBuffer();
                        return true;
                    }
                    return false;
                case "string":
                    if (escapeChar) {
                        if (c === "U") {
                            escapeChar += 6;
                        } else if (c === "u") {
                            escapeChar += 4;
                        }
                        escapeChar--;
                        pushBuffer();
                        return true;
                    }
                    if (c === "\\") {
                        escapeChar++;
                        pushBuffer();
                        return true;
                    }
                    if (c === stringSymbol()) {
                        if (strThreeQuotes) {
                            if (!(str[i + 1] === c && str[i + 2] === c)) {
                                throw new Error(`Error parsing at the character index ${i}, incomplete triple string bracket.`);
                            } else {
                                pushBuffer(3);
                                strThreeQuotes = false;
                                i += 2;
                            }
                        } else {
                            pushBuffer();
                        }
                        return false;
                    }
                    pushBuffer();
                    return true;
                case "symbol":
                    if (asciiSymbols.includes(c)) {
                        switch (c) {
                            case " ":
                                skipBuffer();
                                return true;
                            case commentSymbol:
                            case `"`: case `'`:
                                return false;
                            default:
                                pushBuffer();
                                submitBuffer();
                                return true;
                        }
                    }
                    return false;
            }
        };

        const pushBuffer = (count = 1) => {
            for (let x = 0; x < count; x++) {
                buffer += str[i];
                i ++;
            }
        };

        const skipBuffer = (count = 1) => {
            i += count;
        };

        const submitBuffer = () => {
            if (buffer.length > 0) {
                strs.push(buffer);
                buffer = "";
            }
        };

        const stringSymbol = () => buffer[0];

        // Initnal state decision.
        if (asciiNumbers.includes(str[0])) {
            throw new Error("First character in the script can't start with number.");
        }

        // Process state.
        while (i < str.length) {
            entryState();
        }


        /** @type {string[]} */
        const postStrs = [];
        for (let i = 0; i < strs.length; i++) {
            let symbol = strs[i] + strs[i + 1];
            if (gdComboSymbols.includes(symbol)) {
                // Group symbols together
                postStrs.push(symbol);
                i += 1;
                continue;
            }
            postStrs.push(strs[i]);
        }
        return postStrs;
    }

    /**
     * Parse the token and process it.
     * @param {string[]} tokens 
     */
    parseTokens(tokens) {
        for (let i = 0; i < tokens.length; i++) {
            tokens[i] = this.parse(tokens, i);
        }
        return tokens;
    }

    /**
     * Parse specified token and decide if the specified token should be returned as what.
     * @param {string[]} tokens
     * @param {number} i
     */
    parse(tokens, i) {
        const token = tokens[i];

        const isTscn = this.isTscn;
        const commentSymbol = this.commentSymbol;
        const allPrivateLabels = this.privateLabels;
        const newPrivateLabels = this.newPrivateLabels;

        // Process symbols.
        if (asciiSymbols.includes(token[0])) {
            // Remove inferred type casting.
            if (token === ":=") {
                return "=";
            }
            
            // Parse comment.
            if (token[0] === commentSymbol) {
                if (token.indexOf("#GODOG_LABEL:") === 0) {
                    // Define scrambled label.
                    const userLabels = token.split(" ").join("").split("#GODOG_LABEL:")[1].split(",");
                    for (const userLabel of userLabels) {
                        gdscriptUserLabels.push(userLabel);
                        labels.get(userLabel);
                    }
                }
                if (token.indexOf("#GODOG_PRIVATE:") === 0) {
                    // Define private labels.
                    const privateLabels = token.split(" ").join("").split("#GODOG_PRIVATE:")[1].split(",");
                    for (const privateLabel of privateLabels) {
                        newPrivateLabels[privateLabel] = labels.get();
                        allPrivateLabels.push(privateLabel);
                    }
                }
                // Remove comment.
                return "";
            }

            // Parse user-defined strings.
            if (isString(token)) {
                let str = formatStringQuote(token);
                if (isTscn) {
                    str = toStandardJson(str);
                    
                }
                str = JSON.parse(str);
                if (looksLikeStringPath(str)) {
                    // If it looks like index access.
                    const strSplitSlash = str.split("/");
                    const strSplitColon = strSplitSlash.splice(strSplitSlash.length - 1)[0].split(":");
                    this.parseTokens(strSplitSlash);
                    this.parseTokens(strSplitColon);
                    str = [ ...strSplitSlash, strSplitColon.join(":") ].join("/");
                } else if (hasTranslations(str)) {
                    // If it has translation strings.
                    str = parseTranslations(str);
                }
                str = JSON.stringify(str);
                if (isTscn) {
                    str = toGodotJson(str);
                }
                return str;
            }

            // Other symbols.
            return token;
        }
        if (asciiNumbers.includes(token[0])) {
            // NOT numbers.
            return token;
        }
        if (isTscn) {
            // For GDResource files.
            if (gdscriptUserLabels.includes(token)) return labels.get(token);
        } else {
            // For GDScript files
            if (token === "as" && godotLabels.includes(tokens[i + 1])) {
                // Remove "as" casting.
                tokens[i + 1] = "";
                return "";
            }
            if (godotLabels.includes(token)) {
                if (tokens[i - 3] === "var" && tokens[i - 1] === ":" && tokens[i + 1] === "=") {
                    // Remove explicit type casting.
                    tokens[i - 1] = "";
                    return "";
                }
                if (tokens[i - 2] === ")" && tokens[i - 1] === "->" && tokens[i + 1] === ":") {
                    // Remove arrow token (return type).
                    tokens[i - 1] === "";
                    return "";
                }
                // NOT godot labels.
                return token;
            }
            if (allPrivateLabels.includes(token)) {
                // Replace private token with new token.
                if (tokens[i - 1] === ".") return token;
                return newPrivateLabels[token];
            }
            // Note it in user labels.
            gdscriptUserLabels.push(token);
            return labels.get(token);
        }
        return token;
    }

    /**
     * Assemble GD Tokens into string.
     * @param {string[]} token 
     */
    assemble(token) {
        /** @type {string[]} */
        const newToken = [];
        for (let i = 0; i < token.length; i++) {
            const t1st = token[i];
            if (t1st) {
                newToken.push(t1st);
                const t2nd = token[i + 1];
                if (t2nd) {
                    if (
                        (!asciiSymbols.includes(t1st[0]) && !asciiSymbols.includes(t2nd[0])) ||
                        (isString(t1st) && isLabel(t2nd)) || (isLabel(t1st) && isString(t2nd))
                    ) {
                        newToken.push(" ");
                    }
                }
            }
        }
        return newToken.join("");
    }
}
