//@ts-check
import { allowedNumberSymbols, asciiNumbers, asciiSymbols, isLabel, isString } from "./strings.mjs";


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


/**
     * Tokenise GDScript into something able to be processed.
     * @param {string} str 
	 * @param {"gd"|"clang"|"tscn"} mode
     */
export function tokenise(str, mode = "gd") {
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
				case ";":
					if (mode == "tscn") {
						setState("comment");
						return;
					}
					setState("symbol");
					break;
				case "#":
					if (mode == "gd") {
						setState("comment");
						return;
					}
					setState("symbol");
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
				case "/":
					if (mode == "clang") {
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
					setState("symbol");
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
			case "comment_c":
				if (c === "*" && str[i + 1] === "/") {
					pushBuffer(2);
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
						//case "#":
						case `"`: case `'`:
							return false;
						default:
							pushBuffer();
							submitBuffer();
							return false;
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
 * Assemble GD Tokens into string.
 * @param {string[]} token 
 */
export function assemble(token) {
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
