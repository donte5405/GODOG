//@ts-check
import { readFile } from "fs/promises";
import { Configuration } from "./options.mjs";
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


/** @type {string[]} User-defined GDScript types. */
const gdscriptUserTypes = [];


/** List of Godot labels. */
const godotLabels = await loadGodotLabels();


/** @type {Configuration?} Configuration that will be used. */
let config;


/**
 * Set configuration blob for this parser module.
 * @param {Configuration} c 
 */
export function parserSetConfig(c) {
    config = c;
}


/**
 * @param {string} token
 * @param {string[]} tokens 
 * @param {number} i 
 */
function removeTypeCasting(token, tokens, i) {
    if (tokens[i - 1] === ":" && [ "=", ",", ")", "\n" ].includes(tokens[i + 1])) {
        if (tokens[i - 4] == "export") return token; // Export types without manual inferring must have this.
        // Remove explicit type casting.
        tokens[i - 1] = "";
        return "";
    }
    if (tokens[i - 2] === ")" && tokens[i - 1] === "->" && tokens[i + 1] === ":") {
        // Remove arrow token (return type).
        tokens[i - 1] = "";
        return "";
    }
    if (tokens[i - 1] === "as") {
        // Remove "as" casting.
        tokens[i - 1] = "";
        return "";
    }
    // Ignore godot labels.
    return token;
}


/** Token parser object. */
export class GDParser {
    /** @type {string[]} Private labels. */
    privateLabels = [];
    /** @type {Record<string,string>} Newly mapped private labels. */
    newPrivateLabels = {}
    /** Filename that the parser is handling. Does nothing except warning users. */
    fileName = "";

    /**
     * Construct a token parser.
     * @param {"gd"|"clang"|"tscn"|"path"} mode
     */
    constructor(mode = "gd") {
        this.mode = mode;
    }

    /**
     * Parse a file and get the result immediately.
     * @param {string} fileName
     * @param {"gd"|"clang"|"tscn"|"path"} mode
     */
    static async parseFile(fileName, mode = "gd") {
        return new this(mode).tellFileName(fileName).parse(await readFile(fileName, { encoding: "utf-8" }));
    }

    /**
     * Parse a string and get the result immediately.
     * @param {string} str 
     * @param {"gd"|"clang"|"tscn"|"path"} mode
     */
    static parseStr(str, mode = "gd") {
        const o = new this(mode);
        // const uuid = randomUUID();
        // const a = o.tokenise(str);
        // writeFileSync(testPath + "/" + uuid + ".a.json", JSON.stringify(a) );
        // const b = o.parseTokens(a);
        // writeFileSync(testPath + "/" + uuid + ".b.json", JSON.stringify(b) );
        // const c = o.assemble(b);
        // writeFileSync(testPath + "/" + uuid + ".c.tscn", c );
        // return c;
        // return o.assemble(o.parseTokens(a));
        return o.parse(str);
    }

    /**
     * Tell file name that this parser is handling.
     * @param {string} name 
     */
    tellFileName(name) {
        this.fileName = name;
        return this;
    }

    /**
     * Do a complete parsing procedure in one shot.
     * @param {string} str 
     */
    parse(str, mode = this.mode) {
        return this.assemble(this.parseTokens(this.tokenise(str, mode), mode));
    }

    /**
     * Tokenise GDScript into something able to be processed.
     * @param {string} str 
     */
    tokenise(str, mode = this.mode) {
        return tokenise(str, mode);
    }

    /**
     * Parse the token and process it.
     * @param {string[]} tokens 
     */
    parseTokens(tokens, mode = this.mode) {
        for (let i = 0; i < tokens.length; i++) {
            tokens[i] = this.parseToken(tokens, i, mode);
        }
        return tokens;
    }

    /**
     * Parse specified token and decide if the specified token should be returned as what.
     * @param {string|string[]} tokens
     * @param {number} i
     * @returns {string}
     */
    parseToken(tokens, i = 0, mode = this.mode) {
        if (typeof tokens === "string") {
            tokens = [tokens];
        }

        const token = tokens[i];
        const allPrivateLabels = this.privateLabels;
        const newPrivateLabels = this.newPrivateLabels;

        // Process symbols.
        if (asciiSymbols.includes(token[0])) {
            // For GDScript only.
            if (mode == "gd") {
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
                if (tokens[i + 1] === "%") {
                    if (config) {
                        if (!config.ignoreStringFormattings) {
                            throw new Error(`[${this.fileName}] Direct string formatting (%) isn't allowed. Unless you absolutely know what you're doing, disable this option with 'ignoreStringFormattings'.\nTo avoid this issue, use CSV translation tables even if the game that only supports English.`);
                        }
                    }
                }
                let str = formatStringQuote(token);
                if (mode == "tscn") {
                    str = toStandardJson(str);
                }
                str = JSON.parse(str);
                if (hasTranslations(str)) {
                    // If it has translation strings.
                    str = parseTranslations(str);
                } else if (looksLikeStringPath(str)) {
                    // If it looks like index access.
                    str = this.parse(str, "path");
                }
                str = JSON.stringify(str);
                if (mode == "tscn") {
                    str = toGodotJson(str);
                }
                return str;
            }

            // Other symbols.
            return token;
        }
        if (asciiNumbers.includes(token[0])) {
            // Ignore labels starting with numbers.
            return token;
        }
        if (mode == "path") {
            // Ignore Godot labels.
            if (godotLabels.includes(token)) return token;
            if (allPrivateLabels.includes(token)) {
                // Replace private token with new token.
                if (tokens[i - 1] === ":") return labels.get(token);
                return newPrivateLabels[token];
            }
            return labels.get(token);
        }
        if (mode == "tscn") {
            // Ignore Godot labels.
            if (godotLabels.includes(token))  return token;
            // Only replace known strings.
            if (labels.has(token)) return labels.get(token);
            // Ignore unknown strings.
            return token;
        }
        if (mode == "gd") {
            // For GDScript files
            if (godotLabels.includes(token)) {
                // Try to get rid of type casting if possible.
                return removeTypeCasting(token, tokens, i);
            }
            if (allPrivateLabels.includes(token)) {
                // Replace private token with new token.
                if (tokens[i - 1] === ".") return labels.get(token);
                return newPrivateLabels[token];
            }
            if (gdscriptUserTypes.includes(token)) {
                // Remove user type casting.
                return removeTypeCasting(labels.get(token), tokens, i);
            }
            if (tokens[i - 1] === "class_name") {
                // Note User types.
                if (!gdscriptUserTypes.includes(token)) {
                    gdscriptUserTypes.push(token);
                }
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
