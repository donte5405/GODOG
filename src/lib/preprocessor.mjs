//@ts-check
import { assemble, tokenise } from "./token.mjs";
import { readFile } from "fs/promises";


/** List of supported preprocessor blocks. */
export const crucialPreprocessorBlocks = [ "#GODOG_CLIENT", "#GODOG_SERVER" ];


/**
 * Strip specified code block off the source code file.
 * @param {string} filePath 
 * @param {string} block 
 */
export async function stripGdBlockFromFile(filePath, block) {
	return stripGdBlock(await readFile(filePath, { encoding: "utf-8" }), block);
}


/**
 * Strip specified code block off the source code.
 * @param {string} src 
 * @param {string} block 
 */
export function stripGdBlock(src, block) {
	const srcs = tokenise(src);
	let stripping = false;
	for (let i = 0; i < srcs.length; i++) {
		if (srcs[i][0] === "#") {
			if (srcs[i] === block) {
				stripping = !stripping;
			}
			srcs[i] = "";
			continue;
		}
		if (stripping) {
			srcs[i] = "";
		}
	}
	if (stripping) {
		throw new Error(`Block '${block}' not closed properly!`);
	}
	return assemble(srcs);
}
