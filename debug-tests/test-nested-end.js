const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test different Ruby def patterns to understand the issue
const tests = [
    {
        name: "Simple def...end",
        code: `def foo
  puts "hello"
end`
    },
    {
        name: "def with nested block",
        code: `def foo
  items.each do |item|
    puts item
  end
end`
    },
    {
        name: "def with JSX and nested Ruby block (failing case)",
        code: `def render_list(items)
    <ul>
        {items.each do |item|
            <li>{item.name}</li>
        end}
    </ul>
end`
    }
];

tests.forEach(test => {
    console.log(`\n=== ${test.name} ===`);
    
    try {
        const lexer = new Lexer(test.code);
        const tokens = lexer.tokenize();
        
        // Count and show 'end' tokens
        const endTokens = [];
        tokens.forEach((t, i) => {
            if (t.value === 'end') {
                endTokens.push({ index: i, line: t.line, column: t.column });
            }
        });
        console.log('End tokens found:', endTokens.length);
        endTokens.forEach(et => {
            console.log(`  - Token[${et.index}] at line ${et.line}, col ${et.column}`);
        });
        
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        console.log('\nAST body length:', ast.body.length);
        ast.body.forEach((node, i) => {
            console.log(`  [${i}]: ${node.kind}`);
            if (node.kind === 'FuncDecl') {
                console.log(`       Name: ${node.name.name}`);
            } else if (node.kind === 'ExprStmt' && node.expr.kind === 'Identifier') {
                console.log(`       Identifier: ${node.expr.name}`);
            }
        });
        
        if (ast.body.length > 1 && ast.body[ast.body.length - 1].kind === 'ExprStmt') {
            const lastNode = ast.body[ast.body.length - 1];
            if (lastNode.expr.kind === 'Identifier' && lastNode.expr.name === 'end') {
                console.log('\n⚠️  WARNING: Extra "end" statement detected!');
            }
        }
    } catch (e) {
        console.log('❌ Error:', e.message);
    }
});