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

console.log('Testing deep nest function...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('AST body length:', ast.body.length);
    
    if (ast.body[0]) {
        const func = ast.body[0];
        console.log('First node kind:', func.kind);
        
        if (func.kind === 'FuncDecl') {
            console.log('Function name:', func.name?.name);
            console.log('Has body:', !!func.body);
            
            // Look for comparisons in the AST
            const findComparisons = (node, depth = 0) => {
                if (!node) return;
                
                if (node.kind === 'Binary' && node.op === '<') {
                    console.log(`${'  '.repeat(depth)}Found comparison: ${node.op}`);
                }
                
                // Recurse through all properties
                for (const key in node) {
                    const value = node[key];
                    if (value && typeof value === 'object') {
                        if (Array.isArray(value)) {
                            value.forEach(item => findComparisons(item, depth + 1));
                        } else {
                            findComparisons(value, depth + 1);
                        }
                    }
                }
            };
            
            console.log('\nSearching for comparisons...');
            findComparisons(func.body);
        }
    }
} catch (e) {
    console.log('Parse error:', e.message);
}