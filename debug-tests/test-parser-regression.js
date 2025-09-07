const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

console.log('=== Debug parser step by step ===');

const code = `const result = condition ? <Success /> : <Error />`;
console.log('Parsing:', code);

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    console.log('Tokens created:', tokens.length);
    
    const parser = new Parser(tokens);
    console.log('Parser created successfully');
    
    const ast = parser.parse();
    console.log('AST created:', ast ? 'success' : 'failed');
    console.log('AST body length:', ast.body.length);
    
    if (ast.body.length > 0) {
        console.log('First statement:', JSON.stringify(ast.body[0], null, 2));
    }
} catch (error) {
    console.log('Error during parsing:', error.message);
    console.log('Stack trace:', error.stack);
}

console.log('\n=== Testing simple JSX ===');
const simpleJSX = `<div />`;
try {
    const lexer2 = new Lexer(simpleJSX);
    const tokens2 = lexer2.tokenize();
    const parser2 = new Parser(tokens2);
    const ast2 = parser2.parse();
    console.log('Simple JSX AST body length:', ast2.body.length);
    if (ast2.body.length > 0) {
        console.log('Simple JSX statement:', JSON.stringify(ast2.body[0], null, 2));
    }
} catch (error) {
    console.log('Simple JSX error:', error.message);
}