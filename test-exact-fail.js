const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// EXACT code from failing test (no comments)
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

console.log('Testing EXACT failing code...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    // Find async for location
    let asyncForIndex = -1;
    tokens.forEach((t, i) => {
        if (t.value === 'async' && tokens[i+1]?.value === 'for' && i > 10) {
            asyncForIndex = i;
        }
    });
    
    console.log('async for at token:', asyncForIndex);
    
    // Check what comes before
    console.log('\nTokens before async for:');
    for (let i = asyncForIndex - 5; i < asyncForIndex; i++) {
        const t = tokens[i];
        if (t && t.type !== 'EOF') {
            const marker = t.type === 'VirtualSemi' ? '[VSEMI]' : 
                          t.type === 'NEWLINE' ? '[NL]' :
                          `${t.type}: "${t.value}"`;
            console.log(`  [${i}] ${marker}`);
        }
    }
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed');
    console.log('AST body:', ast.body.length);
    
    if (ast.body.length > 1) {
        console.log('⚠️ PROBLEM: Multiple top-level items!');
    }
    
    if (ast.body[0]?.kind === 'FuncDecl') {
        const func = ast.body[0];
        const stmts = func.body.statements;
        console.log('\nFunction statements:', stmts.length);
        stmts.forEach((s, i) => {
            console.log(`  ${i}: ${s.kind}`);
            if (s.kind === 'Loop' && s.mode === 'foreach') {
                console.log(`     async for body: ${s.body?.statements?.length || 0} statements`);
                if (s.body?.statements?.length === 0) {
                    console.log('     ⚠️ EMPTY BODY!');
                }
            }
        });
    }
    
} catch (error) {
    console.error('❌ Error:', error.message);
}