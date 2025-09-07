const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `fn deepNest<T, U, V>(x: Option<Result<Vec<(T, U)>, Error>>) -> Box<dyn Future<Item = V>> {
  match x {
    Some(Ok(vec)) => {
      Box::new(async move {
        for (a, b) in vec.iter() {
          if a < b {
            yield process(a, b).await?
          }
        }
      })
    }
    _ => Box::new(future::err(Error::new("failed")))
  }
}`;

console.log('Testing with try/catch...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('Success! AST body count:', ast.body.length);
    if (ast.body[0]) {
        console.log('First node:', ast.body[0].kind);
        if (ast.body[0].kind === 'FuncDecl') {
            const func = ast.body[0];
            console.log('Function body statements:', func.body?.statements?.length);
            const match = func.body?.statements?.[0];
            if (match?.kind === 'Match') {
                console.log('Match arms:', match.arms?.length);
            }
        }
    }
} catch (e) {
    console.log('Parse error:', e.message);
    console.log('Stack:', e.stack);
}