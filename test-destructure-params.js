const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const testCases = [
    'function foo(a) { return a }',
    'function foo({ a }) { return a }',
    'function foo({ a }: any) { return a }',
    'function foo({ a, b }: ButtonProps) { return a }'
];

testCases.forEach(code => {
    console.log('\nCode:', code);
    
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    
    try {
        const ast = parser.parse();
        console.log('  ✓ Parsed successfully, body length:', ast.body.length);
        if (ast.body[0]) {
            const func = ast.body[0];
            console.log('    Function:', func.name?.name, 'params:', func.params?.length);
        }
    } catch (error) {
        console.log('  ✗ Parse error:', error.message);
    }
});