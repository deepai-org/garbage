const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test just the type parsing part
const code = `chan<JSX.Element>`;

console.log('Testing parseType for:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nTokens:');
tokens.forEach((t, i) => {
    if (t.type !== 'EOF') {
        console.log(`  [${i}] ${t.type}: "${t.value}"`);
    }
});

// Create a parser and manually call parseType
const parser = new Parser(tokens);

// Access internal method - this is hacky but for debugging
parser.current = 0;
parser.tokens = tokens;

try {
    // Manually invoke parseType
    const typeNode = parser.parseType();
    
    console.log('\nParsed type node:');
    console.log('  Kind:', typeNode.kind);
    if (typeNode.kind === 'GenericType') {
        console.log('  Base:', typeNode.base);
        console.log('  Args:', typeNode.args);
    }
    
} catch (error) {
    console.error('\nError:', error.message);
}