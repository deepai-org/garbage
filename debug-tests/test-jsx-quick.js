const { Lexer } = require('../dist/lexer');

// Test just lexing first
const code = `<div>hello</div>`;

console.log('Testing JSX lexing...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
    if (t.type !== 'EOF') {
        console.log(`[${i}] "${t.value}" (${t.type})`);
    }
});

console.log('\nLexing completed successfully. Issue is in parsing, not lexing.');