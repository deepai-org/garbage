const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test escaped characters in case statements
const code = `
switch (ch) {
  case '\\n':
    return "newline";
  case '\\t':
    return "tab";
  case '\\'':
    return "quote";
  case '\\\\'':
    return "backslash";
}
`;

console.log('Testing escaped characters in case statements:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Show tokens for case statements
let inCase = false;
tokens.forEach((t, i) => {
  if (t.value === 'case') inCase = true;
  if (inCase && t.type === 'StringLiteral') {
    console.log(`  Case value: "${t.value}"`);
    inCase = false;
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  console.log('Errors:');
  parser.errors.forEach(e => {
    console.log(`  ${e.message}`);
  });
} else {
  console.log('Success!');
}