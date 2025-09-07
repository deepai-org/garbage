const { Lexer } = require('../dist/lexer');

console.log('=== Debug tokenization of failing cases ===');

const testCases = [
    `const result = condition ? <Success /> : <Error />`,
    `<input type="text" placeholder="Enter name" />`
];

testCases.forEach((code, i) => {
    console.log(`\n--- Test case ${i + 1}: ${code} ---`);
    
    try {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        console.log('Tokens generated:', tokens.length);
        
        tokens.forEach((token, j) => {
            console.log(`${j}: ${token.type} = "${token.value}"`);
        });
    } catch (error) {
        console.log('Tokenization error:', error.message);
    }
});