const { Lexer } = require('./dist/lexer');

// Test simple @ tokenization
const code = `@decorator`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens for "@decorator":');
tokens.forEach((t, i) => {
  if (t.type !== 'EOF') {
    console.log(`  [${i}] ${t.type}: "${t.value}"`);
  }
});

// Test multiple decorators
const code2 = `
@log_calls
@inject(Database)
class Test {}
`;

const lexer2 = new Lexer(code2);
const tokens2 = lexer2.tokenize();

console.log('\nTokens for decorators on class:');
tokens2.forEach((t, i) => {
  if (t.type !== 'EOF' && t.type !== 'VirtualSemi') {
    console.log(`  [${i}] ${t.type}: "${t.value}"`);
  }
});