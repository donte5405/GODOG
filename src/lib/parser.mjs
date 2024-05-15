//@ts-check
import { readFile } from "fs/promises";
import { Configuration } from "./options.mjs";
import { loadGodotLabels } from "./godot.labels.mjs";
import { labels } from "./labels.mjs";
import { crucialPreprocessorBlocks } from "./preprocessor.mjs";
import { hasTranslations, parseTranslations } from "./locale.mjs";
import { asciiNumbers, asciiSymbols, formatStringQuote, isLabel, isString, looksLikeStringPath, toGodotJson, toStandardJson } from "./strings.mjs";
import { assemble, tokenise } from "./token.mjs";
// import { writeFileSync } from "fs";
// import { randomUUID } from "crypto";
// import { fileURLToPath } from "url";
// import { dirname, join } from "path";


// const __filename = fileURLToPath(import.meta.url);
// const testPath = join(dirname(__filename), "../", "../", "/TEST");


/** @type {string[]} User-defined GDScript types. */
const gdScriptUserTypes = [];


/** List of Godot labels. */
const godotLabels = await loadGodotLabels();


/** @type {Configuration?} Configuration that will be used. */
let config;


/**
 * Find current line amount of indents.
 * @param {string[]} tokens 
 * @param {number} i 
 */
function countIndents(tokens, i) {
    let count = 0;
    for (i -= 1; i >= 0; i--) {
        if (tokens[i] === "\n") break;
        if (tokens[i] !== "\t") continue;
        count++;
    }
    return count;
}


/**
 * If specified token has Indentation at its front.
 * @param {string[]} tokens 
 * @param {number} i 
 */
