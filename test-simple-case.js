const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const tests = [
  {
    name: "Simple case",
    code: `case $x in
  1) echo "one";;
  *) echo "other";;
esac`
  },
  {
    name: "Case inside if",
    code: `if true; then
  case $x in
    1) echo "one";;
  esac
fi`
  },
  {
    name: "Complete nested structure",
    code: `if [ $i -gt 5 ]; then
  case $i in
    6)
      echo "six"
      ;;
    *)
      continue
      ;;
  esac
fi`
  }
];

tests.forEach(test => {
  console.log(`\n${test.name}:`);
  try {
    const lexer = new Lexer(test.code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    console.log(`  ✓ AST body length: ${ast.body.length}`);
    if (parser.errors && parser.errors.length > 0) {
      console.log(`  ⚠ ${parser.errors.length} errors`);
      parser.errors.slice(0, 3).forEach(err => {
        console.log(`    - ${err.message}`);
      });
    }
  } catch (e) {
    console.log(`  ✗ Error: ${e.message}`);
  }
});