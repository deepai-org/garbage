const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `<Component<Props> />`;

console.log('Testing JSX continuation check...\n');
console.log('Code:', code, '\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('All tokens:');
tokens.forEach((t, i) => {
  console.log(`  [${i}] ${t.type}: "${t.value}"`);
});

// Now manually trace what isValidJSXContinuation would do
console.log('\n--- Manual trace of isValidJSXContinuation ---');
console.log('Start at token 0 (JSXTagStart)');
console.log('Advance to token 1 (Component)');
console.log('Advance to token 2 (<)');
console.log('Token 2 is "<", entering generic handling');
console.log('Would consume tokens 2-4 for generic <Props>');
console.log('After generics, at token 5:', tokens[5].type, '"' + tokens[5].value + '"');
console.log('Token 5 is StringLiteral (whitespace), not a valid JSX pattern');
console.log('Should check token 6 instead:', tokens[6].type, '"' + tokens[6].value + '"');