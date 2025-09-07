const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test theory that the issue is with identifier parsing before the JSX
const tests = [
    'true ? <Success />',                // Works (from previous test)
    'condition ? <Success />',           // Should fail based on theory 
    'x ? <Success />',                   // Test simpler identifier
    'foo ? <Success />',                 // Test another identifier
    'condition',                         // Just the identifier alone
    'condition ?',                       // Identifier + question mark
];

tests.forEach((code, i) => {
    console.log(`\n=== Test ${i + 1}: ${code} ===`);
    
    try {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        const success = ast.body.length > 0 && parser.errors.length === 0;
        console.log(`Result: ${success ? '✓' : '✗'}`);
        
        if (!success) {
            console.log(`Errors: ${parser.errors.length}`);
            parser.errors.forEach(err => console.log(`  ${err.message}`));
        }
        
    } catch (e) {
        console.log(`✗ Exception: ${e.message}`);
    }
});