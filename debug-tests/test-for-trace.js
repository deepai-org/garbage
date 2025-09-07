const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Monkey patch to trace parsing
const originalParseLoop = Parser.prototype.parseLoop;
Parser.prototype.parseLoop = function() {
    const token = this.peek();
    console.log(`[parseLoop] at ${this.current}: "${token?.value}" (${token?.type})`);
    const result = originalParseLoop.call(this);
    console.log(`[parseLoop] returned mode: ${result?.mode}`);
    return result;
};

const code = `for (a, b) in vec { }`;

console.log('Testing with trace...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\nAST body length:', ast.body.length);
    if (ast.body[0]) {
        console.log('First node:', ast.body[0].kind);
    }
} catch (e) {
    console.log('\nParse error:', e.message);
}