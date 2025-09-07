const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test extreme nesting
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

console.log('Testing extreme nesting...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('First 30 tokens:');
for (let i = 0; i < Math.min(30, tokens.length); i++) {
    const t = tokens[i];
    console.log(`[${i}] "${t.value}" (${t.type})`);
}

const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\nParse result:');
    console.log('AST body:', ast.body.length);
    
    if (ast.body.length > 0) {
        const node = ast.body[0];
        console.log('First node kind:', node.kind);
        if (node.kind === 'FuncDecl') {
            console.log('  Name:', node.name.name);
            console.log('  GenericParams:', node.genericParams?.map(p => p.name));
            console.log('  Params:', node.params?.length);
        } else if (node.kind === 'ExprStmt') {
            console.log('  Expression:', node.expr.kind);
            if (node.expr.kind === 'Identifier') {
                console.log('    Name:', node.expr.name);
            }
        }
    }
} catch (e) {
    console.log('\nParse error:', e.message);
}