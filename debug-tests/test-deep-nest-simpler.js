const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Start with the exact pattern but simpler content
const code = `fn deepNest<T>(x: Option<T>) -> Box<T> {
  match x {
    Some(Ok(vec)) => {
      Box::new(async move {
        for (a, b) in vec {
          if a < b {
            yield a
          }
        }
      })
    }
    _ => Box::new(0)
  }
}`;

console.log('Testing simplified deep nest...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('Top-level nodes:', ast.body.length);
    
    if (ast.body[0]?.kind === 'FuncDecl') {
        const func = ast.body[0];
        console.log('Function statements:', func.body?.statements?.length);
        const match = func.body?.statements?.[0];
        if (match?.kind === 'Match') {
            console.log('Match arms:', match.arms?.length);
            
            // Look for nested structures
            const analyze = (node, depth = 0) => {
                if (!node) return;
                
                if (node.kind === 'Binary' && node.op === '<') {
                    console.log(`${'  '.repeat(depth)}Found comparison at depth ${depth}`);
                }
                if (node.kind === 'Loop' && node.mode === 'foreach') {
                    console.log(`${'  '.repeat(depth)}Found for loop at depth ${depth}`);
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
            
            analyze(match);
        }
    }
    
    if (ast.body[1]) {
        console.log('\nERROR: Unexpected second top-level node:', ast.body[1].kind);
    }
} catch (e) {
    console.log('Parse error:', e.message);
}