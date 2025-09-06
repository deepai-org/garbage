const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `def render_list(items)
    puts "hello"
end`;

console.log('Testing simple def...end...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens around def/end:');
tokens.forEach((t, i) => {
    if (['def', 'render_list', '(', ')', 'puts', 'end'].includes(t.value)) {
        console.log(`[${i}] "${t.value}" (${t.type})`);
    }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nAST body length:', ast.body.length);
ast.body.forEach((node, i) => {
    console.log(`[${i}]: ${node.kind}`);
    if (node.kind === 'FuncDecl') {
        console.log(`  Name: ${node.name.name}`);
        console.log(`  Body statements: ${node.body.statements.length}`);
    } else if (node.kind === 'ExprStmt') {
        console.log(`  Expression: ${node.expr.kind} - ${node.expr.name || ''}`);
    }
});