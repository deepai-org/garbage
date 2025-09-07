const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test ternary progression
const tests = [
    'true ? 1 : 2',                    // Simple ternary - should work
    'true ? <Success /> : <Error />', // JSX ternary - target test
];

tests.forEach((code, i) => {
    console.log(`\n=== Test ${i + 1}: "${code}" ===`);
    
    try {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        console.log(`✓ Parsed successfully`);
        console.log(`  AST body count: ${ast.body.length}`);
        console.log(`  Parser errors: ${parser.errors.length}`);
        
        if (ast.body.length > 0 && ast.body[0].kind === 'ExprStmt') {
            const expr = ast.body[0].expr;
            console.log(`  Expression kind: ${expr?.kind}`);
            if (expr?.kind === 'Ternary') {
                console.log(`    Test: ${expr.test?.kind}`);
                console.log(`    Consequent: ${expr.consequent?.kind}`);
                console.log(`    Alternate: ${expr.alternate?.kind}`);
            }
        }
        
        if (parser.errors.length > 0) {
            parser.errors.forEach(err => console.log(`  Error: ${err.message}`));
        }
    } catch (e) {
        console.log(`✗ Parse failed: ${e.message}`);
    }
});