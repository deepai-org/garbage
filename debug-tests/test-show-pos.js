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

// Show what's at position 89 and 90
console.log('Token at index 89:', tokens[89]);
console.log('Token at index 90:', tokens[90]);
console.log('Token at index 91:', tokens[91]);

// The parser position is an index into the tokens array
// So position 89 means tokens[89] is the current token
console.log('\nSo when parser is at position 89:');
console.log('  peek() returns tokens[89] =', tokens[89]?.value, tokens[89]?.type);
console.log('\nAfter the block closes at token[90] (}), parser should be at position 91');
console.log('  peek() would return tokens[91] =', tokens[91]?.value, tokens[91]?.type);