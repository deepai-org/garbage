const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test just the begin/rescue/end block
const code = `
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
end`;

console.log('Testing begin/rescue/end block...');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
console.log('Tokens:', tokens.length);

const parser = new Parser(tokens);

const timeout = setTimeout(() => {
  console.log('TIMEOUT!');
  process.exit(1);
}, 2000);

try {
  const ast = parser.parse();
  clearTimeout(timeout);
  console.log('✅ Success! AST nodes:', ast.body.length);
} catch (e) {
  clearTimeout(timeout);
  console.log('❌ Error:', e.message);
}