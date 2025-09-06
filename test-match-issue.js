const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the specific problematic pattern
const tests = [
    {
        name: "Simple match with guard",
        code: `match value {
  Some(x) if x > 0 => x
  Err(e) => throw e
}`
    },
    {
        name: "Match with nested case (no guard)",
        code: `match value {
  Some(x) => {
    case x when
      1) "one"
    esac
  }
  Err(e) => throw e
}`
    },
    {
        name: "Match with guard AND nested case",
        code: `match value {
  Some(x) if x > 0 => {
    case x when
      1) "one"
    esac
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