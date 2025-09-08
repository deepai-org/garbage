const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `// This is a comment
class Foo {
  /* Multi-line
     comment */
  x: number; // inline comment
}`;

console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nTokens:');
tokens.forEach((t, i) => {
  const type = t.type.padEnd(12);
  const value = JSON.stringify(t.value.substring(0, 20)).padEnd(22);
  console.log(`  ${i}: ${type} ${value}`);
});

console.log('\nComment tokens found:', tokens.filter(t => t.type === 'Comment').length);

try {
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  const astStr = JSON.stringify(ast);
  const hasComments = astStr.includes('comment') || astStr.includes('Comment');
  
  console.log('\nComments preserved in AST:', hasComments ? 'YES' : 'NO');
} catch (e) {
  console.error('Error:', e.message);
}