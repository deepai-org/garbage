const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Minimal case that might reproduce the issue
const code = `
async function test() {
  try {
    while [ $x -lt 3 ]; do
      try:
        pass
      except:
        pass
      done
  } catch (e) {
    throw e
  }
}`;

console.log('Testing minimal case...');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
console.log('Tokens:', tokens.length);

// Track parseTopLevel calls
let parseCount = 0;
const parser = new Parser(tokens);

// Hook into parseTopLevel to track calls
const originalMethod = parser.parseTopLevel;
parser.parseTopLevel = function() {
  parseCount++;
  if (parseCount > 50) {
    console.log(`Too many parseTopLevel calls (${parseCount})`);
    console.log(`Current position: ${this.current}`);
    console.log(`Current token: ${this.peek()?.value}`);
    console.log(`braceDepth: ${this.braceDepth}`);
    process.exit(1);
  }
  return originalMethod.call(this);
};

const timeout = setTimeout(() => {
  console.log('TIMEOUT!');
  console.log(`parseTopLevel called ${parseCount} times`);
  process.exit(1);
}, 2000);

try {
  const ast = parser.parse();
  clearTimeout(timeout);
  console.log('✅ Success! AST nodes:', ast.body.length);
  console.log(`parseTopLevel called ${parseCount} times`);
} catch (e) {
  clearTimeout(timeout);
  console.log('❌ Error:', e.message);
}