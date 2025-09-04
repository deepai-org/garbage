const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Function with complex return type
const code = `
def decorated_func(param1: str) -> Result[str, Error]:
  pass
`;

console.log('Testing function with return type:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens after parameters:');
let foundClose = false;
tokens.forEach((t, i) => {
  if (t.value === ')') {
    foundClose = true;
  }
  if (foundClose && i < tokens.indexOf(tokens.find(t => t.value === ')')) + 10) {
    if (t.type !== 'VirtualSemi' && t.type !== 'EOF') {
      console.log(`  [${i}] ${t.type}:${t.value}`);
    }
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
} else {
  console.log('Success!');
  if (ast.body.length > 0) {
    const func = ast.body[0];
    console.log('Function:', { 
      kind: func.kind, 
      name: func.name?.name
    });
  }
}