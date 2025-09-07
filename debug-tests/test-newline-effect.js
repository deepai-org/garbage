const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test with and without leading newline
const tests = [
    'const result = condition ? <Success /> : <Error />', // No newline
    '\nconst result = condition ? <Success /> : <Error />' // With newline (failing case)
];

tests.forEach((code, i) => {
    console.log(`\n=== Test ${i + 1}: ${i === 0 ? 'No newline' : 'With newline'} ===`);
    
    try {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        console.log(`AST body count: ${ast.body.length}`);
        console.log(`Parser errors: ${parser.errors.length}`);
        
        if (parser.errors.length > 0) {
            parser.errors.forEach(err => console.log(`Error: ${err.message}`));
        } else if (ast.body[0] && ast.body[0].kind === 'ConstDecl') {
            const stmt = ast.body[0];
            console.log(`✓ Const declaration parsed`);
            console.log(`  Values: ${stmt.values?.length || 0}`);
            if (stmt.values && stmt.values[0]) {
                console.log(`  Value kind: ${stmt.values[0].kind}`);
            }
        }
        
    } catch (e) {
        console.log(`Parse error: ${e.message}`);
    }
});