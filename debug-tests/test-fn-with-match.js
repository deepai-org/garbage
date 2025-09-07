const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `fn test() {
  match x {
    Some(v) => v
    None => 0
  }
}`;

console.log('Testing match inside function...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('Function body statements:', ast.body[0]?.body?.statements?.length);
    const matchStmt = ast.body[0]?.body?.statements?.[0];
    if (matchStmt) {
        console.log('Statement kind:', matchStmt.kind);
        if (matchStmt.kind === 'Match') {
            console.log('Match arms:', matchStmt.arms?.length);
        }
    }
} catch (e) {
    console.log('Parse error:', e.message);
}