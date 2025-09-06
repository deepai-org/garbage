const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `match value {
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
}`;

console.log('Checking match expression structure...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

if (ast.body[0]?.kind === 'ExprStmt') {
    const expr = ast.body[0].expr;
    console.log('Expression kind:', expr.kind);
    
    if (expr.kind === 'Call') {
        console.log('  Callee:', expr.callee?.name || expr.callee?.kind);
        console.log('  Args:', expr.args?.length);
        console.log('\nThis is being parsed as a function call, not a match expression!');
    }
}