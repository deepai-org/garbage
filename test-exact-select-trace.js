const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Trace parseStatement when it sees select
const originalParseStatement = Parser.prototype.parseStatement;
Parser.prototype.parseStatement = function() {
    const token = this.peek();
    const prev = this.previous();
    if (token?.value === 'select') {
        console.log(`\nparseStatement at select:`);
        console.log(`  Previous: ${prev?.value}`);
        console.log(`  Current: ${token?.value}`);
        console.log(`  Next: ${this.peekNext()?.value}`);
        console.log(`  Position: ${this.current}`);
    }
    const result = originalParseStatement.call(this);
    if (token?.value === 'select') {
        console.log(`  Result: ${result?.kind || 'null'}`);
    }
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

console.log('Tracing select in EXACT failing code...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    // Find select token position
    let selectPos = -1;
    tokens.forEach((t, i) => {
        if (t.value === 'select' && selectPos === -1) {
            selectPos = i;
        }
    });
    console.log('Select token is at position:', selectPos);
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed');
    console.log('AST body:', ast.body.length);
    
    if (ast.body[0]?.kind === 'FuncDecl') {
        const func = ast.body[0];
        const asyncFor = func.body.statements?.find(s => s.kind === 'Loop' && s.await);
        if (asyncFor) {
            console.log('\nAsync for body statements:', asyncFor.body?.statements?.length);
            if (asyncFor.body?.statements?.length === 0) {
                console.log('⚠️ BUG: Empty async for body - select was not parsed!');
            }
        }
    }
    
} catch (error) {
    console.error('\n❌ Error:', error.message);
}