const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Build up to the complex case
const tests = [
    {
        name: "Base match",
        code: `match value {
  Some(x) => x
  None => 0
}`
    },
    {
        name: "Add Ok pattern",
        code: `match value {
  Some(x) => x
  None => 0
  Ok(r) => r
}`
    },
    {
        name: "Add Err pattern",
        code: `match value {
  Some(x) => x
  None => 0
  Ok(r) => r
  Err(e) => e
}`
    },
    {
        name: "Err with throw",
        code: `match value {
  Some(x) => x
  None => 0
  Err(e) => throw e
}`
    },
    {
        name: "Full complex",
        code: `match value {
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
}`
    }
];

tests.forEach(test => {
    console.log(`\n=== ${test.name} ===`);
    
    try {
        const lexer = new Lexer(test.code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        const node = ast.body[0];
        if (node?.kind === 'Match') {
            console.log('✅ Parsed as Match');
            console.log('  Arms:', node.arms.length);
            
            // Check for guard with comparison
            const hasGuard = node.arms.some(arm => arm.guard?.kind === 'Binary');
            if (hasGuard) {
                console.log('  Has guard with comparison: YES');
            }
        } else if (node?.kind === 'ExprStmt') {
            console.log('⚠️ Parsed as ExprStmt');
            console.log('  Expression:', node.expr.kind);
            if (node.expr.kind === 'Call') {
                console.log('    Callee:', node.expr.callee?.name || node.expr.callee?.kind);
            }
        } else {
            console.log('❌ Unexpected:', node?.kind);
        }
    } catch (e) {
        console.log('❌ Error:', e.message);
    }
});