//@ts-check
import { GDParser } from "./parser.mjs";
import { formatStringQuote, isString } from "./strings.mjs";


const docLocaleCsvGuide = `
Why is that?

GODOG expects CSV translation to be properly quoted to ensure that texts will be properly formatted.

---

"keys","en","es","fr"
"Greeting","Hello!","¡Hola!","Bonjour!"
"Goodbye","Bye!","Adiós!","Au revoir!"

---

This CSV structure will NOT be accepted by GODOG and WILL NOT be processed:

---

keys,en,es,fr
Greeting,Hello!,¡Hola!",Bonjour!
Goodbye",Bye!,Adiós!,Au revoir!

`;
let guidedUsers = false;


const commonCsvSeparators = [ ",", "\t", " ", ";", ];


function printError(reason = "", filePath = "") {
	console.error(new Error(`The CSV string sequence${filePath ? ` of the file "${filePath}" ` : ` `}${reason}.`));
	if (guidedUsers) return;
	guidedUsers = true;
	console.log(docLocaleCsvGuide);
}


/**
 * Parse translation CSV string, and return the result as a parsed string.
 * @param {string} str 
 */
export function parseLocaleCsv(str, filePath = "") {
	let i = 0;
	let separator = "";
	let cellColIndex = 0;
	const parser = new GDParser();
	const tokens = parser.tokenise(str);

	// Verify expected CSV structures.
	if (tokens[0] === "keys") {
		printError("aren't contained in string quotes", filePath);
		return str;
	}

	// Verify CSV characteristics.
	for (const token of tokens) {
		i++;
		if (isString(token)) {
			try {
				/** @type {string} */
				const cell = JSON.parse(formatStringQuote(token));
				if (i === 1) {
					if (cell !== "keys") {
						console.log(`'${filePath}' doesn't seem to be a translation file, skip`);
						return str;
					}
				}
			} catch {
				printError("doesn't seem to be a valid translation file due to malformed string structure.", filePath);
				return str;
			}
		} else {
			if (token === "\n") {
				break;
			}
			if (!separator) {
				if (!commonCsvSeparators.includes(token)) {
					printError("used not-well-known CSV strings", filePath);
					return str;
				}
				separator = token;
			} else if (separator !== token) {
				printError("has inconsistent separator styles or unknown symbols of '" + token + "'", filePath);
				return str;
			}
		}
		
	}

	// Parse all possible keys.
	for (; i < tokens.length; i++) {
		const token = tokens[i];
		if (token.length === 1) {
			if (token === "\n") {
				cellColIndex = 0;
				continue;
			} else if (token !== separator) {
				printError("contains an unknown character sequence of '" + token + "'", filePath);
				return str;
			}
		}
		try {
			/** @type {string} */
			const cell = formatStringQuote(token);
			tokens[i] = (cellColIndex === 0 ? JSON.stringify(parser.parseToken(JSON.parse(cell))) : cell);
		} catch {
			printError("doesn't seem to be a valid translation file due to malformed string structure.", filePath);
			return str;
		}
		cellColIndex ++;
	}

	return parser.assemble(tokens);
}
