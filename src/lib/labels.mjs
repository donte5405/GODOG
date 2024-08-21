//@ts-check
import { loadGodotLabels } from "./godot.labels.mjs";
import { shuffleArray } from "./shuffle.mjs";
import { getUniqueId } from "./strings.mjs";


const charCodeFirstDigit = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_";
const charCode = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_";


/** @type {string[]} List of banned labels. Will load default ones from Godot internal labels. */
const bannedLabels = await loadGodotLabels();


/**
 * Get character code according to the position.
 * @param {number} digitPos 
 */
function getCharcode(digitPos) {
	return (digitPos > 1) ? charCode : charCodeFirstDigit;
}

/**
 * 
 * @param {number} digits 
 */
function getTotalCharactersCount(digits) {
	if (digits <= 0) return 0;
	return charCodeFirstDigit.length *  Math.pow(charCode.length, digits - 1);
}


class GetId {
	charArray = [0];

	/** @type {string[]} */
	charList = [];
	charListIndex = 0;
	charListDigits = 0;

	/**
	 * @param {{charArray:number[],charList:string[],charListIndex:number,charListDigits:number}} [state] Previous object state.
	 */
	constructor(state) {
		if (state) {
			this.setState(state);
			return;
		}
	}

	getState() {
		return {
			charArray: this.charArray,
			charList: this.charList,
			charListIndex: this.charListIndex,
			charListDigits: this.charListDigits,
		};
	}

	/**
	 * @param {{charArray:number[],charList:string[],charListIndex:number,charListDigits:number}} state Previous object state.
	 */
	setState(state) {
		this.charArray = state.charArray;
		this.charList = state.charList;
		this.charListIndex = state.charListIndex;
		this.charListDigits = state.charListDigits;
	}

	get() {
		const charList = this.charList;
		const charArray = this.charArray;
		if (this.charListIndex >= charList.length) {
			charList.length = 0;
			this.charListIndex = 0;
			this.charListDigits ++;
			let totalCharactersCount = getTotalCharactersCount(this.charListDigits);
			for (let l = 0; l < totalCharactersCount; l++) {
				let x = 0;
				for (; x < charArray.length; x++) {
					if (charArray[x] < getCharcode(x).length - 1) {
						charArray[x]++;
						break;
					}
					charArray[x] = 0;
				}
				if (x >= charArray.length) {
					charArray.push(0);
				}
				let text = "";
				charArray.forEach((x, i) => {
					text += getCharcode(i)[x];
				});
				if (bannedLabels.includes(text)) continue;
				charList.push(text);
			}
			shuffleArray(charList);
		}
		this.charListIndex ++;
		return charList[this.charListIndex - 1];
	}
}


export class Labels {
	/** @type {string[]} List of all labels that both pairs are randomly generated. */
	randomList = [];
	/** @type {string[]} List of all labels that got new name generated. */
	list = [];
	/** @type {Record<string,string>} List of strings mapped from the list. */
	listMap = {};
	/** @type {GetId?} */
	getId;
	/** @type {Record<string,number>} List of string maps that contain label occurence data. */
	occurenceMap = {};

	/**
	 * Count label's occurence time/
	 * @param {string} name 
	 */
	countOccurence(name) {
		if (!this.occurenceMap[name]) {
			this.occurenceMap[name] = 0;
		}
		this.occurenceMap[name]++;
	}

	/**
	 * If specified name exists.
	 * @param {string} name 
	 */
	has(name) {
		return this.list.includes(name);
	}

	/**
	 * Map specified name to new name, and vice and versa. Returns a new name.
	 * @param {string} name 
	 * @param {string} newName 
	 */
	map(name, newName) {
		this.list.push(name);
		this.listMap[name] = newName;
		this.listMap[newName] = name;
		return newName;
	}

	/**
	 * Get a unique ID by specified name.
	 * @param {string} [name] 
	 */
	get(name) {
		if (!name) {
			name = getUniqueId();
			this.randomList.push(name);
		} else if (bannedLabels.includes(name)) return name;
		this.countOccurence(name);
		if (!this.list.includes(name)) {
			if (this.getId) {
				return this.map(name, this.getId.get());
			}
			return this.map(name, getUniqueId());
		}
		return this.listMap[name];
	}

	/** Compress labels length to something short and digestible. */
	compress() {
		const listCopy = [ ...this.list ];
		const occurence = this.occurenceMap;
		listCopy.sort((a, b) => occurence[b] - occurence[a]);
		const getId = new GetId();
		this.list.length = 0;
		this.getId = getId;
		this.listMap = {};
		for (const name of listCopy) {
			if (bannedLabels.includes(name)) continue;
			this.map(name, getId.get());
		}
	}

	exportDebugSymbols() {
		const list = this.randomList;
		const listMap = this.listMap
		for (const key of list) {
			const pair = listMap[key];
			delete listMap[pair];
			delete listMap[key];
		}
		return JSON.stringify(this.listMap);
	}

	/**
	 * @param {any} sym 
	 */
	importDebugSymbols(sym) {
		if (typeof sym === "string") {
			sym = JSON.parse(sym);
		}
		this.list = sym;
	}
}


export const labels = new Labels();