function hasIndentAtItsFront(tokens, i) {
    return [ "\t", "\n" ].includes(tokens[i - 1]);
}


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
    if (config) {
        // If type casting shouldn't be bothered, skip.
        if (!config.removeTypeCasting) return token;
    }
    if (tokens[i - 1] === ":" && [ "=", ",", ")", "\n" ].includes(tokens[i + 1])) {
        let bracesStack = 0;
        for (let ii = i - 4; ii > 0; ii--) {
            // Export types without manual inferring still need type casting.
            if (tokens[ii] === ")") bracesStack ++;
            if (tokens[ii] === "(") bracesStack --;
            if (bracesStack) continue;
            if (tokens[ii] === "export") return token; // Prevent catastrophe where Godot needs type to stay in export types.
            if (tokens[ii] === "\n") break;
        }
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
    /** For detecting local vars in the scoped (inner) class indentation. */
    currentClassIndent = 0;
    /** @type {Record<string,string>} Private labels. */
    privateLabels = {};
    /** Filename that the parser is handling. Does nothing except warning users. */
    fileName = "";
    /** If this parser is still in ignore block. */
    isInIgnoreBlock = false;

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
        return new this(mode).tellFileName(fileName).parse(await readFile(fileName, { encoding: "utf-8" }), mode);
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
        return o.parse(str, mode);
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
        return this.assemble(this.parseTokens(this.tokenise(str, mode), mode), mode);
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
     * Get a private label mapped to the specified source label.
     * @param {string} sourceLabel 
     */
    _getOrAddPrivateLabel(sourceLabel) {
        if (!this.privateLabels[sourceLabel]) {
            this.privateLabels[sourceLabel] = labels.get();
        }
        return this.privateLabels[sourceLabel];
    }

    /**
     * Parse specified token and decide if the specified token should be returned as what.
     * @param {string|string[]} tokens
     * @param {number} i
     * @param {"gd"|"clang"|"tscn"|"path"} mode
     * @returns {string}
     */
    parseToken(tokens, i = 0, mode = this.mode) {
        if (typeof tokens === "string") {
            tokens = [tokens];
        }

        const token = tokens[i];

        // Ignore empty lines.
        if (!token) return "";

        // Process symbols.
        if (asciiSymbols.includes(token[0])) {
            // For GDScript only.
            if (mode === "gd") {
                // Parse comment.
                if (token[0] === "#") {
                    const tokenNsp = token.split(" ").join("");
                    for (const block of crucialPreprocessorBlocks) {
                        if (tokenNsp.indexOf(block) === 0) {
                            if (config) {
                                config.crucialPreprocessorsDetected = true;
                            }
                            // Keep the comment for now, will use platform-specific preprocessors.
                            return token;
                        }
                    }
                    if (tokenNsp.indexOf("#GODOG_IGNORE") === 0) {
                        // Ignore code blocks that aren't required.
                        this.isInIgnoreBlock = !this.isInIgnoreBlock;
                        tokens[i + 1] = ""; // also remove the line break behind it.
                        return "";
                    }
                    if (tokenNsp.indexOf("#GODOG_LABEL:") === 0) {
                        // Define scrambled label.
                        const userLabels = tokenNsp.split(" ").join("").split("#GODOG_LABEL:")[1].split(",");
                        for (const userLabel of userLabels) {
                            labels.get(userLabel);
                        }
                        // Remove comment.
                        return "";
                    }
                    if (tokenNsp.indexOf("#GODOG_PRIVATE:") === 0) {
                        // Define private labels.
                        const privateLabels = tokenNsp.split(" ").join("").split("#GODOG_PRIVATE:")[1].split(",");
                        for (const privateLabel of privateLabels) {
                            this._getOrAddPrivateLabel(privateLabel);
                        }
                        // Remove comment.
                        return "";
                    }
                    // Remove comment.
                    return "";
                }
                if (this.isInIgnoreBlock) {
                    // Remove everything inside the ignore block.
                    return "";
                }
                // Remove inferred type casting.
                if (token === ":=") {
                    if (config) {
                        if (config.removeTypeCasting) {
                            return "=";
                        }
                    }
                    return token;
                }
            }

            // Parse user-defined strings.
            if (isString(token)) {
                if (mode === "tscn") {
                    if (tokens[i - 8] === "application" && tokens[i - 4] === "config" && tokens[i - 3] === "/" && tokens[i - 2] === "name" && tokens[i - 1] === "=") {
                        return token; // Prevent game name to be changed (crucial, because Godot references this for file saving).
                    }
                }
                if (tokens[i + 1] === "%") {
                    if (config) {
                        if (!config.ignoreStringFormattings) {
                            throw new Error(`[${this.fileName}] Direct string formatting (%) isn't allowed. Unless you absolutely know what you're doing, disable this option with 'ignoreStringFormattings'.\nTo avoid this issue, use CSV translation tables even if the game only supports English.`);
                        }
                    }
                }
                let str = formatStringQuote(token);
                if (mode === "tscn") {
                    str = toStandardJson(str);
                }
                str = JSON.parse(str);
                if (hasTranslations(str)) {
                    // If it has translation strings.
                    str = parseTranslations(str);
                } else if (looksLikeStringPath(str)) {
                    // If it looks like index access.
                    if (isLabel(str) && this.privateLabels[str]) {
                        // If it's single label, allow private labels.
                        str = this.privateLabels[str];
                    } else {
                        // If it seems to be a NodePath or others.
                        str = this.parse(str, "path");
                    }
                }
                str = JSON.stringify(str);
                if (mode === "tscn") {
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
        if (mode === "path") { // For path strings.
            // Ignore Godot labels.
            if (godotLabels.includes(token)) return token;
            return labels.get(token);
        }
        if (mode === "tscn") { // For TSCN, TRES, other Godot related files, and files that don't need user labels randomisation.
            // Ignore Godot labels.
            if (godotLabels.includes(token)) return token;
            // Only replace known strings.
            if (labels.has(token)) return labels.get(token);
            // Ignore unknown strings.
            return token;
        }
        if (mode === "gd") { // For GDScript files.
            if (isLabel(token) && tokens[i - 1] === "@") {
                // In case of Godot 4, ignore labels with potential of being annotations.
                // It should be safe to assume because Godot 3 only uses "@" for string names.
                return token;
            }
            if (godotLabels.includes(token)) {
                if (token === "class") {
                    // Set current (inner) class indentation depth.
                    for (i++; i < tokens.length; i++) {
                        // Find a new line.
                        if (tokens[i] === "\n") break;
                    }
                    for (i++; i < tokens.length; i++) {
                        // Find the entry of the first token behind indents.
                        if (tokens[i] !== "\t") break;
                    }
                    this.currentClassIndent = countIndents(tokens, i);
                    return token;
                } else if ([ "extends", "tool", "class_name", "var", "const", "enum", "signal", "export", "onready", "func", "static", "remote", "master", "puppet", "remotesync", "mastersync", "puppetsync" ].includes(token)) {
                    // Calibrate current (inner) class indentation if it falls into lower indentation.
                    if (hasIndentAtItsFront(tokens, i)) {// In case of Godot 4, because it has lambda.
                        const myIndent = countIndents(tokens, i);
                        if (myIndent < this.currentClassIndent) {
                            this.currentClassIndent = myIndent;
                        }
                    }
                }
                if (token === "class_name") {
                    // Note User types.
                    const className = tokens[i + 1];
                    if (!gdScriptUserTypes.includes(className)) {
                        gdScriptUserTypes.push(className);
                    }
                    return token;
                }
                if (token === "func") {
                    // Note private labels from functions.
                    let bracketStack = 1;
                    for (i++; i < tokens.length; i++) {
                        if (tokens[i] === "(") break;
                    }
                    for (i++; i < tokens.length; i++) {
                        const bToken = tokens[i];
                        if (bToken === "(") {
                            bracketStack ++;
                            continue;
                        }
                        if (bToken === ")") {
                            bracketStack --;
                            if (!bracketStack) break;
                            continue;
                        }
                        if ([",", "("].includes(tokens[i - 1])) {
                            this._getOrAddPrivateLabel(tokens[i]);
                        }
                    }
                    return token;
                }
                if (token === "var") {
                    // Note private labels created by local `var` constructors.
                    if (this.currentClassIndent === countIndents(tokens, i)) return token;
                    this._getOrAddPrivateLabel(tokens[i + 1]);
                    return token;
                }
                // Try to get rid of type casting if possible.
                return removeTypeCasting(token, tokens, i);
            }
            if (this.privateLabels[token]) {
                // Replace private token with new token.
                if (tokens[i - 1] === ".") return labels.get(token);
                return this.privateLabels[token];
            }
            if (gdScriptUserTypes.includes(token)) {
                // Remove user type casting.
                return removeTypeCasting(labels.get(token), tokens, i);
            }
            return labels.get(token);
        }
        return token;
    }

    /**
     * Assemble GD Tokens into string.
     * @param {string[]} token 
     */
    assemble(token, mode = this.mode) {
        if (this.isInIgnoreBlock) {
            throw new Error(`Incomplete '#GODOG_IGNORE' block in the file '${this.fileName}'!`);
        }
        return assemble(token, mode);
    }
}
