const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
function test() {
  begin
    x := 1
  end
}`;

console.log('Testing function with begin/end...');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
console.log('Total tokens:', tokens.length);

// Find key positions
for (let i = 0; i < tokens.length; i++) {
  const t = tokens[i];
  if (t.value === 'function' || t.value === '{' || t.value === 'begin' || 
      t.value === 'end' || t.value === '}') {
    console.log(`Position ${i}: ${t.value}`);
  }
}

const parser = new Parser(tokens);

// Track parse() iterations
let parseIterations = 0;
const originalParse = parser.parse.bind(parser);
parser.parse = function() {
  const originalParseTopLevel = this.parseTopLevel.bind(this);
  this.parseTopLevel = function() {
    parseIterations++;
    console.log(`[${parseIterations}] parseTopLevel at position ${this.current}, token: ${this.peek()?.value}`);
    if (parseIterations > 20) {
      console.log('Too many iterations!');
      process.exit(1);
    }
    return originalParseTopLevel();
  };
  
  return originalParse();
};

try {
  const ast = parser.parse();
  console.log('✅ Success! AST nodes:', ast.body.length);
  console.log('Total parseTopLevel calls:', parseIterations);
} catch (e) {
  console.log('❌ Error:', e.message);
}