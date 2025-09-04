const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test pipe operators
const code = `
function test() {
  begin
    processed := data
      |> validate
      |> transform
      |> enrich
    
    match processed {
      {status: "success", value} => results.push(value),
      {status: "error", reason} => errors.push(reason),
      _ => console.warn("Unknown")
    }
  rescue ProcessingError => e
    errors.push(e.message)
    retry if retries < 3
  end
}`;

console.log('Testing pipe and match...');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
console.log('Tokens:', tokens.length);

let parseCount = 0;
const parser = new Parser(tokens);

const originalMethod = parser.parseTopLevel;
parser.parseTopLevel = function() {
  parseCount++;
  if (parseCount > 100) {
    console.log(`Too many calls: ${parseCount} at position ${this.current}`);
    console.log(`Current token: ${this.peek()?.value}`);
    process.exit(1);
  }
  return originalMethod.call(this);
};

const timeout = setTimeout(() => {
  console.log(`TIMEOUT after ${parseCount} calls`);
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