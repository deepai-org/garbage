const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Remove comments to see if they affect parsing
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

console.log('Testing exact code without comments...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('AST body:', ast.body.length);
    
    if (ast.body.length > 1) {
        console.log('⚠️ ISSUE: Multiple top-level items!');
        
        // Check where async for ends
        const func = ast.body[0];
        if (func.kind === 'FuncDecl' && func.body.statements) {
            const lastStmt = func.body.statements[func.body.statements.length - 1];
            console.log('\nLast statement in function:', lastStmt.kind);
            if (lastStmt.kind === 'Loop') {
                console.log('  Loop mode:', lastStmt.mode);
                console.log('  Loop body:', lastStmt.body?.kind);
                if (lastStmt.body?.statements) {
                    console.log('  Statements in loop body:', lastStmt.body.statements.length);
                    // Check if body is empty
                    if (lastStmt.body.statements.length === 0) {
                        console.log('  ⚠️ Loop body is EMPTY!');
                    }
                }
            }
        }
    }
    
} catch (error) {
    console.error('Error:', error.message);
}