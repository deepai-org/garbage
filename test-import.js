const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test import statements
const code = `
import { Token, TokenType } from './lexer';
import * as AST from './ast';

class Test {
  private field: Token;
}
`;

console.log('Testing import statements:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nTokens for first import:');
for (let i = 0; i < 15; i++) {
  const t = tokens[i];
  if (t.type !== 'EOF') {
    console.log(`  [${i}] ${t.type}:${t.value || '(undefined)'}`);
  }
}

const parser = new Parser(tokens);
const ast = parser.parse();

console.log(`\nParsed ${ast.body.length} top-level nodes`);
ast.body.forEach((node, i) => {
  console.log(`  ${i}: ${node.kind}`);
});

console.log(`\nParse errors: ${parser.errors.length}`);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  ${e.message}`);
  });
}