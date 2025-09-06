const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
async fn test() {
  async for await (const item of input) {
    select {
      case ch <- item:
        continue
      default:
        await sleep(100)
    }
  }
  return Ok(x)
}
`;

console.log('Testing select in async for...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('✅ Parsed');
    console.log('AST body:', ast.body.length);
    
    ast.body.forEach(item => {
        console.log(`  ${item.kind}`);
        if (item.kind === 'FuncDecl') {
            const stmts = item.body.statements;
            console.log('    Function body statements:', stmts?.length);
            stmts?.forEach((s, i) => {
                console.log(`      ${i}: ${s.kind}`);
            });
        }
    });
    
} catch (error) {
    console.error('\n❌ Error:', error.message);
    
    // Try to find where it fails
    const lexer2 = new Lexer(code);
    const tokens2 = lexer2.tokenize();
    console.log('\nTokens around select:');
    tokens2.forEach((t, i) => {
        if (i >= 15 && i <= 40) {
            console.log(`  [${i}] ${t.type}: "${t.value}"`);
        }
    });
}