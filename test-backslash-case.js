const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test case with backslash in case statement
const code = `
switch (x) {
  case '\\\\': break;
  case 'n': break;
}
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
  if (t.type !== 'VirtualSemi' && t.type !== 'EOF') {
    console.log(`  [${i}] ${t.type}: "${t.value}"`);
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  - ${e.message} at token "${e.token?.value}"`);
  });
}

if (ast.body.length > 0 && ast.body[0].kind === 'Switch') {
  console.log('\\nSwitch cases:');
  ast.body[0].cases.forEach((c, i) => {
    console.log(`  Case ${i}: patterns =`, c.patterns.map(p => p.value || p.name));
  });
}