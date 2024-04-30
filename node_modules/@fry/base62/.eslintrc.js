module.exports = {
    env: {
        commonjs: true,
        es2021: true,
        node: true,
    },
    extends: [
        'eslint:recommended',
        'airbnb-base',
    ],
    parserOptions: {
        ecmaVersion: 12,
    },
    rules: {
        indent: ['error', 4],
        'no-bitwise': 0,
        'no-use-before-define': 0,
        strict: 0,
    },
};
