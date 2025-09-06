const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
async fn test() {
  async for await (const item of input) {
    x := 1
  }
  return Ok(x)
}
`;

console.log('Testing simplified async for with return...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    console.log('All tokens:');
    tokens.forEach((t, i) => {
        if (t.type !== 'EOF') {
            const marker = t.type === 'VirtualSemi' ? '  [VSEMI]' : 
                          t.type === 'NEWLINE' ? '  [NL]' :
                          `  ${t.type}: "${t.value}"`;
            console.log(`[${i}] ${marker}`);
        }
    });
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed');
    console.log('AST body:', ast.body.length);
    
    ast.body.forEach(item => {
        console.log(`  ${item.kind}`);
        if (item.kind === 'FuncDecl') {
            console.log('    Body statements:', item.body.statements?.length);
        }
    });
    
} catch (error) {
    console.error('\n❌ Error:', error.message);
}