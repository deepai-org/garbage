const { Lexer } = require('./dist/lexer');

const code = `make(chan int, 10)`;

console.log('Testing channel type lexing...\n');
console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nTokens:');
tokens.forEach((t, i) => {
    if (t.type !== 'EOF') {
        console.log(`  [${i}] ${t.type}: "${t.value}"`);
    }
});