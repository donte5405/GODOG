# bits – Bits <3 Buffers

A tool for twiddling bits in buffers

## Installation

`npm install --save @fry/bits`

## Usage

Create a 0-filled bit-buffer with a length of any given bit-length

```javascript
const { Bits } = require('bits');
const bits = new Bits(15 * 8); // 15 bytes capacity
```

Or reference an already exisiting `Buffer`

```javascript
const buffer = Buffer.from([0xff, 0x00, 0xff, 0x00]);
const bits = new Bits(buffer);
```

There are also convenience functions to create prefilled buffers (note that these use byte-length arguments)

```javascript
const bits = Bits.alloc(6, 0xaa); // 6 * 8 bits capacity, with 0b10101010... repeated for all bits
```

```javascript
const bits = Bits.from('Yml0YnVm', 'base64'); // 48 bits capacity prefilled with data
```

After instantiating the bit-buffer you can begin manipulating the bits

```javascript
const bits = new Bits(2 * 8);

// Write some bits, jump to the beginning of the buffer and read all bits
const value = bits
    .write(7, 3)
    .write(0x55, 7)
    .write(0b10, 2)
    .seek(0)
    .read(12); // value = 0b111101010110

// Turn on bit 4 and 5
bits.insert(0b11, 2, 4);

// Read the same 2 bits, not moving the offset
bits.peek(2, 4); // 0b11

// Get bit 4
bits.getBit(4); // 0b1

// Set bit 5 to 1
bits.setBit(5);

// Test if bit 5 is 1
bits.testBit(5); // true

// Clear bit 5 and flip bit 6
bits
    .clearBit(5)
    .flipBit(6);

// Stringify the buffer (e.g. ascii, utf8, ucs2, base64, binary, hex)
bits.toString('hex'); // 'fb60'
```
