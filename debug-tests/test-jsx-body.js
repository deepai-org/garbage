const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// The Ruby def...end test that's now creating 2 body items
const code = `
def render_list(items)
    <ul>
        {items.each do |item|
            <li>{item.name}</li>
        end}
    </ul>
end`;

console.log('Testing Ruby def...end with JSX...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST body length:', ast.body.length);
ast.body.forEach((node, i) => {
    console.log(`[${i}]: ${node.kind}`);
    if (node.kind === 'FuncDecl') {
        console.log(`  Name: ${node.name.name}`);
    } else if (node.kind === 'ExprStmt') {
        console.log(`  Expression: ${node.expr.kind} - ${node.expr.name || ''}`);
    }
});