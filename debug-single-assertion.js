const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `const assertion = <Type>value;`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
  const ast = parser.parse();
  console.log('AST:', JSON.stringify(ast, null, 2).substring(0, 500));
} catch (e) {
  console.log('Parse error:', e.message);
  console.log('At token:', parser.peek());
}
