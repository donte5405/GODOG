//@ts-check
import { loadGodotLabels } from "./godot.labels.mjs";
import { labels } from "./labels.mjs";
import { hasTranslations, parseTranslations } from "./locale.mjs";
import { asciiNumbers, asciiSymbols, formatStringQuote, isString, looksLikeStringPath, toGodotJson, toStandardJson } from "./strings.mjs";
import { assemble, tokenise } from "./token.mjs";
// import { writeFileSync } from "fs";
// import { randomUUID } from "crypto";
// import { fileURLToPath } from "url";
// import { dirname, join } from "path";


// const __filename = fileURLToPath(import.meta.url);
// const testPath = join(dirname(__filename), "../", "../", "/TEST");


/** List of Godot labels. */
const godotLabels = await loadGodotLabels();


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
    }

    /**
     * Parse a string and get the result immediately.
     * @param {string} str 
     * @param {boolean} isTscn 
     */
    static parseStr(str, isTscn = false) {
        const o = new this(isTscn);
        // const uuid = randomUUID();
        // const a = o.tokenise(str);
        // writeFileSync(testPath + "/" + uuid + ".a.json", JSON.stringify(a) );
        // const b = o.parseTokens(a);
        // writeFileSync(testPath + "/" + uuid + ".b.json", JSON.stringify(b) );
        // const c = o.assemble(b);
        // writeFileSync(testPath + "/" + uuid + ".c.tscn", c );
        // return c;
        // return o.assemble(o.parseTokens(a));
        return o.assemble(o.parseTokens(o.tokenise(str)));
    }

    /**
     * Tokenise GDScript into something able to be processed.
     * @param {string} str 
     */
    tokenise(str) {
        return tokenise(str, this.isTscn ? "tscn" : "gd");
    }

    /**
     * Parse the token and process it.
     * @param {string[]} tokens 
     */
    parseTokens(tokens, isInStringPathOfTscn = false) {
        for (let i = 0; i < tokens.length; i++) {
            tokens[i] = this.parse(tokens, i, isInStringPathOfTscn);
        }
        return tokens;
    }

    /**
     * Parse specified token and decide if the specified token should be returned as what.
     * @param {string|string[]} tokens
     * @param {number} i
     * @param {boolean} isInStringPathOfTscn ONLY USE THIS WHEN IT'S PROCESSED IN TSCN STRINGS!
     */
    parse(tokens, i = 0, isInStringPathOfTscn = false) {
        if (typeof tokens === "string") {
            tokens = [tokens];
        }

        const token = tokens[i];
        const isTscn = this.isTscn;
        const allPrivateLabels = this.privateLabels;
        const newPrivateLabels = this.newPrivateLabels;

        // Process symbols.
        if (asciiSymbols.includes(token[0])) {
            // For GDScript only.
            if (!isTscn) {
                // Remove inferred type casting.
                if (token === ":=") {
                    return "=";
                }
                // Parse comment.
                if (token[0] === "#") {
                    const tokenNsp = token.split(" ").join("");
                    "#GODOG_LABEL:";
                    if (tokenNsp.indexOf("#GODOG_LABEL:") === 0) {
                        // Define scrambled label.
                        const userLabels = tokenNsp.split(" ").join("").split("#GODOG_LABEL:")[1].split(",");
                        for (const userLabel of userLabels) {
                            labels.get(userLabel);
                        }
                        // Remove comment.
                        return "";
                    }
                    "#GODOG_PRIVATE:";
                    if (tokenNsp.indexOf("#GODOG_PRIVATE:") === 0) {
                        // Define private labels.
                        const privateLabels = tokenNsp.split(" ").join("").split("#GODOG_PRIVATE:")[1].split(",");
                        for (const privateLabel of privateLabels) {
                            newPrivateLabels[privateLabel] = labels.get();
                            allPrivateLabels.push(privateLabel);
                        }
                        // Remove comment.
                        return "";
                    }
                    // Remove comment.
                    return "";
                }
            }

            // Parse user-defined strings.
            if (isString(token)) {
                let str = formatStringQuote(token);
                if (isTscn) {
                    str = toStandardJson(str);
                }
                str = JSON.parse(str);
                if (hasTranslations(str)) {
                    // If it has translation strings.
                    str = parseTranslations(str);
                } else if (looksLikeStringPath(str)) {
                    // If it looks like index access.
                    const strSplitSlash = str.split("/");
                    const strSplitColon = strSplitSlash.splice(strSplitSlash.length - 1)[0].split(":");
                    this.parseTokens(strSplitSlash, true);
                    this.parseTokens(strSplitColon, true);
                    str = [...strSplitSlash, strSplitColon.join(":")].join("/");
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
            if (labels.has(token)) return labels.get(token);
            if (isInStringPathOfTscn) {
                if (godotLabels.includes(token)) {
                    // Ignore Godot labels.
                    return token;
                }
                return labels.get(token);
            }
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
                    tokens[i - 1] = "";
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
            return labels.get(token);
        }
        return token;
    }

    /**
     * Assemble GD Tokens into string.
     * @param {string[]} token 
     */
    assemble(token) {
        return assemble(token);
    }
}
