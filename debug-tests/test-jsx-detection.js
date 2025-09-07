const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Monkey patch to debug isJSXElement method
const originalConsoleLog = console.log;

console.log('=== Debug JSX element detection ===');

const code = `condition ? <div /> : 2`;
console.log('Testing:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Let's manually walk through the tokens to simulate what the parser sees
console.log('\nTokens:');
tokens.forEach((token, i) => {
    console.log(`  ${i}: ${token.type} = "${token.value}"`);
});

console.log('\nSimulating parser at position where it sees < (token 2):');
console.log('Current token (2):', tokens[2]); // <
console.log('Next token (3):', tokens[3]);    // div
console.log('Token after (4):', tokens[4]);   // /
console.log('Token after (5):', tokens[5]);   // >

// The parser should be at position 2 (pointing to <) when checking for JSX
// isJSXElement() will advance through the tokens to check patterns

console.log('\nWhat isJSXElement should see:');
console.log('- Sees < (should match)');
console.log('- Advances, sees "div" (identifier, should be valid)'); 
console.log('- "div" is HTML tag (should return true)');
console.log('- OR "div" starts with lowercase (should check isHTMLTag)');