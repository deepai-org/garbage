const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test the problematic case with detailed tracing
const code = `def render_list(items)
    <ul>
        {items.each do |item|
            <li>{item.name}</li>
        end}
    </ul>
end`;

console.log('Testing def parsing with JSX and Ruby blocks...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Show all tokens
console.log('All tokens:');
tokens.forEach((t, i) => {
    if (t.value === 'do' || t.value === 'end' || t.value === 'def') {
        console.log(`[${i}] "${t.value}" (${t.type}) - KEYWORD`);
    } else if (i < 10 || i > tokens.length - 10) {
        console.log(`[${i}] "${t.value}" (${t.type})`);
    }
});

console.log('\n\nParsing...');
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('Parse successful!');
    console.log('AST body:', ast.body.length);
    
    ast.body.forEach((node, i) => {
        console.log(`[${i}]: ${node.kind}`);
        if (node.kind === 'FuncDecl') {
            console.log(`      Name: ${node.name.name}`);
            console.log(`      Body statements: ${node.body.statements.length}`);
        } else if (node.kind === 'ExprStmt' && node.expr.kind === 'Identifier') {
            console.log(`      Identifier: ${node.expr.name}`);
        }
    });
} catch (e) {
    console.log('Parse error:', e.message);
    console.log('Stack:', e.stack);
}