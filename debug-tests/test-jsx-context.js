const { Lexer } = require('../dist/lexer');

const code = `x = <Component>content</Component>`;

console.log('Testing JSX in assignment context...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

tokens.forEach((t, i) => {
    if (t.type !== 'WHITESPACE' && t.type !== 'EOF') {
        console.log(`  [${i}] "${t.value}" (${t.type})`);
    }
});