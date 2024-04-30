'use strict';

module.exports = {
    Bits
};

// Max number of safe integer bits in JS Number type
const maxBits = Number.MAX_SAFE_INTEGER.toString(2).length;

function Bits(bitLengthOrBuffer) {
    if (typeof bitLengthOrBuffer === 'number') {
        this.buffer = Buffer.alloc(Math.ceil(bitLengthOrBuffer / 8));
    } 
    else if (bitLengthOrBuffer instanceof Buffer) {
        this.buffer = bitLengthOrBuffer;
    }
    else {
        throw new TypeError('Initialize by specifying a bit-length or referencing a Buffer');
    }

    this._length = this.buffer.length * 8;
    this._offset = 0;
}

Bits.alloc = function(byteLength, fill, encoding) {
    return new Bits(Buffer.alloc(byteLength, fill, encoding));
}

Bits.from = function(value, encodingOrOffset, byteLength) {
    return new Bits(Buffer.from(value, encodingOrOffset, byteLength));
};

Object.defineProperties(Bits.prototype, {
    buffer: { enumerable: true, writable: true },
    _length: { writable: true },
    _offset: { writable: true }
});

Object.defineProperty(Bits.prototype, 'eof', {
    get: function() {
        return this._offset === this._length;
    },
    configurable: true,
    enumerable: true
});

Object.defineProperty(Bits.prototype, 'length', {
    get: function() {
        return this._length;
    },
    configurable: true,
    enumerable: true
});

Object.defineProperty(Bits.prototype, 'offset', {
    get: function() {
        return this._offset;
    },
    set: function(offset) {
        if (offset < 0) {
            throw new RangeError('Cannot set offset below 0');
        }
        if (offset > this._length) {
            throw new RangeError(
                `Cannot set offset to ${offset}, buffer length is ${this._length}`
            );
        }
        this._offset = Math.floor(offset);
        return this;
    },
    configurable: true,
    enumerable: true
});

Object.defineProperty(Bits.prototype, 'remaining', {
    get: function() {
        return this._length - this._offset;
    },
    configurable: true,
    enumerable: true
});

Bits.prototype.clear = function(value = 0) {
    this.buffer.fill(value);
    this._offset = 0;
    return this;
};

Bits.prototype.clearBit = function(offset) {
    this.insert(0, 1, offset);
    return this;
};

Bits.prototype.flipBit = function(offset) {
    const newValue = 1 ^ this.peek(1, offset);
    this.modifyBit(newValue, offset);
    return newValue;
};

Bits.prototype.getBit = function(offset) {
    return this.peek(1, offset);
};

Bits.prototype.insert = function(value, count = 1, offset) {
    offset = typeof offset === 'number' ? offset | 0 : this._offset;

    if (offset + count > this._length) {
        throw new RangeError(`Cannot write ${count} bits, only ${this.remaining} bit(s) left`);
    }
    if (count > maxBits) {
        throw new RangeError(`Cannot write ${count} bits, max is ${maxBits}`);
    }

    let bitsLeft = count;
    while (bitsLeft > 0) {
        const currentByte = offset >> 3;
        const offsetInByte = offset & 0b111;
        const numBits = Math.min(8 - offsetInByte, bitsLeft);

        const mask = (1 << numBits) - 1;
        const writeShift = 8 - numBits - offsetInByte;
        const newBits = ((value >>> (bitsLeft - numBits)) & mask) << writeShift;
        this.buffer[currentByte] = (this.buffer[currentByte] & ~(mask << writeShift)) | newBits;

        offset += numBits;
        bitsLeft -= numBits;
    }

    return offset;
};

Bits.prototype.modifyBit = function(value, offset) {
    this.insert(value, 1, offset);
    return this;
};

Bits.prototype.peek = function(count = 1, offset) {
    offset = typeof offset === 'number' ? offset | 0 : this._offset;

    if (offset + count > this._length) {
        throw new RangeError(`Cannot read ${count} bits, only ${this.remaining} bit(s) left`);
    }
    if (count > maxBits) {
        throw new RangeError(`Reading ${count} bits would overflow result, max is ${maxBits}`);
    }

    const offsetInByte = offset & 0b111;
    const numBits = Math.min(8 - offsetInByte, count);
    const mask = (1 << numBits) - 1;
    let result = (this.buffer[offset >> 3] >> (8 - numBits - offsetInByte)) & mask;
    offset += numBits;

    let bitsLeft = count - numBits;
    while (bitsLeft >= 8) {
        result <<= 8;
        result |= this.buffer[offset >> 3];
        offset += 8;
        bitsLeft -= 8;
    }

    if (bitsLeft > 0) {
        const shift = 8 - bitsLeft;
        result <<= bitsLeft;
        result |= (this.buffer[offset >> 3] >> shift) & (0xff >> shift);
        // offset += bitsLeft;
    }

    return result;
};

Bits.prototype.read = function(count = 1) {
    const result = this.peek(count, this._offset);
    this._offset += count;
    return result;
};

Bits.prototype.seek = function(offset, whence = 1) {
    switch (whence) {
        case 2:
            this.offset += offset;
            break;
        case 3:
            this.offset = this.length - offset;
            break;
        default:
            this.offset = offset;
    }

    return this;
};

Bits.prototype.setBit = function(offset) {
    this.insert(1, 1, offset);
    return this;
};

Bits.prototype.skip = function(count) {
    return this.seek(count, 2);
};

Bits.prototype.testBit = function(offset) {
    return !!this.peek(1, offset);
};

Bits.prototype.toString = function(encoding = 'utf8') {
    return this.buffer.toString(encoding);
};

Bits.prototype.write = function(value, count = 1) {
    this._offset = this.insert(value, count, this._offset);
    return this;
};
