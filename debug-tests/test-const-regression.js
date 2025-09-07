const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

console.log('=== Debug const declaration structure ===');

const code1 = `const result = condition ? <Success /> : <Error />`;
const lexer1 = new Lexer(code1);
const tokens1 = lexer1.tokenize();
const parser1 = new Parser(tokens1);
const ast1 = parser1.parse();

console.log('AST body length:', ast1.body.length);
if (ast1.body.length > 0) {
    const stmt = ast1.body[0];
    console.log('First statement kind:', stmt.kind);
    console.log('First statement structure:', JSON.stringify(stmt, null, 2));
    
    if (stmt.kind === 'ConstDecl') {
        console.log('Has values property:', 'values' in stmt);
        console.log('Values:', stmt.values);
    }
}