const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `match x {
  Some(v) => Box::new(v)
  None => 0
}`;

console.log('Testing match with :: in body...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('AST body count:', ast.body.length);
    ast.body.forEach((node, i) => {
        console.log(`Body[${i}]: ${node.kind}`);
        if (node.kind === 'Match' && node.arms) {
            console.log(`  Arms: ${node.arms.length}`);
        }
    });
} catch (e) {
    console.log('Parse error:', e.message);
}