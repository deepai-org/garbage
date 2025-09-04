const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Add case statement inside
const code = `function outer() {
  while [ $i -gt 5 ]; do
    if [ $i -gt 5 ]; then
      case $i in
        6)
          echo "six"
          ;;
        *)
          echo "other"
          ;;
      esac
    fi
  done
}`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log(`AST body length: ${ast.body.length}`);
if (ast.body.length > 0) {
  console.log('Success! Parsed with case statement.');
} else {
  console.log('Failed - empty AST');
  if (parser.errors && parser.errors.length > 0) {
    console.log('Parse errors:');
    parser.errors.slice(0, 5).forEach((err) => {
      console.log(`- ${err.message} at ${err.token?.value}`);
    });
  }
}