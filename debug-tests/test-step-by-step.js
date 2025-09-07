const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test step by step
const tests = [
    'condition',              // Should work
    'condition ?',            // Should work (incomplete ternary)  
    '<Success />',            // Should work (standalone JSX)
    'true ? <Success />',     // Should work but might fail
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
        
        if (parser.errors.length > 0) {
            parser.errors.forEach(err => console.log(`  Error: ${err.message}`));
        }
    } catch (e) {
        console.log(`✗ Parse failed: ${e.message}`);
    }
});