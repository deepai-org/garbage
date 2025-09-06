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

console.log('Testing complex pattern matching...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('✅ Parsed successfully');
    console.log('AST body:', ast.body.length);
    
    if (ast.body.length > 0) {
        const stmt = ast.body[0];
        console.log('\nFirst statement:', stmt.kind);
        
        if (stmt.kind === 'ExprStmt') {
            const expr = stmt.expr;
            console.log('Expression type:', expr.kind);
            
            if (expr.kind === 'Switch' || expr.kind === 'Match') {
                console.log('  Cases/Arms:', expr.cases?.length || expr.arms?.length);
                
                // Look for comparisons in the AST
                function findComparisons(node, results = []) {
                    if (!node) return results;
                    
                    if (node.kind === 'Binary' && ['>', '<', '>=', '<=', '==', '!='].includes(node.op)) {
                        results.push(node);
                    }
                    
                    // Recurse through object properties
                    for (const key in node) {
                        const value = node[key];
                        if (typeof value === 'object' && value !== null) {
                            if (Array.isArray(value)) {
                                value.forEach(item => findComparisons(item, results));
                            } else {
                                findComparisons(value, results);
                            }
                        }
                    }
                    
                    return results;
                }
                
                const comparisons = findComparisons(ast);
                console.log('\nComparisons found:', comparisons.length);
                comparisons.forEach(c => {
                    console.log(`  ${c.left?.name || c.left?.kind} ${c.op} ${c.right?.value || c.right?.kind}`);
                });
            }
        }
    }
} catch (error) {
    console.error('❌ Parse error:', error.message);
}