const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Monkey-patch to trace the flow
const originalParsePostfix = Parser.prototype.parsePostfix;

Parser.prototype.parsePostfix = function(expr) {
    console.log(`[TRACE] parsePostfix called with expr.kind = ${expr.kind}`);
    if (expr._genericArgs) {
        console.log(`  expr has _genericArgs:`, expr._genericArgs.map(a => a.name));
    }
    
    const result = originalParsePostfix.call(this, expr);
    
    if (result.kind === 'Call' && result.genericArgs) {
        console.log(`  Result is Call with genericArgs:`, result.genericArgs.map(a => a.name));
    } else if (result.kind === 'Call') {
        console.log(`  Result is Call WITHOUT genericArgs`);
    }
    
    return result;
};

// Test generic function call
const code = `const result = source<Data>();`;

console.log('Testing generic flow...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\nFinal result:');
    const call = ast.body[0].values[0];
    console.log('Call.genericArgs:', call.genericArgs);
} catch (e) {
    console.log('Parse error:', e.message);
}