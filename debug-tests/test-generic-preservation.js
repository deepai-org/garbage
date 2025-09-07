const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// More detailed patch
const originalParsePostfix = Parser.prototype.parsePostfix;

Parser.prototype.parsePostfix = function(expr) {
    console.log(`\n[TRACE] parsePostfix START`);
    console.log(`  expr.kind = ${expr.kind}, expr.name = ${expr.name}`);
    console.log(`  Current token: "${this.peek()?.value}"`);
    
    // Check if generic args parsing happens
    if (this.check("<") && !this.check("<-") && !this.check("<<") && !this.check("<=")) {
        console.log(`  Detected potential generic args at position ${this.current}`);
        const checkpoint = this.current;
        const genericArgs = this.tryParseGenericArgs();
        
        if (genericArgs) {
            console.log(`  Parsed generic args:`, genericArgs.map(a => a.name));
            expr._genericArgs = genericArgs;
            console.log(`  Set _genericArgs on expr`);
        } else {
            console.log(`  No generic args found, restoring position`);
            this.current = checkpoint;
        }
    }
    
    // Now continue with the original logic
    const origFunc = originalParsePostfix.toString();
    // We need to skip the first part that we just did
    const skipFirstGenericCheck = true;
    
    // Call the rest of the original function
    // This is tricky - we'll just call the original and trace the result
    const result = originalParsePostfix.call(this, expr);
    
    console.log(`  Result: kind=${result.kind}`);
    if (result.kind === 'Call') {
        console.log(`    Has genericArgs: ${!!result.genericArgs}`);
    }
    
    return result;
};

// Test
const code = `const result = source<Data>();`;

console.log('Testing...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
} catch (e) {
    console.log('Parse error:', e.message);
}