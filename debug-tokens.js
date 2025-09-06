const { Lexer } = require('./dist/lexer');

const code = `const assertion = <Type>value;`;

console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nTokens:');
tokens.forEach((t, i) => {
  if (t.type !== 'EOF') {
    console.log(`[${i}]: ${t.type}:${t.value}`);
  }
});
