const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test Ruby do...end blocks
const tests = [
    {
        name: "Simple function",
        code: `def foo
  puts "hello"
end`
    },
    {
        name: "Ruby do block",
        code: `users.each do |user|
  process(user)
end`
    },
    {
        name: "Function then identifier",
        code: `def foo
  puts "hello"
end
bar`
    }
];

tests.forEach(test => {
    console.log(`\n=== ${test.name} ===`);
    console.log(`Code:\n${test.code}\n`);
    
    try {
        const lexer = new Lexer(test.code);
        const tokens = lexer.tokenize();
        
        // Show tokens
        console.log('Tokens:');
        tokens.forEach((t, i) => {
            if (t.value === 'end' || t.value === 'bar' || t.value === 'def' || t.value === 'do') {
                console.log(`  [${i}] "${t.value}" (${t.type})`);
            }
        });
        
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        console.log('\nAST nodes:', ast.body.length);
        ast.body.forEach((node, i) => {
            console.log(`  [${i}]: ${node.kind}`);
            if (node.kind === 'FuncDecl') {
                console.log(`       Name: ${node.name.name}`);
            } else if (node.kind === 'ExprStmt') {
                console.log(`       Expr: ${node.expr.kind}`);
                if (node.expr.kind === 'Identifier') {
                    console.log(`       Name: ${node.expr.name}`);
                } else if (node.expr.kind === 'Call') {
                    console.log(`       Callee: ${node.expr.callee?.property?.name || node.expr.callee?.name}`);
                }
            }
        });
    } catch (e) {
        console.log('❌ Error:', e.message);
    }
});