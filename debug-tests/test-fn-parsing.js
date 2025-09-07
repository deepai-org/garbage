const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test simpler fn
const code1 = `fn simple() {}`;
const code2 = `fn withGenerics<T>() {}`;
const code3 = `fn withParams(x: number) {}`;
const code4 = `fn withGenAndParams<T>(x: T) {}`;

const testCodes = [
    { name: "Simple fn", code: code1 },
    { name: "fn with generics", code: code2 },
    { name: "fn with params", code: code3 },
    { name: "fn with generics and params", code: code4 }
];

testCodes.forEach(test => {
    console.log(`\n=== ${test.name} ===`);
    
    const lexer = new Lexer(test.code);
    const tokens = lexer.tokenize();
    
    console.log('Tokens:');
    tokens.forEach((t, i) => {
        if (i < 10) {
            console.log(`  [${i}] "${t.value}" (${t.type})`);
        }
    });
    
    const parser = new Parser(tokens);
    try {
        const ast = parser.parse();
        console.log('Result:');
        if (ast.body.length > 0) {
            const node = ast.body[0];
            console.log('  Kind:', node.kind);
            if (node.kind === 'FuncDecl') {
                console.log('  Name:', node.name.name);
            } else if (node.kind === 'ExprStmt') {
                console.log('  Expr kind:', node.expr.kind);
            }
        }
    } catch (e) {
        console.log('Error:', e.message);
    }
});