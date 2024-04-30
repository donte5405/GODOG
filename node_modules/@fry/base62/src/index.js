'use strict';

const { Bits } = require('@fry/bits');

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
exports.prepareSymbolTable = (newSymbolTable) => {
    if (newSymbolTable.length < 62) {
        throw new RangeError('The symbol table has to be at least 62 characters long');
    }

    const symbolTable = newSymbolTable.substr(0, 62);
    const charToBits = Object.fromEntries(
        symbolTable.split('').map((char, index) => [char, index]),
    );

    if (Object.keys(charToBits).length !== 62) {
        throw new TypeError('Each character in the symbol table must be unique');
    }

    return {
        symbolTable,
        charToBits,
        char60: symbolTable.charAt(60),
        char61: symbolTable.charAt(61),
    };
};

const defaultSymbols = exports.prepareSymbolTable('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz');

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
exports.decode = (str, symbols = defaultSymbols) => {
    if (str.length < 2) {
        throw new RangeError('Base62 string must have at least two characters (i.e. at least 1 byte of encoded data)');
    }

    const buffer = Bits.alloc((str.length * 6) / 8);
    str
        .slice(0, -1)
        .split('')
        .forEach((char) => {
            if (char === symbols.char60) {
                buffer.write(0b11110, 5);
                return;
            }
            if (char === symbols.char61) {
                buffer.write(0b11111, 5);
                return;
            }

            buffer.write(symbols.charToBits[char], 6);
        });

    // Remove zero-padding in last byte
    const value = symbols.charToBits[str.substr(-1, 1)];
    buffer.write(value, 8 - (buffer.offset & 0b111));

    return buffer.buffer;
};

function prepareValueForBuffer(value) {
    if (typeof value === 'string'
        || Array.isArray(value)
        || value instanceof Buffer
        || value instanceof ArrayBuffer
        || (typeof value === 'object' && value !== null)
    ) {
        return value;
    }
    return [value];
}

function encodeSextet(out, sextet, symbols) {
    // First 5 bits are neither 11110 nor 11111
    if (sextet < 60) {
        out.push(symbols.symbolTable.charAt(sextet));
        return 0;
    }
    // First 5 bits are 11110 (i.e. 0b111100 and 0b111101)
    if (sextet < 62) {
        out.push(symbols.symbolTable.charAt(60));
        return -1;
    }
    // First 5 bits are 11111 (i.e. 0b111110 and 0b111111)
    out.push(symbols.symbolTable.charAt(61));
    return -1;
}

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
exports.encode = (value, symbols = defaultSymbols) => {
    const buffer = Bits.from(prepareValueForBuffer(value));
    const out = [];

    while (buffer.remaining >= 6) {
        const bits = buffer.read(6);
        buffer.offset += encodeSextet(out, bits, symbols);
    }

    if (buffer.remaining > 0) {
        const bits = buffer.read(buffer.remaining);
        encodeSextet(out, bits, symbols);
    }

    return out.join('');
};
