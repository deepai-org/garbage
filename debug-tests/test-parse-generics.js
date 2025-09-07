const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Patch parseType to see where error happens
const originalParseType = Parser.prototype.parseType;
Parser.prototype.parseType = function() {
    const token = this.peek();
    console.log(`[parseType] at ${this.current}: "${token?.value}"`);
    try {
        const result = originalParseType.call(this);
        console.log(`[parseType] success, next token: "${this.peek()?.value}"`);
        return result;
    } catch (e) {
        console.log(`[parseType] ERROR: ${e.message}`);
        throw e;
    }
};

// Test the full signature with return type
const code = `fn deepNest<T, U, V>(x: Option<Result<Vec<(T, U)>, Error>>) -> Box<dyn Future<Item = V>> {}`;

console.log('Testing full signature with return type...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Show relevant tokens
console.log('Relevant tokens:');
for (let i = 10; i < 28 && i < tokens.length; i++) {
    console.log(`[${i}] "${tokens[i].value}"`);
}

console.log('\nParsing...\n');

const parser = new Parser(tokens);
try {
    const ast = parser.parse();
    console.log('\nSuccess!');
} catch (e) {
    console.log('\nFailed:', e.message);
}