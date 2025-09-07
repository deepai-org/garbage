const { Lexer } = require('../dist/lexer');

const code = `const result = condition ? <Success /> : <Error />`;

console.log('Testing tokens for JSX in ternary...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('All tokens:');
tokens.forEach((t, i) => {
    console.log(`[${i}] "${t.value}" (${t.type}) ${t.virtualSemi ? '[VIRTUAL_SEMI]' : ''}`);
});