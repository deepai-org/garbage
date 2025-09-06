const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test to understand generic vs comparison parsing
const tests = [
    {
        name: "Comparison",
        code: `a < b`
    },
    {
        name: "Generic type",
        code: `Array<string>`
    },
    {
        name: "Statement vs expression",
        code: `let x: Array<string>;`
    },
    {
        name: "Type in expression position",
        code: `type T = Array<string>`
    }
];

tests.forEach(test => {
    console.log(`\n=== ${test.name} ===`);
    console.log(`Code: ${test.code}`);
    
    try {
        const lexer = new Lexer(test.code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        console.log('AST nodes:', ast.body.length);
        if (ast.body.length > 0) {
            const node = ast.body[0];
            console.log('First node:', node.kind);
            
            if (node.kind === 'ExprStmt') {
                console.log('  Expression:', node.expr.kind);
                if (node.expr.kind === 'Binary') {
                    console.log('    Op:', node.expr.op);
                    console.log('    Left:', node.expr.left?.name || node.expr.left?.kind);
                    console.log('    Right:', node.expr.right?.name || node.expr.right?.kind);
                }
            } else if (node.kind === 'TypeAlias') {
                console.log('  Name:', node.name.name);
                console.log('  Type:', node.type?.kind);
            } else if (node.kind === 'VarDecl') {
                console.log('  Name:', node.names[0]?.name);
                console.log('  Type:', node.type?.kind);
            }
        }
    } catch (e) {
        console.log('❌ Error:', e.message);
    }
});