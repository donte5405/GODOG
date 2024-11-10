//@ts-check
import { allowedNumberSymbols, asciiNumbers, asciiSymbols, isLabel, isString } from "./strings.mjs";


const errUnsupportedNestedMultiline = new Error(`Multiple multiline strings in single line isn't supported.`);
const errUnknownState = new Error("Unknown state reached, seems like GODOG bug.");
const errBracketsNotClosed = new Error("Some brackets aren't closed properly.");


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
function formatGdScript(str) {
	const strs = str.split("\n");
	const strs_len = strs.length;
	let inMultilineString = false;
	for (let i = 0; i < strs_len; i++) {
		if (!inMultilineString) {
			const lines = strs[i].split("");
			let j = 0;
			for (; j < lines.length; j++) {
				if (lines[j] === "\t") continue;
				if (lines[j] === " ") {
					lines[j] = "\t";
					continue;
				}
				break;
			}
			if (lines.length && j === lines.length) {
				strs[i] = "\r"; // Mark empty tabulated line as carriage return to remove.
			} else {
				strs[i] = lines.join("");
			}
		}
		if (strs[i].includes(`"""`)) {
			if (strs[i].split(`"""`).length > 2) {
				throw errUnsupportedNestedMultiline;
			}
			inMultilineString = !inMultilineString;
		}
	}
	// Get rid of excessive newlines.
	let newlineCount = 0;
	for (let i = 0; i < strs_len; i++) {
		if (strs[i] === "\r") {
			strs[i] = "";
			continue;
		}
		if (strs[i] === "") {
			if (newlineCount < 1) {
				strs[i] = "\n";
				newlineCount ++;
				continue;
			}
			strs[i] = "";
			continue;
		}
		newlineCount = 0;
		strs[i] += "\n";
	}
	if (strs[strs_len - 1] === "\n") {
		// Fix newline growing at the end for some reason.
		strs[strs_len - 1] = "";
	}
	return strs.join("");
}


/**
 * Tokenise GDScript into something able to be processed.
 * @param {string} str 
 * @param {"gd"|"clang"|"tscn"|"path"} mode
 */
