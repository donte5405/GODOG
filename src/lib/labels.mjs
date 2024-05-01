//@ts-check
import { encode } from "@fry/base62";
import { randomUUID } from "crypto"; 
import { shuffleArray } from "./shuffle.mjs";


const charCode = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";


function getUniqueId() {
    return "_" + encode(Buffer.from(randomUUID().split("-").join(""), "hex"));
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
            let totalCharactersCount = Math.pow(charCode.length, this.charListDigits);
            for (let l = 0; l < totalCharactersCount; l++) {
                let x = 0;
                for (; x < charArray.length; x++) {
                    if (charArray[x] < charCode.length - 1) {
                        charArray[x]++;
                        break;
                    }
                    charArray[x] = 0;
                }
                if (x >= charArray.length) {
                    charArray.push(0);
                }
                let text = "_";
                charArray.forEach((x) => {
                    text += charCode[x];
                });
                text += "_";
                charList.push(text);
            }
            shuffleArray(charList);
        }
        this.charListIndex ++;
        return charList[this.charListIndex - 1];
    }
}


export class Labels {
    /** If this is for release mode. */
    releaseMode = false;
    /** @type {string[]} List of all labels that got new name generated. */
    list = [];
    /** @type {Record<string,string>} List of strings mapped from the list. */
    listMap = {};
    /** @type {GetId?} */
    getId;

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
        if (!name) name = getUniqueId();
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
        const getId = new GetId();
        this.list.length = 0;
        this.getId = getId;
        this.listMap = {};
        for (const name of listCopy) {
            this.map(name, getId.get());
        }
    }

    exportDebugSymbols() {
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
