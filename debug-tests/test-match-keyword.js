const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `match x {
  Some(v) => v
}`;

console.log('Testing match keyword recognition...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('First 3 tokens:');
tokens.slice(0, 3).forEach((t, i) => {
    console.log(`[${i}] "${t.value}" (${t.type})`);
});

const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\nParsed as:', ast.body[0]?.kind);
} catch (e) {
    console.log('\nParse error:', e.message);
}