const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Exact code from the test
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

console.log('Testing exact async/concurrent code...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    // Find the closing brace
    let braceCount = 0;
    let funcEndIndex = -1;
    tokens.forEach((t, i) => {
        if (t.value === '{') braceCount++;
        if (t.value === '}') {
            braceCount--;
            if (braceCount === 0 && funcEndIndex === -1) {
                funcEndIndex = i;
            }
        }
    });
    
    console.log('Function ends at token index:', funcEndIndex);
    console.log('Total tokens:', tokens.length);
    
    // Check tokens after function end
    console.log('\nTokens after function end:');
    for (let i = funcEndIndex; i < Math.min(funcEndIndex + 10, tokens.length); i++) {
        const t = tokens[i];
        if (t.type !== 'EOF' && t.type !== 'NEWLINE') {
            console.log(`  [${i}] ${t.type}: "${t.value}"`);
        }
    }
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed successfully!');
    console.log('AST body length:', ast.body.length);
    
    ast.body.forEach((item, i) => {
        console.log(`\nItem ${i}: ${item.kind}`);
        if (item.kind === 'FuncDecl') {
            const body = item.body;
            console.log('  Body statements:', body.statements?.length);
            
            // Check last statement
            if (body.statements?.length > 0) {
                const lastStmt = body.statements[body.statements.length - 1];
                console.log('  Last statement kind:', lastStmt.kind);
            }
        }
        if (item.kind === 'Return') {
            console.log('  ⚠️ Return statement outside function!');
        }
    });
    
} catch (error) {
    console.error('\n❌ Parser error:', error.message);
}