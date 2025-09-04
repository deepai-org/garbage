const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// The actual pattern from parser.ts that's failing
const code = `
class Parser {
  parse() {
    while (!this.isAtEnd()) {
      try {
        const item = this.parseTopLevel();
        if (item) {
          body.push(item);
        }
      } catch (error) {
        if (error instanceof ParseError) {
          this.errors.push(error);
        } else {
          throw error;
        }
      }
    }
  }
}`;

console.log('Testing the problematic pattern:\n');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Show tokens around the catch block
console.log('Tokens around catch:');
let foundCatch = false;
tokens.forEach((t, i) => {
  if (t.value === 'catch') {
    foundCatch = true;
    console.log('\n--- CATCH BLOCK ---');
  }
  if (foundCatch && i < tokens.indexOf(tokens.find(t => t.value === 'catch')) + 20) {
    if (t.type !== 'VirtualSemi' && t.type !== 'EOF') {
      console.log(`  [${i}] ${t.type}:${t.value}`);
    }
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nParse errors:', parser.errors.length);
parser.errors.forEach(e => {
  console.log(`  Line ${e.token.line}: ${e.message} at token '${e.token.value}'`);
});