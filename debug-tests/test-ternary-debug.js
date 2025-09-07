const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

console.log('=== Deep debug ternary JSX parsing ===');

const code = `condition ? <div /> : 2`;
console.log('Testing:', code);

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    console.log('All tokens:');
    tokens.forEach((token, i) => {
        console.log(`  ${i}: ${token.type} = "${token.value}"`);
    });
    
    // Now let's see what the parser does step by step
    const parser = new Parser(tokens);
    
    // Let's try parsing the expression manually
    console.log('\nParsing as expression...');
    const ast = parser.parse();
    console.log('Expression AST body length:', ast.body.length);
    
} catch (error) {
    console.log('Error:', error.message);
    console.log('Stack:', error.stack);
}