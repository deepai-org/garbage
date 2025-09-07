const { Lexer } = require('./dist/lexer');
const { LexerContext } = require('./dist/lexer-context');

// Trace exactly what happens
const code = `<Component<Props> />`;
console.log('Code:', code);

// Manual trace of what should happen:
console.log('\n--- Manual trace ---');
console.log('1. See "<" at position 0');
console.log('2. Next char is "C" (uppercase)');
console.log('3. Peek identifier: "Component"');
console.log('4. Char after identifier (pos 10): "<"');
console.log('5. Look past generic params...');
console.log('6. Position after generics (pos 17): " "');
console.log('7. Space indicates JSX, should enter JSX mode');

console.log('\n--- Actual lexer behavior ---');
const lexer = new Lexer(code);

// Monkey-patch to trace
const originalEnterJSX = lexer.context.enterJSX;
lexer.context.enterJSX = function() {
  console.log('!!! enterJSX called');
  return originalEnterJSX.call(this);
};

const tokens = lexer.tokenize();
console.log('\nFirst 5 tokens:');
tokens.slice(0, 5).forEach((t, i) => {
  console.log(`  [${i}] ${t.type}: "${t.value}"`);
});