const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test defer statement
const code = `function test() {
    defer console.log("cleanup")
    return 42
}`;

console.log('Testing defer statement parsing...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    const func = ast.body[0];
    console.log('Function:', func.name.name);
    console.log('Body statements:', func.body.statements.length);
    
    func.body.statements.forEach((stmt, i) => {
        console.log(`  [${i}]: ${stmt.kind}`);
    });
} catch (e) {
    console.log('Parse error:', e.message);
}