const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `fn test() {
  match x {
    Some(Ok(vec)) => {
      Box::new(vec)
    }
    _ => Box::new(0)
  }
}`;

console.log('Testing simplified match...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

const ast = parser.parse();
console.log('AST body count:', ast.body.length);

if (ast.body[0]?.kind === 'FuncDecl') {
    const func = ast.body[0];
    console.log('Function body statements:', func.body?.statements?.length);
    const match = func.body?.statements?.[0];
    if (match?.kind === 'Match') {
        console.log('Match arms:', match.arms?.length);
    }
}

console.log('Parser errors:', parser.errors.length);
if (parser.errors.length > 0) {
    parser.errors.forEach(err => {
        console.log('Error:', err.message);
    });
}