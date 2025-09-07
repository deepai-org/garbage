const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Simplified version to debug
const code = `match x {
  a => { b }
  c => d
}`;

console.log('Testing match with block and non-block arms...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
    if (t.type !== 'WHITESPACE') {
        console.log(`[${i}] "${t.value}" (${t.type})${t.virtualSemi ? ' [virtualSemi]' : ''}`);
    }
});

const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    const match = ast.body[0];
    console.log('\nMatch statement:', match?.kind);
    console.log('Arms count:', match?.arms?.length);
    if (match?.arms) {
        match.arms.forEach((arm, i) => {
            console.log(`Arm ${i}: body kind = ${arm.body?.kind}`);
        });
    }
} catch (e) {
    console.log('\nParse error:', e.message);
}