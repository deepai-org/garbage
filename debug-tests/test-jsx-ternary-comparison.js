const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Compare different JSX ternary cases
const tests = [
    'true ? <Success /> : <Error />',                    // This worked before
    'condition ? <Success /> : <Error />',               // This should be the same
    '<Success />',                                       // Simple JSX - should work
];

tests.forEach((code, i) => {
    console.log(`\n=== Test ${i + 1}: ${code} ===`);
    
    try {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        console.log(`Result: ${ast.body.length > 0 && parser.errors.length === 0 ? '✓ SUCCESS' : '✗ FAILED'}`);
        console.log(`AST body count: ${ast.body.length}`);
        console.log(`Parser errors: ${parser.errors.length}`);
        
        if (parser.errors.length > 0) {
            parser.errors.forEach(err => console.log(`Error: ${err.message}`));
        } else if (ast.body[0] && ast.body[0].kind === 'ExprStmt') {
            console.log(`Expression: ${ast.body[0].expr?.kind}`);
        }
        
    } catch (e) {
        console.log(`Parse error: ${e.message}`);
    }
});