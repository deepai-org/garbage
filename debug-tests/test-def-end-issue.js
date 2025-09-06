const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test the exact Ruby def...end pattern from failing test
const code = `
def render_list(items)
    <ul>
        {items.each do |item|
            <li>{item.name}</li>
        end}
    </ul>
end`;

console.log('Testing Ruby def...end with JSX content...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST body length:', ast.body.length);
ast.body.forEach((node, i) => {
    console.log(`[${i}]: ${node.kind}`);
    if (node.kind === 'FuncDecl') {
        console.log(`  Name: ${node.name.name}`);
        console.log(`  Body statements: ${node.body.statements.length}`);
    } else if (node.kind === 'ExprStmt') {
        console.log(`  Expression: ${node.expr.kind}`);
        if (node.expr.kind === 'Identifier') {
            console.log(`    Name: ${node.expr.name}`);
        }
    }
});

// Look for the "end" token position in the code
console.log('\nToken analysis:');
const endTokens = [];
tokens.forEach((t, i) => {
    if (t.value === 'end') {
        endTokens.push({ index: i, line: t.line, column: t.column });
    }
});
console.log('End tokens found:', endTokens);