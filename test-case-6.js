
const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
# Reactive stream processing with mixed paradigms
class StreamProcessor {
  operators := []
  subscribers := new Set()
  
  # Operator chaining with pipeline operator
  def pipe(...ops):
    this.operators = [...this.operators, ...ops]
    return this
  
  # Ruby-style enumerable methods
  def map(&transform)
    this.operators.push({
      type: "map",
      fn: transform
    })
    return this
  end
  
  def filter(&predicate)
    begin
      this.operators.push({
        type: "filter",
        fn: predicate
      })
    ensure
      return this
    end
  end
  
  # Async generator for processing
  async process(source) {
    for await (const item of source) {
      value := item
      skip := false
      
      # Apply operators
      foreach op in this.operators do
        match op.type {
          "map" => value = await op.fn(value),
          "filter" => {
            if !await op.fn(value) {
              skip = true
              break
            }
          },
          "tap" => await op.fn(value),
          _ => throw new Error(\`Unknown operator: \${op.type}\`)
        }
      done
      
      if !skip {
        # Notify subscribers
        this.subscribers.forEach(sub => {
          go sub(value)
        })
        
        yield value
      }
    }
  }
  
  # Subscribe with automatic cleanup
  subscribe(handler: Function) {
    this.subscribers.add(handler)
    
    # Return unsubscribe function
    return () => {
      this.subscribers.delete(handler)
    }
  }
}

# Usage example
processor := new StreamProcessor()
  |> _.map(x => x * 2)
  |> _.filter(x => x > 10)
  |> _.map(async x => {
    result := await transform(x)
    return result
  })

# Process stream
async function* dataStream() {
  for i := 0; i < 100; i++ {
    yield i
    await sleep(100)
  }
}

# Subscribe and process
unsubscribe := processor.subscribe(value => {
  console.log("Received:", value)
})

go async () => {
  for await (const result of processor.process(dataStream())) {
    if result > 50 {
      break
    }
  }
  unsubscribe()
}()
`;

console.log('Testing: parses reactive stream processor');
console.log('Code length:', code.length);

const timeout = setTimeout(() => {
  console.log('TIMEOUT - Parser stuck!');
  process.exit(1);
}, 2000);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  clearTimeout(timeout);
  
  console.log(`Success! AST body length: ${ast.body.length}`);
} catch (e) {
  clearTimeout(timeout);
  console.log('Parse error:', e.message);
}
