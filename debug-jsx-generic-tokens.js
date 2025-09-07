const { Lexer } = require('./dist/lexer');

const code = `const element = <Component<Props> data={items}></Component>;`;

console.log('Testing JSX generic tokenization...\n');
console.log('Code:', code, '\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('All tokens:');
tokens.forEach((t, i) => {
  console.log(`  [${i}] ${t.type}: "${t.value}"`);
});

console.log('\nLooking for JSX-specific tokens:');
const jsxTokens = tokens.filter(t => 
  t.type.startsWith('JSX') || 
  t.value === '<' || 
  t.value === '>' ||
  t.value === '</' ||
  t.value === '/>'
);
console.log('Found:', jsxTokens.length, 'JSX-related tokens');
jsxTokens.forEach(t => console.log(`  ${t.type}: "${t.value}"`));