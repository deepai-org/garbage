const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test JSX in assignment vs ternary
const tests = [
    'x = <Component />',           // Should work (assignment)
    'condition ? <Success />',     // Should work (ternary)
    '<Component />',               // Should work (statement)
];

tests.forEach((code, i) => {
    console.log(`\n=== Test ${i + 1}: ${code} ===`);
    
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log(`AST body count: ${ast.body.length}`);
    console.log(`Parser errors: ${parser.errors.length}`);
    
    if (parser.errors.length > 0) {
        parser.errors.forEach(err => {
            console.log(`Error: ${err.message}`);
        });
    } else if (ast.body[0]) {
        console.log(`First statement: ${ast.body[0].kind}`);
        if (ast.body[0].kind === 'ExprStmt') {
            console.log(`Expression: ${ast.body[0].expr?.kind}`);
        }
    }
});