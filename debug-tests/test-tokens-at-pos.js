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

console.log('Looking at token positions...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Find key positions
const positions = {};
tokens.forEach((t, i) => {
    if (t.value === 'match') positions.match = i;
    if (t.value === 'Some') positions.some = i;
    if (t.value === '_' && !positions.underscore) positions.underscore = i;
    if (t.value === '}') {
        if (!positions.firstCloseBrace) positions.firstCloseBrace = i;
        positions.lastCloseBrace = i;
    }
});

console.log('Key positions:');
console.log('  match at:', positions.match);
console.log('  Some( at:', positions.some);
console.log('  _ pattern at:', positions.underscore);

// Show tokens around the underscore
console.log('\nTokens 88-94:');
for (let i = 88; i <= 94; i++) {
    const t = tokens[i];
    if (t) {
        console.log(`[${i}] "${t.value}" (${t.type})${t.virtualSemi ? ' [virtualSemi]' : ''}`);
    }
}