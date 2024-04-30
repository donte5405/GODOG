# base62

<a href="https://en.wikipedia.org/wiki/Base62" target="_blank">Base62</a> encoder/decoder

## Installation

`npm install --save @fry/base62`

## Usage

`encode()` expects data that can be turned into a `Buffer` (e.g. a `string`,
an `Array`, `ArrayBuffer`, or a `Buffer`) and it returns the Base62 encoded 
string.

`decode()` returns the decoded data in a `Buffer` which has good readers for
binary data as well as a fast `toString()` that can return the data encoded 
in `utf8` (default), `base64`, `hex`, etc.

### Binary input

```javascript
    const base62 = require('@fry/base62');

    const encoded = base62.encode([0x2a, 0x2a]);
    // encoded => AYA

    const decoded = base62.decode(encoded);
    // decoded => <Buffer 2a 2a>

    decoded[0]; // => 0x2a
    decoded.readUInt16BE(); // => 0x2a2a
```

### String input

```javascript
    const encoded = base62.encode('Memento vivere');
    // encoded => JMLjPMvqRo1sQNPbSc5

    const decoded = base62.decode(encoded);
    // decoded => <Buffer 4d 65 6d 65 6e 74 6f 20 76 69 76 65 72 65>

    decoded.toString(); // => Memento vivere
```

### Custom symbol table

There is no standard for Base62 encoding so various encoders may use different
symbol tables. This module will by default use alphanumerical characters in 
their natural order: `0-9A-Za-z`.

To use another set of characters first initiate them with `prepareSymbolTable()`
and then supply the resulting object as a second parameter to the encode/decode
functions, e.g.:

```javascript
    const symbols = base62.prepareSymbolTable('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');
    const encoded = base62.encode([0x53, 0xfe, 0x92], symbols);
    // encoded => U98kC

    const decoded = base62.decode(encoded, symbols);
    // decoded => <Buffer 53 fe 92>
```

## Base62 encoding process

The Base62 symbol table is limited to 62 characters, which is just shy of 6 bits
of information. This means that special care needs to be taken in order to encode
any given stream of bytes. This module takes the approach of reading a sextet 
(6-bit chunk) from the binary stream and encode it into the symbol table as long
as the chunk is not in risk of overflowing. If the sextet is in the ”overflow 
zone“ then only 5 bits are used while encoding that particular chunk, indicated 
in the output by the presence of one of the symbol table’s last two characters. 
The overflow bit is left in the stream until the next sextet will be read. The 
last chunk may also be left-padded with zeroes during the encoding process which
the decoder will detect and reverse to ensure byte-alignment of the underlying 
binary stream.

Happy encoding!

/ Fry
