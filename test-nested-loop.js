const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the actual failing pattern
const code = `function outer() {
  def middle():
    fn inner() -> impl Future {
      async {
        loop {
          for i in 0..10 {
            while [ $i -gt 5 ]; do
              echo "test"
            done
          }
        }
      }
    }
    return inner
  return middle()
}`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

const parser = new Parser(tokens);
const ast = parser.parse();

console.log(`AST body length: ${ast.body.length}`);
if (ast.body.length > 0) {
  console.log('Success! Function parsed.');
} else {
  console.log('Failed - empty AST');
  if (parser.errors && parser.errors.length > 0) {
    console.log('Parse errors:');
    parser.errors.forEach((err) => {
      console.log(`- ${err.message}`);
    });
  }
}