const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Monkey patch to trace parsing
const originalParseLoop = Parser.prototype.parseLoop;
Parser.prototype.parseLoop = function() {
    const token = this.peek();
    console.log(`[parseLoop] Starting at ${this.current}: "${token?.value}"`);
    
    // Add checkpoints
    const originalConsume = this.consume;
    this.consume = function(expected, message) {
        console.log(`  [consume] expecting "${expected}", current: "${this.peek()?.value}"`);
        return originalConsume.call(this, expected, message);
    };
    
    const originalMatch = this.match;
    this.match = function(...values) {
        const result = originalMatch.call(this, ...values);
        if (result) {
            console.log(`  [match] matched "${this.previous()?.value}"`);
        }
        return result;
    };
    
    try {
        const result = originalParseLoop.call(this);
        console.log(`[parseLoop] SUCCESS - mode: ${result?.mode}`);
        return result;
    } catch (e) {
        console.log(`[parseLoop] ERROR: ${e.message}`);
        throw e;
    }
};

const code = `for (a, b) in vec { }`;

console.log('Testing with detailed trace...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\nAST body length:', ast.body.length);
} catch (e) {
    console.log('\nParse error:', e.message);
}