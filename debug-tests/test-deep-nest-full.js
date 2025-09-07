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

console.log('Testing deep nest function full...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('AST body length:', ast.body.length);
    
    // Count various elements
    let comparisons = 0;
    let matchStmts = 0;
    let forLoops = 0;
    let yields = 0;
    
    const analyze = (node, depth = 0) => {
        if (!node) return;
        
        if (node.kind === 'Binary' && node.op === '<') {
            comparisons++;
            console.log(`${'  '.repeat(depth)}Found comparison at depth ${depth}`);
        }
        if (node.kind === 'Match' || (node.kind === 'Switch' && node.discriminant)) {
            matchStmts++;
            console.log(`${'  '.repeat(depth)}Found match at depth ${depth}`);
        }
        if (node.kind === 'Loop' && node.mode === 'foreach') {
            forLoops++;
            console.log(`${'  '.repeat(depth)}Found for loop at depth ${depth}`);
        }
        if (node.kind === 'Yield') {
            yields++;
            console.log(`${'  '.repeat(depth)}Found yield at depth ${depth}`);
        }
        
        for (const key in node) {
            const value = node[key];
            if (value && typeof value === 'object') {
                if (Array.isArray(value)) {
                    value.forEach(v => analyze(v, depth + 1));
                } else {
                    analyze(value, depth + 1);
                }
            }
        }
    };
    
    analyze(ast);
    
    console.log('\nCounts:');
    console.log('  comparisons:', comparisons);
    console.log('  match statements:', matchStmts);
    console.log('  for loops:', forLoops);
    console.log('  yields:', yields);
    
    // Show the actual structure
    console.log('\nFirst node:', ast.body[0]?.kind);
} catch (e) {
    console.log('Parse error:', e.message);
}