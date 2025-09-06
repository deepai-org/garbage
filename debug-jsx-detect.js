const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test various JSX patterns
const testCases = [
    '<input />',
    '<div></div>',
    '<Button />',
    '<Form.Input />',
    'Array<T>',
    'x < 5'
];

for (const code of testCases) {
    console.log('\n=================');
    console.log('Code:', code);
    console.log('-----------------');
    
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    // Check first few tokens
    console.log('First tokens:');
    for (let i = 0; i < Math.min(5, tokens.length); i++) {
        if (tokens[i].type !== 'EOF') {
            console.log(`  [${i}] ${tokens[i].type}: "${tokens[i].value}"`);
        }
    }
    
    const parser = new Parser(tokens);
    try {
        const ast = parser.parse();
        if (ast.body.length > 0) {
            const first = ast.body[0];
            if (first.kind === 'ExprStmt' && first.expr) {
                console.log('Parsed as:', first.expr.kind);
            } else {
                console.log('Parsed as:', first.kind);
            }
        } else {
            console.log('No statements parsed');
        }
    } catch (e) {
        console.log('Parse error:', e.message);
    }
}