const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Exact code from the test
const code = `
match value {
  Some(x) if x > 0 => {
    case x when
      1..10) "single digit"
      11..99) "double digit"
      _) "large"
    esac
  }
  None => "empty"
  Ok(result) => match result.type {
    Pattern::Regex(r) => r.test(input)
    Pattern::Glob(g) => g.match(input)
    _ => false
  }
  Err(e) => throw e
}
`;

console.log('Testing exact failing code...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST body:', ast.body.length);

const node = ast.body[0];
console.log('First node kind:', node?.kind);

if (node?.kind === 'ExprStmt') {
    console.log('Expression kind:', node.expr.kind);
    if (node.expr.kind === 'Call') {
        console.log('  Callee:', node.expr.callee?.name || node.expr.callee?.kind);
    }
}