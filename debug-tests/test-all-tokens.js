const { Lexer } = require('../dist/lexer');

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

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Count non-whitespace tokens up to position 95
let count = 0;
for (let i = 0; i < Math.min(95, tokens.length); i++) {
  const t = tokens[i];
  if (t.type !== 'WHITESPACE') {
    if (count >= 85 && count <= 93) {
      console.log(`[${i}] "${t.value}" (${t.type})${t.virtualSemi ? ' [virtualSemi]' : ''}`);
    }
    count++;
  }
}