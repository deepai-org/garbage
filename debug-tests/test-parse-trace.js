const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Monkey patch to trace parsing
const originalParseTopLevel = Parser.prototype.parseTopLevel;
Parser.prototype.parseTopLevel = function() {
    console.log(`[TRACE] parseTopLevel at position ${this.current}: "${this.peek()?.value}"`);
    try {
        const result = originalParseTopLevel.call(this);
        console.log(`[TRACE] parseTopLevel returned: ${result?.kind}`);
        return result;
    } catch (e) {
        console.log(`[TRACE] parseTopLevel error: ${e.message}`);
        throw e;
    }
};

const originalParseDeclaration = Parser.prototype.parseDeclaration;
Parser.prototype.parseDeclaration = function() {
    console.log(`[TRACE] parseDeclaration at position ${this.current}: "${this.peek()?.value}"`);
    const result = originalParseDeclaration.call(this);
    console.log(`[TRACE] parseDeclaration returned: ${result?.kind}`);
    return result;
};

// Test
const code = `fn deepNest<T, U, V>(x: Option<Result<Vec<(T, U)>, Error>>) -> Box<dyn Future<Item = V>> {}`;

console.log('Testing with trace...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\nFinal AST:');
    console.log('Body length:', ast.body.length);
    if (ast.body[0]) {
        console.log('First node kind:', ast.body[0].kind);
    }
} catch (e) {
    console.log('\nParse failed:', e.message);
}