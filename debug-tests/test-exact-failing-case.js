const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// The EXACT code from the failing test
const code = `
const result = condition ? <Success /> : <Error />`;

console.log('Testing EXACT failing test case...\n');
console.log('Code:', JSON.stringify(code));

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    console.log('Tokens:');
    tokens.forEach((t, i) => {
        if (t.type !== 'EOF') {
            console.log(`[${i}] "${t.value}" (${t.type}) ${t.virtualSemi ? '[VS]' : ''}`);
        }
    });
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log(`\nAST body count: ${ast.body.length}`);
    console.log(`Parser errors: ${parser.errors.length}`);
    
    if (parser.errors.length > 0) {
        parser.errors.forEach((err, i) => {
            console.log(`Error ${i + 1}: ${err.message}`);
        });
    }
    
    if (ast.body.length > 0) {
        const stmt = ast.body[0];
        console.log(`\nFirst statement: ${stmt.kind}`);
        
        if (stmt.kind === 'ConstDecl') {
            console.log(`  Const name: ${stmt.names[0]?.name}`);
            console.log(`  Has values: ${!!stmt.values}`);
            console.log(`  Values length: ${stmt.values?.length}`);
            
            if (stmt.values && stmt.values[0]) {
                const value = stmt.values[0];
                console.log(`  Value kind: ${value.kind}`);
                
                if (value.kind === 'Ternary') {
                    console.log(`    Test: ${value.test?.kind}`);
                    console.log(`    Consequent: ${value.consequent?.kind}`);  
                    console.log(`    Alternate: ${value.alternate?.kind}`);
                }
            }
        }
    }
    
} catch (e) {
    console.log(`Parse error: ${e.message}`);
    console.log(`Stack:`, e.stack);
}