const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Inject detailed parseBlock debugging
const originalParseBlock = Parser.prototype.parseBlock;
let blockDepth = 0;
Parser.prototype.parseBlock = function() {
    blockDepth++;
    const indent = '  '.repeat(blockDepth);
    const curr = this.peek();
    console.log(`${indent}parseBlock #${blockDepth} starts at: ${curr?.value} (${curr?.type})`);
    
    const result = originalParseBlock.call(this);
    console.log(`${indent}parseBlock #${blockDepth} got ${result.statements?.length || 0} statements`);
    blockDepth--;
    return result;
};

// Test the problematic structure
const code = `async fn test() {
  for i := 0; i < 10; i++ {
    go async () => {
      x := 1
    }()
  }
  
  async for await (const item of input) {
    select {
      case ch <- item:
        continue
      default:
        await sleep(100)
    }
  }
  
  return Ok(results)
}`;

console.log('Debugging parseBlock for async for...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed');
    
    const func = ast.body[0];
    if (func?.kind === 'FuncDecl') {
        const asyncFor = func.body.statements?.find(s => s.kind === 'Loop' && s.await);
        if (asyncFor) {
            console.log('\nAsync for body:', asyncFor.body?.statements?.length, 'statements');
            if (asyncFor.body?.statements?.length === 0) {
                console.log('⚠️ BUG: Empty async for body!');
            }
        }
    }
    
} catch (error) {
    console.error('\n❌ Error:', error.message);
}