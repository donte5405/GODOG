export interface SymbolTable {
    symbolTable: string;
    charToBits: Record<string, number>;
    char60: string;
    char61: string;
}

/**
 * Prepares and returns a settings object based on the given symbol table that
 * can be used while encoding/decoding Base62. The given symbol table must be
 * at least 62 characters long and only contain unique characters.
 *
 * @param {string} newSymbolTable The symbol table to use while encoding
 * @throws {RangeError} A `RangeError` will be thrown if `newSymbolTable` is not at
 *   least 62 characters long
 * @throws {TypeError} A `TypeError` will be thrown if any duplicate characters are
 *   found in `newSymbolTable`
 */
export function prepareSymbolTable(newSymbolTable: string): SymbolTable;

/**
 * Decodes Base62 encoded data
 *
 * The given string is assumed to be encoded in Base62. The returned `Buffer`
 * can be examined as is, by using the various reader functions, or call
 * `toString()` in order to get the data encoded as `ascii`, `base64`, `hex`,
 * `latin1`, `ucs2`, default `utf8`, etc.
 *
 * @param {string} str Base62 encoded string
 * @param {object} [symbols] Symbol table to use during decoding
 * @returns {Buffer} Decoded data in form of a `Buffer`
 * @throws {RangeError} A `RangeError` will be thrown if `str` is less than
 *   two characters long
 * @see prepareSymbolTable
 *
 * @example
 * base62.decode('I6LiR6yGExUvDZ8G1').toString() // => 'Hello world!'
 *
 * @example
 * const buffer = base62.decode('AYA')
 * buffer[0] // => 0x2a
 * buffer[1] // => 0x2a
 */
export function decode(str: string, symbols?: SymbolTable): Buffer;

/**
 * Encode data into Base62 by feeding `encode()` something that can be turned
 * into a `Buffer` (such as a `string`, an `Array`, `ArrayBuffer`, or a `Buffer`)
 * and it will happily return the Base62 encoded string.
 *
 * @param {(Array|ArrayBuffer|Buffer|string)} value The data to encode in Base62
 * @param {object} [symbols] Symbol table to use during encoding
 * @returns {string} Base62 encoded string
 * @throws {TypeError} A `TypeError` will be thrown if `value` is not an `Array`,
 *   `ArrayBuffer`, `Buffer`, `string` or any other type appropriate for `Buffer.from()`
 * @see prepareSymbolTable
 *
 * @example
 * base62.encode('Hello world!') // => 'I6LiR6yGExUvDZ8G1'
 * base62.encode([0x02, 0x02]) // => 'AYA'
 */
export function encode(value: (number[] | ArrayBuffer | Buffer | string), symbols?: SymbolTable): string;
