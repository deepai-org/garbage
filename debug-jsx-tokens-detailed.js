const { Lexer } = require('./dist/lexer');

const code = `<Component<Props> data={items} />`;

console.log('Testing JSX tokenization...\n');
console.log('Code:', code, '\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('All tokens:');
tokens.forEach((t, i) => {
  console.log(`  [${i}] ${t.type}: "${t.value}"`);
});

// Check for JSX-specific token types
const hasJSXTokens = tokens.some(t => t.type.startsWith('JSX'));
console.log('\nHas JSX token types:', hasJSXTokens);