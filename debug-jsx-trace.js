const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Simple test without attributes first
console.log('=== Test 1: Simple JSX ===');
let code = '<input />';
let lexer = new Lexer(code);
let tokens = lexer.tokenize();
console.log('Code:', code);
console.log('Tokens:', tokens.slice(0, -1).map(t => `${t.type}:${t.value}`).join(' '));

let parser = new Parser(tokens);
let ast = parser.parse();
console.log('AST body length:', ast.body.length);
if (ast.body.length > 0) {
    console.log('Parsed as:', ast.body[0].expr?.kind);
}

// Now with attributes
console.log('\n=== Test 2: JSX with attributes ===');
code = '<input type="text" />';
lexer = new Lexer(code);
tokens = lexer.tokenize();
console.log('Code:', code);
console.log('Tokens:', tokens.slice(0, -1).map(t => `${t.type}:${t.value}`).join(' '));

parser = new Parser(tokens);
ast = parser.parse();
console.log('AST body length:', ast.body.length);
if (ast.body.length > 0) {
    console.log('Parsed as:', ast.body[0].expr?.kind);
} else {
    // Try to understand why it's not parsing
    console.log('\nDebug: Checking if it would be detected as JSX...');
    
    // Simulate the check
    if (tokens[0].value === '<' && tokens[1].type === 'Identifier') {
        console.log('- Has < followed by identifier ✓');
        console.log('- Identifier is:', tokens[1].value);
        console.log('- Is HTML tag?', ['input', 'div', 'span'].includes(tokens[1].value));
    }
}