const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test simpler function body
const code = `function test() {
    using file = openFile("data.txt")
    return 42
}`;

console.log('Testing function body parsing...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('All tokens:');
tokens.forEach((t, i) => {
    console.log(`[${i}] "${t.value}" (${t.type})`);
});

const parser = new Parser(tokens);
try {
    const ast = parser.parse();
    console.log('\nParse result:');
    const func = ast.body[0];
    if (func && func.kind === 'FuncDecl') {
        console.log('Function:', func.name.name);
        console.log('Body kind:', func.body.kind);
        console.log('Body statements:', func.body.statements.length);
        
        if (func.body.statements.length === 0) {
            console.log('\n⚠️ Empty body! Checking parse flow...');
        } else {
            func.body.statements.forEach((stmt, i) => {
                console.log(`  [${i}]: ${stmt.kind}`);
            });
        }
    }
} catch (e) {
    console.log('Parse error:', e.message);
}