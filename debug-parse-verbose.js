const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `const assertion = <Type>value;`;

console.log('Parsing:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Add some debugging to parser
class DebugParser extends Parser {
  parseTopLevel() {
    console.log('parseTopLevel called');
    const result = super.parseTopLevel();
    console.log('parseTopLevel returned:', result);
    return result;
  }
}

const parser = new DebugParser(tokens);

try {
  const ast = parser.parse();
  console.log('Body length:', ast.body.length);
} catch (e) {
  console.log('Error:', e.message);
}
