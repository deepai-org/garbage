const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

function traceTokens(code) {
  console.log(`\nCode: ${code}`);
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  
  tokens.forEach((t, i) => {
    if (t.type !== 'Whitespace') {
      console.log(`[${i}] ${t.type}: "${t.value}" virtualSemi=${t.virtualSemi || false}`);
    }
  });
  
  return tokens;
}

const code = 'while [ $i -lt 10 ]; do echo $i; done';
const tokens = traceTokens(code);

console.log('\nParsing...');
try {
  const parser = new Parser(tokens);
  const ast = parser.parse();
  console.log('AST:', JSON.stringify(ast, null, 2));
} catch (e) {
  console.log('Parse error:', e.message);
  if (e.token) {
    console.log('At token:', e.token);
  }
}