const test = require('ava');
const base62 = require('./index');

test('Readme examples', (t) => {
    let original = 'Memento vivere';
    let encoded = base62.encode(original);
    t.is('JMLjPMvqRo1sQNPbSc5', encoded);
    let decoded = base62.decode(encoded);
    t.is(original, decoded.toString());

    original = [0x2a, 0x2a];
    encoded = base62.encode(original);
    t.is('AYA', encoded);
    decoded = base62.decode(encoded);
    t.is(original[0], decoded[0]);
    t.is(original[1], decoded[1]);

    const symbols = base62.prepareSymbolTable('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');
    original = [0x53, 0xfe, 0x92];
    encoded = base62.encode(original, symbols);
    t.is('U98kC', encoded);
    decoded = base62.decode(encoded, symbols);
    t.is(original[0], decoded[0]);
    t.is(original[1], decoded[1]);
    t.is(original[2], decoded[2]);
});

test('UTF-8 strings', (t) => {
    let original = 'aÿ';
    const encoded = base62.encode(original);
    t.is('OSEz1', encoded);
    const decoded = base62.decode(encoded).toString();
    t.is(original, decoded);

    original = '日本語';
    t.is(original, base62.decode(base62.encode(original)).toString());

    original = '🏄‍♂️';
    t.is(original, base62.decode(base62.encode(original)).toString());
});

test('1-character string', (t) => {
    t.is('a', base62.decode(base62.encode('a')).toString());
    t.is(0, base62.decode(base62.encode(null)).readUInt8());
});

test('Too short base62 string', (t) => {
    t.throws(() => {
        base62.decode('A');
    }, { instanceOf: RangeError });
});

test('Encode a number', (t) => {
    const original = 0xaa;
    t.is(original, base62.decode(base62.encode(original)).readUInt8());
});

test('Encode array of numbers', (t) => {
    const original = [0x00, 0xaa, 0xff];
    const encoded = base62.encode(original);
    t.is('0Ahz1', encoded);
    const decoded = base62.decode(encoded);
    t.is(original[0], decoded[0]);
    t.is(original[1], decoded[1]);
    t.is(original[2], decoded[2]);
    t.is(Buffer.from(original).toString('hex'), decoded.toString('hex'));
});

test('Use different symbol table', (t) => {
    const naturalOrder = base62.prepareSymbolTable('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz');
    const original = '[0x00, 0x22, 0x44, 0x66, 0x88, 0xaa, 0xcc, 0xff]';

    // Default is `naturalOrder` so it should work interchangeably with the default parameter
    t.is(original, base62.decode(base62.encode(original, naturalOrder)).toString());
    t.is(original, base62.decode(base62.encode(original), naturalOrder).toString());
    t.is(original, base62.decode(base62.encode(original, naturalOrder), naturalOrder).toString());

    const researchPaper = base62.prepareSymbolTable('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');
    t.not(original, base62.decode(base62.encode(original, researchPaper)).toString());
    t.not(original, base62.decode(base62.encode(original), researchPaper).toString());
    t.is(original, base62.decode(base62.encode(original, researchPaper), researchPaper).toString());

    const shuffled = base62.prepareSymbolTable(naturalOrder.symbolTable.split('').sort(() => (Math.random() - 0.5)).join(''));
    t.is(original, base62.decode(base62.encode(original, shuffled), shuffled).toString());
});

test('Prepare symbol table', (t) => {
    // Too short symbol table
    t.throws(() => {
        base62.prepareSymbolTable('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxy');
    }, { instanceOf: RangeError });

    // Repeated characters
    t.throws(() => {
        base62.prepareSymbolTable('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyy');
    }, { instanceOf: TypeError });

    // A too long symbol table should be OK
    const symbolTable = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzåäö';
    const symbols = base62.prepareSymbolTable(symbolTable);
    t.is('string', typeof symbols.symbolTable);
    t.is(62, symbols.symbolTable.length);
    t.is('object', typeof symbols.charToBits);
    t.is(62, Object.keys(symbols.charToBits).length);
    t.is(symbolTable.charAt(60), symbols.char60);
    t.is(symbolTable.charAt(61), symbols.char61);
});
