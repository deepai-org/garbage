const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `match value {
  Some(x) => x
  None => 0
}`;

console.log('Testing simple match expression...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
    if (i < 15) {
        console.log(`[${i}] ${t.value} (${t.type})`);
    }
});

console.log('\nParsing...');
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nAST:');
console.log(JSON.stringify(ast.body[0], null, 2).substring(0, 500));