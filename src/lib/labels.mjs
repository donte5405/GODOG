//@ts-check
import { encode } from "@fry/base62";


function getUniqueId() {
    return "_" + encode(Buffer.from(crypto.randomUUID().split("-").join(""), "hex"));
}


export class Labels {
    /** If this is for release mode. */
    releaseMode = false;
    /** @type {Record<string,string>} */
    list = {};
    /** @type {Record<string,string>} */
    namedList = {};

    exportDebugSymbols() {
        return JSON.stringify(this.list);
    }

    /**
     * If specified name exists.
     * @param {string} name 
     */
    has(name) {
        return this.list[name] ? true : false;
    }

    /**
     * Get a unique ID by specified name.
     * @param {string} [name] 
     */
    get(name) {
        if (!name) {
            name = getUniqueId();
            this.list[name] = name;
        } else if (!this.list[name]) {
            const newName = getUniqueId();
            this.list[name] = newName;
            this.list[newName] = name;
        }
        return this.list[name];
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
