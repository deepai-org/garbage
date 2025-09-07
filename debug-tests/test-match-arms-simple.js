const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `match x {
  Some(v) => v
  None => 0
}`;

console.log('Testing simple match with two arms...\n');

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
    console.log('\nAST body count:', ast.body.length);
    ast.body.forEach((node, i) => {
        console.log(`Body[${i}]: ${node.kind}`);
        if (node.kind === 'Match' && node.arms) {
            console.log(`  Arms: ${node.arms.length}`);
        }
    });
} catch (e) {
    console.log('\nParse error:', e.message);
}