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
  
  return Ok(results)
}
`;

console.log('Testing async for await with return...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    // Find select block tokens
    console.log('Key tokens:');
    tokens.forEach((t, i) => {
        if (t.value === 'select' || t.value === 'case' || t.value === 'default' || 
            t.value === 'return' || t.value === '}' || t.value === '{') {
            console.log(`  [${i}] ${t.type}: "${t.value}"`);
        }
    });
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed successfully!');
    console.log('AST body length:', ast.body.length);
    
    const func = ast.body[0];
    if (func.kind === 'FuncDecl') {
        console.log('\nFunction body statements:', func.body.statements?.length);
        func.body.statements?.forEach((stmt, i) => {
            console.log(`  Statement ${i}: ${stmt.kind}`);
            if (stmt.kind === 'Loop') {
                console.log('    Loop body:', stmt.body?.kind);
                if (stmt.body?.statements) {
                    console.log('    Statements in loop:', stmt.body.statements.length);
                }
            }
        });
    }
    
} catch (error) {
    console.error('\n❌ Parser error:', error.message);
}