export function tokenise(str, mode = "gd") {
	if (mode === "gd") {
		str = formatGdScript(str);
	}

	/** @type {string[]} */
	const strs = [];
	let i = 0;
	let buffer = "";
	let escapeChar = 0;
	let bracketStack = 0;
	let strThreeQuotes = false;

	const entryState = () => {
		submitBuffer();
		const c = str[i];
		if (asciiSymbols.includes(c)) {
			switch (c) {
				case " ": skipBuffer(); return;
				case "\\":
					if (mode === "gd") {
						// Get rid of back slash syntaxes.
						while ([ "\\", "\n", "\t" ].includes(str[i])) {
							skipBuffer();
						}
						return;
					}
					break;
				// If it's GDScript, ignore \n and \t  when it's in brackets.
				case "[":
				case "(":
				case "{":
					if (mode === "gd") {
						bracketStack ++;
					}
					break;
				case "\t":
				case "\n":
					if (mode === "gd") {
						if (bracketStack) {
							skipBuffer();
							return;
						}
					}
					break;
				case "]":
				case ")":
				case "}":
					if (mode === "gd") {
						bracketStack --;
					}
					break;
				// END If it's GDScript, ignore \n \t when it's in brackets.
				case ";":
					if (mode === "tscn") {
						setState("comment");
						return;
					}
					break;
				case "#":
					if (mode === "gd") {
						setState("comment");
						return;
					}
					break;
				case `"`: case `'`:
					if (mode === "clang" && str[i - 1] === "R") { // Raw string literals.
						let ii = 1;
						let customDelimeter = "";
						for (; i + ii < str.length; ii++) {
							if (str[i + ii] === "(") {
								setState("clang_raw_str", ii + 1, { delimiter: ")" + customDelimeter });
								return;
							}
							customDelimeter += str[i + ii];
						}
						throw new Error("Raw string delimeter out of bounds.");
					}
					if (str[i + 1] === c && str[i + 2] === c) {
						strThreeQuotes = true;
						skipBuffer(2);
						setState("string", 1);
						return;
					}
					setState("string");
					return;
				case "/":
					if (mode === "clang") {
						if (c === "/") {
							const cNxt = str[i + 1];
							if (cNxt === "/") {
								setState("comment", 2);
								return;
							} else if (cNxt === "*") {
								setState("comment_c", 2);
								return;
							}
						}
					}
					break;
			}
			setState("symbol");
		} else if (mode === "path" || mode === "tscn") {
			setState("label_path");
		} else if (asciiNumbers.includes(c)) {
			setState("number");
		} else {
			setState("label");
		}
	};

	const setState = (state = "", pushBufferCount = 0, storage = { delimiter: "" }) => {
		pushBuffer(pushBufferCount);
		while (runState(state, storage)) {
			if (i < str.length) continue;
			break;
		}
	};

	const runState = (state = "", storage = { delimiter: "" }) => {
		const c = str[i];
		switch (state) {
			default:
				throw errUnknownState;
			case "comment":
				if (c === "\n") {
					return false;
				}
				pushBuffer();
				return true;
			case "comment_c":
				if (c === "*" && str[i + 1] === "/") {
					pushBuffer(2);
					return false;
				}
				pushBuffer();
				return true;
			case "label_path":
				if (asciiSymbols.includes(c)) {
					if (![ ".", "-", "@", "%" ].includes(c)) return false;
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
				if (mode === "clang" && [ "'" ].includes(c)) {
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
				if (strThreeQuotes) {
					if (c === "\n") {
						buffer += "\\n";
						skipBuffer();
						return true;
					}
					if (c === "\t") {
						buffer += "\\t";
						skipBuffer();
						return true;
					}
				}
				if (c === stringSymbol()) {
					if (strThreeQuotes) {
						if (str[i + 1] === c && str[i + 2] === c) {
							strThreeQuotes = false;
							skipBuffer(2);
							pushBuffer();
							return false;
						} else {
							buffer += "\\" + c;
							skipBuffer();
							return true;
						}
					} else {
						pushBuffer();
						return false;
					}
				}
				pushBuffer();
				return true;
			case "clang_raw_str":
				const delimiter = storage.delimiter;
				if (str.slice(i, i + delimiter.length) === delimiter) {
					pushBuffer(delimiter.length + 1);
					return false;
				}
				pushBuffer();
				return true;
			case "symbol":
				pushBuffer();
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

	// Process state.
	while (i < str.length) {
		entryState();
	}
	submitBuffer(); // FIX: the script not picking the last element in the string stream.

	if (bracketStack !== 0) {
		throw errBracketsNotClosed;
	}

	/** @type {string[]} */
	const postStrs = [];
	for (let i = 0; i < strs.length; i++) {
		const symbol3 = strs[i] + strs[i + 1] + strs[i + 2];
		if (gdComboSymbols.includes(symbol3)) {
			postStrs.push(symbol3);
			i += 2;
		}
		const symbol2 = strs[i] + strs[i + 1];
		if (gdComboSymbols.includes(symbol2)) {
			// Group symbols together
			postStrs.push(symbol2);
			i += 1;
			continue;
		}
		postStrs.push(strs[i]);
	}
	return postStrs;
}


/**
 * Assemble GD Tokens into string.
 * @param {string[]} token 
 * @param {"gd"|"clang"|"tscn"|"path"} mode
 */
export function assemble(token, mode = "gd") {
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
				} else if (t2nd != "\n") {
					if (
						(mode == "gd" && t1st[0] === "#") ||
						(mode == "clang" && t1st[0] === "/" && (["/", "*"].includes(t1st[1]))) ||
						(mode == "tscn" && t1st[0] === ";")
					) {
						newToken.push("\n");
					}
				}
			}
		}
	}
	if (mode === "gd") {
		return formatGdScript(newToken.join(""));
	}
	return newToken.join("");
}
