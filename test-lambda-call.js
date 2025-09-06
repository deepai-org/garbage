const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Simplified: just the go async lambda call followed by async for
const code = `fn test() {
  go async () => {
    x := 1
  }()
  
  async for await (const item of input) {
    y := 2
  }
  
  return Ok(x)
}`;

console.log('Testing go async lambda call before async for...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Show all tokens
console.log('All tokens:');
tokens.forEach((t, i) => {
    if (t.type !== 'EOF') {
        const marker = t.type === 'VirtualSemi' ? '[VSEMI]' : 
                      t.type === 'NEWLINE' ? '[NL]' :
                      `${t.type}: "${t.value}"`;
        console.log(`  [${i}] ${marker}`);
    }
});

try {
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed');
    console.log('AST body:', ast.body.length);
    
    if (ast.body.length > 1) {
        console.log('⚠️ Multiple top-level!');
        ast.body.forEach((item, i) => {
            console.log(`  ${i}: ${item.kind}`);
        });
    } else if (ast.body[0]?.kind === 'FuncDecl') {
        const func = ast.body[0];
        console.log('Function statements:', func.body.statements?.length);
        func.body.statements?.forEach((s, i) => {
            console.log(`  ${i}: ${s.kind}`);
        });
    }
    
} catch (error) {
    console.error('❌ Error:', error.message);
}