const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test bash conditional
const code = `
class WebServer {
  async handle() {
    # Bash-style conditional
    if [ "\$result.cached" = "true" ]; then
      res.setHeader("X-Cache", "HIT")
    fi
    
    res.json(result)
  }
}
`;

console.log('Testing bash conditional in method...\\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens for bash conditional:');
tokens.slice(5, 25).forEach((t, i) => {
  console.log(`  [${i+5}] Line ${t.line}: ${t.type}: "${t.value}"`);
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\\nAST body length:', ast.body.length);
console.log('Parser errors:', parser.errors.length);

if (parser.errors.length > 0) {
  parser.errors.forEach((err, i) => {
    console.log(`Error ${i + 1}: ${err.message} at token: "${err.token.value}" (line ${err.token.line})`);
  });
}

if (ast.body[0]?.kind === 'ClassDecl') {
  const cls = ast.body[0];
  console.log(`\\nClass members: ${cls.members?.length}`);
}