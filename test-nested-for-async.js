const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test with a regular for loop before async for
const code = `
fn test() {
  for i := 0; i < 10; i++ {
    x := 1
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
}
`;

console.log('Testing nested for loops with async for...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    // Find the async for tokens
    let asyncForIndex = -1;
    tokens.forEach((t, i) => {
        if (t.value === 'async' && tokens[i+1]?.value === 'for') {
            asyncForIndex = i;
        }
    });
    
    console.log('async for starts at token:', asyncForIndex);
    
    // Check tokens around async for
    console.log('\nTokens around async for:');
    for (let i = asyncForIndex - 2; i < Math.min(asyncForIndex + 20, tokens.length); i++) {
        const t = tokens[i];
        if (t && t.type !== 'EOF' && t.type !== 'NEWLINE') {
            const marker = t.type === 'VirtualSemi' ? '[VSEMI]' : `${t.type}: "${t.value}"`;
            const arrow = i === asyncForIndex ? ' <-- async' : '';
            console.log(`  [${i}] ${marker}${arrow}`);
        }
    }
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed successfully');
    console.log('AST body:', ast.body.length);
    
    if (ast.body[0]?.kind === 'FuncDecl') {
        const func = ast.body[0];
        const stmts = func.body.statements;
        console.log('\nFunction body statements:', stmts.length);
        stmts.forEach((s, i) => {
            console.log(`  ${i}: ${s.kind}`);
            if (s.kind === 'Loop') {
                console.log(`     mode: ${s.mode}, await: ${s.await}`);
                console.log(`     body statements: ${s.body?.statements?.length || 0}`);
            }
        });
    }
    
} catch (error) {
    console.error('\n❌ Parse error:', error.message);
}