const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

console.log('=== Debug JSX expression wrapping ===');

const code = `<input type="text" placeholder="Enter name" />`;
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST body length:', ast.body.length);
if (ast.body.length > 0) {
    const stmt = ast.body[0];
    console.log('First statement kind:', stmt.kind);
    console.log('Has expr property:', 'expr' in stmt);
    
    if (stmt.kind === 'ExprStmt') {
        console.log('Expression kind:', stmt.expr?.kind);
        console.log('Expression structure:', JSON.stringify(stmt.expr, null, 2));
    } else {
        console.log('Full statement structure:', JSON.stringify(stmt, null, 2));
    }
}