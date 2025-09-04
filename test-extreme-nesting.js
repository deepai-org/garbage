const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
# Deep nesting across paradigms
function outer() {
  def middle():
    fn inner() -> impl Future {
      async {
        loop {
          for i in 0..10 {
            while true do
              if [ $i -gt 5 ]; then
                case $i in
                  6)
                    begin
                      try:
                        with context:
                          using resource {
                            defer cleanup()
                            yield i
                          }
                      except:
                        pass
                      finally:
                        break
                    end
                    ;;
                  *)
                    continue
                    ;;
                esac
              fi
            done
          }
        }
      }
    }
    return inner
  return middle()
}
`;

console.log('Testing extreme nesting...\n');

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  
  console.log(`Total tokens: ${tokens.length}`);
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log(`\nAST body length: ${ast.body.length}`);
  
  if (parser.errors && parser.errors.length > 0) {
    console.log('\nParse errors:');
    parser.errors.forEach((err, i) => {
      console.log(`${i+1}. ${err.message}`);
      if (err.token) {
        console.log(`   at token: ${err.token.type} "${err.token.value}" (line ${err.token.line})`);
      }
    });
  }
  
  if (ast.body.length > 0) {
    console.log('\nFirst statement:', JSON.stringify(ast.body[0], null, 2));
  }
} catch (e) {
  console.log('Fatal error:', e.message);
  console.log(e.stack);
}