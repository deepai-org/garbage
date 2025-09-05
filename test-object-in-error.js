const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test object literal in error recovery context
const code = `
function test() {
  try {
    doSomething();
  } catch (error) {
    this.errors.push({
      kind: "ParseError",
      message: error.message,
      token: this.peek()
    });
  }
}
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Show tokens in the catch block
console.log('=== Tokens in catch block ===');
let inCatch = false;
let braceDepth = 0;
tokens.forEach((t, i) => {
  if (t.value === 'catch') {
    inCatch = true;
    console.log('\nFound catch at token', i);
  }
  if (inCatch) {
    if (t.value === '{') {
      if (braceDepth === 0) {
        console.log('\nTokens in catch body:');
      }
      braceDepth++;
    }
    if (braceDepth > 0 && t.type !== 'VirtualSemi' && t.type !== 'EOF') {
      console.log(`  [${i}] ${t.type}:${t.value}`);
    }
    if (t.value === '}') {
      braceDepth--;
      if (braceDepth === 0) {
        inCatch = false;
      }
    }
  }
});

const parser = new Parser(tokens);

try {
  const ast = parser.parse();
  console.log(`\n=== Parse Results ===`);
  console.log(`AST nodes: ${ast.body.length}`);
  console.log(`Parse errors: ${parser.errors.length}`);
  
  if (parser.errors.length > 0) {
    parser.errors.forEach(e => {
      console.log(`  - ${e.message}`);
    });
  }
} catch (e) {
  console.log(`\nParse failed: ${e.message}`);
}