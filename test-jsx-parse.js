const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const testCases = [
    'const list = <List<string> items={["a", "b", "c"]} />',
    '<>Hello World</>',
    '<Component />',
    '<div>content</div>'
];

testCases.forEach((code, i) => {
    console.log(`\nTest ${i + 1}: ${code.substring(0, 50)}...`);
    try {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        console.log(`  ✓ Parsed successfully, AST nodes: ${ast.body.length}`);
        if (ast.body.length > 0) {
            const node = ast.body[0];
            console.log(`    First node kind: ${node.kind}`);
        }
    } catch (error) {
        console.log(`  ✗ Parse error: ${error.message}`);
    }
});