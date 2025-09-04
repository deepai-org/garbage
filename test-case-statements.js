const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test case statements
const code = `
switch (keyword) {
  case "case": return "esac";
  case "begin": return "end";
  case "if": return "fi";
  case "for": 
    console.log("for");
    return "done";
  default: 
    return keyword;
}
`;

console.log('Testing case statements:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  console.log('Errors:');
  parser.errors.forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}' (line ${e.token.line})`);
  });
} else {
  console.log('Success!');
}