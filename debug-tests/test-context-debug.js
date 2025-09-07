const { Lexer } = require('../dist/lexer');

// Create a custom lexer class to expose context
class DebugLexer extends Lexer {
    getContext() {
        return this.context;
    }
}

const code = `x = <Component>`;

console.log('Testing context after each token...\n');

const lexer = new DebugLexer(code);

// Manually step through to see context changes
lexer.position = 0;
const tokens = [];

// Get first token
while (!lexer.isAtEnd()) {
    const token = lexer.scanToken();
    if (token) {
        tokens.push(token);
        console.log(`Token: "${token.value}" (${token.type})`);
        console.log(`Context canBeJSX: ${lexer.getContext().canBeJSX()}`);
        console.log(`Context canBeGeneric: ${lexer.getContext().canBeGeneric()}`);
        console.log('---');
    }
}