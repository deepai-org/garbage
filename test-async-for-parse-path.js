const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Inject debugging into Parser
const originalParseLoop = Parser.prototype.parseLoop;
Parser.prototype.parseLoop = function() {
    console.log('\n=== parseLoop called ===');
    console.log('Previous token:', this.previous());
    console.log('Current token:', this.peek());
    console.log('Next token:', this.peekNext());
    
    const result = originalParseLoop.call(this);
    console.log('Loop result mode:', result.mode);
    console.log('Loop await:', result.await);
    console.log('Loop body statements:', result.body?.statements?.length);
    return result;
};

const code = `fn test() {
  async for await (const item of input) {
    select {
      case x:
        continue
    }
  }
}`;

console.log('Testing async for parse path...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed');
    const func = ast.body[0];
    if (func.body?.statements?.[0]?.kind === 'Loop') {
        const loop = func.body.statements[0];
        console.log('\nFinal loop:');
        console.log('  mode:', loop.mode);
        console.log('  await:', loop.await);
        console.log('  body statements:', loop.body?.statements?.length);
    }
} catch (error) {
    console.error('\n❌ Error:', error.message);
}