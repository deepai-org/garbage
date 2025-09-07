const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test generic function call
const code = `const result = source<Data>();`;

console.log('Testing generic function call...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
    console.log(`[${i}] "${t.value}" (${t.type})`);
});

const parser = new Parser(tokens);
try {
    const ast = parser.parse();
    console.log('\nParse successful!');
    
    // Look for the Call node
    const varDecl = ast.body[0];
    if (varDecl && varDecl.kind === 'VarDecl') {
        const value = varDecl.values[0];
        console.log('Value kind:', value.kind);
        if (value.kind === 'Call') {
            console.log('  Callee:', value.callee.name);
            console.log('  Args:', value.args.length);
            console.log('  GenericArgs:', value.genericArgs);
        }
    }
} catch (e) {
    console.log('Parse error:', e.message);
}