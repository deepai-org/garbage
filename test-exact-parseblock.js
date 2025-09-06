const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Inject detailed parseBlock debugging
const originalParseBlock = Parser.prototype.parseBlock;
let blockDepth = 0;
let blockCount = 0;
Parser.prototype.parseBlock = function() {
    blockDepth++;
    blockCount++;
    const blockId = blockCount;
    const indent = '  '.repeat(blockDepth);
    const curr = this.peek();
    const next = this.peekNext();
    console.log(`${indent}parseBlock #${blockId} at depth ${blockDepth}:`);
    console.log(`${indent}  Current: ${curr?.value} (${curr?.type})`);
    console.log(`${indent}  Next: ${next?.value}`);
    
    const result = originalParseBlock.call(this);
    console.log(`${indent}parseBlock #${blockId} result: ${result.statements?.length || 0} statements`);
    blockDepth--;
    return result;
};

// EXACT failing code
const code = `async fn processStream<T>(input: Stream<T>) -> Result<Vec<T>, Error> {
  results := []
  ch := make(chan T, 100)
  
  for i := 0; i < 10; i++ {
    go async () => {
      while item := <-ch {
        processed := await transform(item)
        results.push(processed)
      }
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

console.log('Debugging parseBlock for EXACT failing code...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed');
    console.log('AST body:', ast.body.length);
    
    if (ast.body.length > 1) {
        console.log('⚠️ Return outside function!');
    }
    
} catch (error) {
    console.error('\n❌ Error:', error.message);
}