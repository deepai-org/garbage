const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
const Component = () => {
    return <span>{<-ch}</span>;
};
`;

console.log('Testing channel receive in JSX...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    console.log('Tokens in JSX expression:');
    let inExpr = false;
    tokens.forEach((t, i) => {
        if (t.type === 'LBRACE' && i > 0 && tokens[i-1].type === 'GT') {
            inExpr = true;
        }
        if (inExpr) {
            console.log(`  [${i}] ${t.type}: "${t.value}"`);
        }
        if (inExpr && t.type === 'RBRACE') {
            inExpr = false;
        }
    });
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed successfully!');
    console.log('Result:', JSON.stringify(ast, null, 2));
    
} catch (error) {
    console.error('\n❌ Parser error:', error.message);
    console.error('At position:', error.current);
}