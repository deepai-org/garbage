const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test defer and using
const code = `function ResourceManager() {
    using file = openFile("data.txt")
    defer console.log("Cleanup")
    
    return <Status>Processing...</Status>
}`;

console.log('Testing defer and using statements...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Key tokens:');
tokens.forEach((t, i) => {
    if (t.value === 'using' || t.value === 'defer' || t.value === 'file' || 
        t.value === 'openFile' || t.value === '=' || t.value === 'console') {
        console.log(`[${i}] "${t.value}" (${t.type})`);
    }
});

const parser = new Parser(tokens);
try {
    const ast = parser.parse();
    console.log('\nParse result:');
    console.log('AST body length:', ast.body.length);
    
    const func = ast.body[0];
    if (func && func.kind === 'FuncDecl') {
        console.log('Function:', func.name.name);
        console.log('Body statements:', func.body.statements.length);
        
        func.body.statements.forEach((stmt, i) => {
            console.log(`  [${i}]: ${stmt.kind}`);
            if (stmt.kind === 'Using') {
                console.log(`       Variable: ${stmt.id?.name || '?'}`);
            } else if (stmt.kind === 'Defer') {
                console.log(`       Has defer statement`);
            } else if (stmt.kind === 'ExprStmt') {
                console.log(`       Expression: ${stmt.expr.kind}`);
            }
        });
    }
} catch (e) {
    console.log('Parse error:', e.message);
    console.log('Stack:', e.stack);
}