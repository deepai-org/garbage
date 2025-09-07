const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Monkey patch to trace parsing
const originalParseTopLevel = Parser.prototype.parseTopLevel;
Parser.prototype.parseTopLevel = function() {
    const token = this.peek();
    console.log(`[parseTopLevel] at position ${this.current}: "${token?.value}" (${token?.type})`);
    try {
        const result = originalParseTopLevel.call(this);
        console.log(`[parseTopLevel] returned: ${result?.kind}`);
        return result;
    } catch (e) {
        console.log(`[parseTopLevel] error: ${e.message}`);
        throw e;
    }
};

const originalParseDeclaration = Parser.prototype.parseDeclaration;
Parser.prototype.parseDeclaration = function() {
    const token = this.peek();
    console.log(`  [parseDeclaration] at position ${this.current}: "${token?.value}"`);
    const result = originalParseDeclaration.call(this);
    console.log(`  [parseDeclaration] returned: ${result?.kind}`);
    return result;
};

const originalParseFuncDecl = Parser.prototype.parseFuncDecl;
Parser.prototype.parseFuncDecl = function(async, unsafe, generator) {
    console.log(`    [parseFuncDecl] async=${async}, unsafe=${unsafe}, generator=${generator}`);
    const result = originalParseFuncDecl.call(this, async, unsafe, generator);
    console.log(`    [parseFuncDecl] returned function: ${result?.name?.name}`);
    return result;
};

// Test
const code = `fn deepNest<T, U, V>(x: Option<Result<Vec<(T, U)>, Error>>) -> Box<dyn Future<Item = V>> {}`;

console.log('Testing fn parsing with trace...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\nFinal AST:');
    console.log('Body length:', ast.body.length);
    if (ast.body[0]) {
        console.log('First node:', ast.body[0].kind);
    }
} catch (e) {
    console.log('\nParse failed:', e.message);
}