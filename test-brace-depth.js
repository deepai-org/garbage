const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Full exact code
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

console.log('Analyzing brace structure...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

let depth = 0;
console.log('Brace depth analysis:');
tokens.forEach((t, i) => {
    if (t.value === '{') {
        console.log(`  [${i}] { depth: ${depth} -> ${depth+1}`);
        depth++;
    }
    if (t.value === '}') {
        depth--;
        console.log(`  [${i}] } depth: ${depth+1} -> ${depth}`);
        if (depth === 0) {
            console.log('    ^ Function should end here');
            // Check next few tokens
            console.log('    Next tokens:');
            for (let j = i+1; j < Math.min(i+5, tokens.length); j++) {
                if (tokens[j].type !== 'EOF' && tokens[j].type !== 'NEWLINE') {
                    console.log(`      [${j}] ${tokens[j].type}: "${tokens[j].value}"`);
                }
            }
        }
    }
    if (t.value === 'return') {
        console.log(`  [${i}] return at depth: ${depth}`);
    }
});