const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `{items.each do |item|
    <li>{item.name}</li>
end}`;

console.log('Testing JSX with Ruby block...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
    if (t.type !== 'EOF' && t.type !== 'VirtualSemi') {
        console.log(`[${i}] "${t.value}" (${t.type})`);
    }
});

try {
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\nAST body length:', ast.body.length);
    ast.body.forEach((node, i) => {
        console.log(`[${i}]: ${node.kind}`);
    });
} catch (e) {
    console.log('\n❌ Parse error:', e.message);
}