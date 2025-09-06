const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Override consume to log what it's doing
const originalConsume = Parser.prototype.consume;
Parser.prototype.consume = function(expected, message) {
    const current = this.peek();
    if (current?.value === '{' || expected === '{') {
        console.log(`  consume("${expected}"): current token is "${current?.value}"`);
    }
    try {
        return originalConsume.call(this, expected, message);
    } catch (error) {
        if (current?.value === '{' || expected === '{') {
            console.log(`  consume ERROR: ${error.message}`);
        }
        throw error;
    }
};

const code = `fn test() {
  async for await (const item of input) {
    select {
      case x:
        continue
    }
  }
}`;

console.log('Testing consume issue...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed');
} catch (error) {
    console.error('\n❌ Error:', error.message);
}