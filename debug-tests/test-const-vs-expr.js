const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test expression vs const declaration context
const tests = [
    'condition ? <Success /> : <Error />',          // Expression statement - should work
    'const result = condition ? "a" : "b"',          // Const with simple ternary - should work  
    'const result = condition ? <Success /> : <Error />'  // Const with JSX ternary - failing
];

tests.forEach((code, i) => {
    console.log(`\n=== Test ${i + 1}: ${code} ===`);
    
    try {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        console.log(`AST body count: ${ast.body.length}`);
        console.log(`Parser errors: ${parser.errors.length}`);
        
        if (parser.errors.length > 0) {
            parser.errors.forEach(err => console.log(`Error: ${err.message}`));
        } else if (ast.body[0]) {
            const stmt = ast.body[0];
            console.log(`✓ Statement: ${stmt.kind}`);
            
            if (stmt.kind === 'ExprStmt') {
                console.log(`  Expression: ${stmt.expr?.kind}`);
            } else if (stmt.kind === 'ConstDecl') {
                console.log(`  Values: ${stmt.values?.length || 0}`);
                if (stmt.values && stmt.values[0]) {
                    console.log(`  Value: ${stmt.values[0].kind}`);
                }
            }
        }
        
    } catch (e) {
        console.log(`Parse error: ${e.message}`);
    }
});