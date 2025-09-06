const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Full problematic structure
const code = `async fn processStream<T>(input: Stream<T>) -> Result<Vec<T>, Error> {
  for i := 0; i < 10; i++ {
    go async () => {
      while item := <-ch {
        x := 1
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

console.log('Testing complex async for structure...\n');

// Inject minimal debugging
const originalParseLoop = Parser.prototype.parseLoop;
let parseLoopCallCount = 0;
Parser.prototype.parseLoop = function() {
    parseLoopCallCount++;
    const prev = this.previous();
    const curr = this.peek();
    console.log(`\nparseLoop call #${parseLoopCallCount}:`);
    console.log(`  prev: ${prev?.value}, curr: ${curr?.value}`);
    
    const result = originalParseLoop.call(this);
    console.log(`  result: mode=${result.mode}, await=${result.await}, body=${result.body?.statements?.length} stmts`);
    return result;
};

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed');
    console.log('AST body:', ast.body.length);
    
    if (ast.body.length > 1) {
        console.log('⚠️ PROBLEM: Return statement outside function!');
        ast.body.forEach((item, i) => {
            console.log(`  ${i}: ${item.kind}`);
        });
    }
    
    if (ast.body[0]?.kind === 'FuncDecl') {
        const func = ast.body[0];
        console.log('\nFunction statements:', func.body.statements?.length);
        func.body.statements?.forEach((s, i) => {
            console.log(`  ${i}: ${s.kind}`);
            if (s.kind === 'Loop' && s.mode === 'foreach' && s.await) {
                console.log(`     ^ This is the async for await`);
                console.log(`     Body has ${s.body?.statements?.length || 0} statements`);
                if (s.body?.statements?.length === 0) {
                    console.log('     ⚠️ EMPTY BODY - THIS IS THE BUG!');
                }
            }
        });
    }
    
} catch (error) {
    console.error('\n❌ Error:', error.message);
}