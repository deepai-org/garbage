const { Lexer } = require('../dist/lexer');

const code = `case $option in
  "start")`;

console.log('Testing case pattern tokenization...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

tokens.forEach((t, i) => {
    if (t.type !== 'WHITESPACE') {
        console.log(`[${i}] "${t.value}" (${t.type})`);
    }
});