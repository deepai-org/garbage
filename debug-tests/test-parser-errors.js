const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

console.log('=== Debug parser errors ===');

// Set debug environment variable
process.env.DEBUG_PARSER = 'true';

const code = `condition ? <div /> : 2`;
console.log('Testing:', code);

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('AST body length:', ast.body.length);
    console.log('Parser errors:', parser.errors?.length || 'no errors property');
    
    // Try to access errors if they exist
    if (parser.errors && parser.errors.length > 0) {
        console.log('Errors found:');
        parser.errors.forEach((err, i) => {
            console.log(`  ${i}: ${err.message}`);
        });
    }
    
} catch (error) {
    console.log('Uncaught error:', error.message);
    console.log('Stack:', error.stack);
}