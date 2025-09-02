const { Parser } = require('./dist/parser');
const { Lexer } = require('./dist/lexer');

// Test the full async function that's failing
const code = `# Mixing async/await, goroutines, and channels
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
        await sleep(100ms)
    }
  }
  
  return Ok(results)
}`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Total tokens:', tokens.length);

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parser errors:', parser.errors.length);
if (parser.errors.length > 0) {
  console.log('First error:', parser.errors[0].message);
  console.log('Error token:', parser.errors[0].token);
}
console.log('AST body length:', ast.body.length);