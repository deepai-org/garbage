const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
async fn processStream<T>() {
  results := []
  
  for i := 0; i < 10; i++ {
    go async () => {
      x := 1
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
}
`;

console.log('Testing double for loops...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('✅ Parsed');
    console.log('AST body:', ast.body.length);
    
    if (ast.body.length > 1) {
        console.log('⚠️ Multiple top-level items!');
    }
    
    ast.body.forEach((item, idx) => {
        console.log(`\n[${idx}] ${item.kind}`);
        if (item.kind === 'FuncDecl') {
            const stmts = item.body.statements;
            console.log('  Function body statements:', stmts?.length);
            stmts?.forEach((s, i) => {
                console.log(`    ${i}: ${s.kind}`);
                if (s.kind === 'Loop') {
                    console.log(`       mode: ${s.mode}`);
                }
            });
        }
    });
    
} catch (error) {
    console.error('\n❌ Error:', error.message);
}