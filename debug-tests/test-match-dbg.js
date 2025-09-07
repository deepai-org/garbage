const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Simpler version to debug
const code = `fn test() {
  match x {
    a => { b }
    _ => c
  }
}`;

console.log('Testing match with debug...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('All tokens:');
tokens.forEach((t, i) => {
    if (t.type !== 'WHITESPACE') {
        console.log(`[${i}] "${t.value}" (${t.type})${t.virtualSemi ? ' [virtualSemi]' : ''}`);
    }
});

// Manually trace through what should happen
console.log('\n--- Manual trace ---');
console.log('1. Parse fn test()');
console.log('2. Parse { body }');
console.log('3. Parse match x {');
console.log('4. Parse first arm: a => { b }');
console.log('5. After { b }, should see closing } at token 12');
console.log('6. Skip virtual semicolon at token 13');
console.log('7. Should see _ at token 14');
console.log('8. Parse second arm: _ => c');

const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\n--- Actual result ---');
    console.log('Top-level nodes:', ast.body.length);
    
    if (ast.body[0]?.kind === 'FuncDecl') {
        const func = ast.body[0];
        console.log('Function statements:', func.body?.statements?.length);
        const match = func.body?.statements?.[0];
        if (match?.kind === 'Match') {
            console.log('Match arms:', match.arms?.length);
        }
    }
    
    if (ast.body[1]) {
        console.log('ERROR: Second top-level node:', ast.body[1].kind);
    }
} catch (e) {
    console.log('Parse error:', e.message);
}