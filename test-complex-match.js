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

console.log('Parsing complex match...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST body:', ast.body.length);
console.log('First node kind:', ast.body[0]?.kind);

if (ast.body[0]?.kind === 'Match') {
    const match = ast.body[0];
    console.log('\nMatch has', match.arms.length, 'arms');
    
    // Check first arm with guard
    const firstArm = match.arms[0];
    if (firstArm.guard) {
        console.log('\nFirst arm has guard:');
        console.log('  Guard kind:', firstArm.guard.kind);
        if (firstArm.guard.kind === 'Binary') {
            console.log('  Operator:', firstArm.guard.op);
            console.log('  Comparison found: x > 0');
        }
    }
}