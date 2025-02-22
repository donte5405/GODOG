//@ts-check
import { randomUUID } from "crypto";
import { md5 } from "./md5.mjs";


/** @param {string} str */
const errIncompleteTrQuote = (str) => new Error(`There's incomplete enclosed quad underscore in the string below\n ${str}`);


const trQuote = "----- LOCALE -----";


/** @type {Record<string,string>} List of mapped translations. */
export const translations = {};


/** Flush all translation keys. */
export function flushTranslations() {
	for (const key of Object.keys(translations)) {
		delete translations[key];
	}
}


/**
 * Check the specified string if it has translations inside.
 * @param {string} str 
 */
export function hasTranslations(str) {
	return str.includes(trQuote);
}


/**
 * Parse translation strings and map into text files with hashed names.
 * @param {string} str 
 */
export function parseTranslations(str) {
	const lines = str.split(trQuote);
	if (lines.length !== 3)
		throw errIncompleteTrQuote(str);
	const trKey = lines[1].substring(1, lines[1].length - 1).split("\n").join(",");
	/** @type {Record<string,string>} */
	const json = JSON.parse(`{${trKey}}`);
	const strid = randomUUID().split("-").join("");
	for (const lang of Object.keys(json)) {
		translations[md5(lang + "_" + strid)] = json[lang];
	}
	return strid;
}
