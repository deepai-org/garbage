const { Lexer } = require('./dist/lexer');

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

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Token at position 82:', tokens[82]);
console.log('Token at position 81:', tokens[81]);
console.log('Token at position 83:', tokens[83]);

// Find the 'end' token
for (let i = 0; i < tokens.length; i++) {
  if (tokens[i].value === 'end') {
    console.log(`'end' found at position ${i}:`, tokens[i]);
  }
  if (tokens[i].value === '}' && tokens[i].type === 'Operator') {
    console.log(`'}' found at position ${i}:`, tokens[i]);
  }
}