const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Monkey-patch to trace parsing
const originalTryParseGenericArgs = Parser.prototype.tryParseGenericArgs;
let callCount = 0;

Parser.prototype.tryParseGenericArgs = function() {
    callCount++;
    console.log(`[TRACE] tryParseGenericArgs called #${callCount} at position ${this.current}`);
    console.log(`  Current token: "${this.tokens[this.current]?.value}"`);
    const result = originalTryParseGenericArgs.call(this);
    console.log(`  Result:`, result ? `Found ${result.length} args` : 'null');
    return result;
};

// Test generic function call
const code = `const result = source<Data>();`;

console.log('Testing with trace...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\nParse result:');
    const call = ast.body[0].values[0];
    console.log('Call has genericArgs:', !!call.genericArgs);
} catch (e) {
    console.log('Parse error:', e.message);
}