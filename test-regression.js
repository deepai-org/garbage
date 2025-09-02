const { Parser } = require('./dist/parser');
const { Lexer } = require('./dist/lexer');

// Test the complex case that was failing
const code = 'fn curry<A, B, C>(f: (A, B) -> C) -> A -> B -> C { return a => b => f(a, b) }';
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens after <A, B, C>:', tokens.slice(8, 12).map(t => t.value));

const parser = new Parser(tokens);
parser.current = 0;

// Manually test the parsing steps
try {
  parser.advance(); // fn
  const name = parser.parseIdentifier(); // curry
  console.log('Name:', name.name);
  
  // Parse generic params
  if (parser.match("<")) {
    console.log('Parsing generic params');
    const genericParams = [];
    do {
      genericParams.push(parser.parseIdentifier());
    } while (parser.match(","));
    parser.consume(">", "Expected '>'");
    console.log('Generic params:', genericParams.map(p => p.name));
    console.log('Current token after generics:', parser.peek().value);
  }
  
  // This should be at '(' now
  console.log('About to parse parameters, current token:', parser.peek().value);
  const params = parser.parseParameterList();
  console.log('Params parsed:', params.length);
} catch (e) {
  console.log('Error:', e.message);
  console.log('Error at token:', e.token?.value);
}
