const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
async fn test() {
  x := 1
  return Ok(x)
}
`;

console.log('Testing return in function...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    console.log('Tokens:');
    tokens.forEach((t, i) => {
        if (t.type !== 'EOF' && t.type !== 'NEWLINE' && t.type !== 'VirtualSemi') {
            console.log(`  [${i}] ${t.type}: "${t.value}"`);
        }
        if (t.type === 'VirtualSemi') {
            console.log(`  [${i}] VIRTUAL SEMICOLON`);
        }
    });
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed successfully!');
    console.log('AST body length:', ast.body.length);
    
    ast.body.forEach((item, i) => {
        console.log(`\nItem ${i}:`, item.kind);
        if (item.kind === 'FuncDecl') {
            console.log('  Function body statements:', item.body.statements?.length);
        }
    });
    
} catch (error) {
    console.error('\n❌ Parser error:', error.message);
}