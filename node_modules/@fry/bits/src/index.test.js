'use strict';

const test = require('ava');
const { Bits } = require('./index');

test('Readme example', t => {
    const bits = new Bits(2 * 8);

    // Write some bits, jump to the beginning of the buffer and read all bits
    const value = bits
        .write(7, 3)
        .write(0x55, 7)
        .write(0b10, 2)
        .seek(0)
        .read(12); // value = 0b111101010110

    t.is(0b111101010110, value);

    // Turn on bit 4 and 5
    bits.insert(0b11, 2, 4);

    // Read the same 2 bits, not moving the offset
    const bits45 = bits.peek(2, 4); // bits = 0b11
    t.is(0b11, bits45);

    // Get bit 4
    const bit4 = bits.getBit(4); // bit4 = 0b1
    t.is(0b1, bit4);

    // Set bit 5 to 1
    bits.setBit(5);

    // Test if bit 5 is 1
    const bit5 = bits.testBit(5); // bit5 = true
    t.is(true, bit5);

    // Clear bit 5 and flip bit 6
    bits
        .clearBit(5)
        .flipBit(6);

    // Stringify the buffer (e.g. ascii, utf8, ucs2, base64, binary, hex)
    const hex = bits.toString('hex'); // hex = 'fb60'
    t.is('fb60', hex);
});

test('Basic properties for first byte', t => {
    const buffer = Bits.alloc(1);
    t.is(false, buffer.eof);
    t.is(8, buffer.length);
    t.is(0, buffer.offset);
    t.is(8, buffer.remaining);
    buffer.write(0b1, 1);
    t.is(false, buffer.eof);
    t.is(8, buffer.length);
    t.is(1, buffer.offset);
    t.is(7, buffer.remaining);
    buffer.write(0b01, 2);
    t.is(false, buffer.eof);
    t.is(8, buffer.length);
    t.is(3, buffer.offset);
    t.is(5, buffer.remaining);
    buffer.write(0b101, 3);
    t.is(false, buffer.eof);
    t.is(8, buffer.length);
    t.is(6, buffer.offset);
    t.is(2, buffer.remaining);
    buffer.write(0b1, 1);
    t.is(false, buffer.eof);
    t.is(8, buffer.length);
    t.is(7, buffer.offset);
    t.is(1, buffer.remaining);
    buffer.write(0b1, 0); // Write nothing
    t.is(false, buffer.eof);
    t.is(8, buffer.length);
    t.is(7, buffer.offset);
    t.is(1, buffer.remaining);
    buffer.write(0b0, 1);
    t.is(true, buffer.eof);
    t.is(8, buffer.length);
    t.is(8, buffer.offset);
    t.is(0, buffer.remaining);
    buffer.seek(0);
    t.is(0b101101, buffer.read(6));
    t.is(0b10, buffer.peek(2));
    t.is(0b1, buffer.getBit(6));
    t.is(0b0, buffer.getBit(7));
    t.is(0b10, buffer.read(2));
    t.is(true, buffer.eof);
    t.is(8, buffer.length);
    t.is(8, buffer.offset);
    t.is(0, buffer.remaining);
});

test('String formats', t => {
    const buffer = Bits.from('日本語');
    t.is('日本語', buffer.toString());
    t.is('日本語', buffer.toString('utf8'));
    t.is('e697a5e69cace8aa9e', buffer.toString('hex'));
    t.is('5pel5pys6Kqe', buffer.toString('base64'));
});
