const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
# Mixing async/await, goroutines, and channels
async fn processStream<T>(input: Stream<T>) -> Result<Vec<T>, Error> {
  results := []
  ch := make(chan T, 100)
  
  // Spawn multiple workers
  for i := 0; i < 10; i++ {
    go async () => {
      while item := <-ch {
        processed := await transform(item)
        results.push(processed)
      }
    }()
  }
  
  // Feed the channel
  async for await (const item of input) {
    select {
      case ch <- item:
        continue
      default:
        await sleep(100)
    }
  }
  
  return Ok(results)
}
`;

console.log('Testing mixed async/concurrent patterns...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('✅ Parsed successfully!');
    console.log('AST body length:', ast.body.length);
    
    if (ast.body[0]) {
        const func = ast.body[0];
        console.log('\nFunction:');
        console.log('  Kind:', func.kind);
        console.log('  Name:', func.name?.name);
        console.log('  Async:', func.async);
        console.log('  Generic params:', func.genericParams?.length);
        
        if (func.genericParams) {
            console.log('  Generic param names:', func.genericParams.map(p => p.name));
        }
        
        console.log('  Params:', func.params?.length);
        if (func.params?.[0]) {
            const param = func.params[0];
            console.log('  Param name:', param.name?.name);
            console.log('  Param type:', param.type);
        }
        
        console.log('  Return type:', func.returnType);
        
        const body = func.body;
        if (body) {
            console.log('\nFunction body:');
            console.log('  Statements:', body.statements?.length || body.body?.length);
        }
    }
    
} catch (error) {
    console.error('\n❌ Parser error:', error.message);
    console.error('Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
}