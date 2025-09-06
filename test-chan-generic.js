const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `const ch = make(chan<JSX.Element>)`;

console.log('Testing generic channel type...\n');
console.log('Code:', code);

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    console.log('\nTokens:');
    tokens.forEach((t, i) => {
        if (t.type !== 'EOF') {
            console.log(`  [${i}] ${t.type}: "${t.value}"`);
        }
    });
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed successfully!');
    const decl = ast.body[0];
    console.log('Declaration:', JSON.stringify(decl, null, 2));
    
} catch (error) {
    console.error('\n❌ Parser error:', error.message);
    console.error('At token:', error.current);
}