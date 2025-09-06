const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test range patterns specifically
const tests = [
    {
        name: "Case with range pattern",
        code: `match value {
  Some(x) => {
    case x when
      1..10) "single"
    esac
  }
  Err(e) => throw e
}`
    },
    {
        name: "Case with multiple ranges",
        code: `match value {
  Some(x) => {
    case x when
      1..10) "single"
      11..99) "double"
    esac
  }
  Err(e) => throw e
}`
    },
    {
        name: "With guard and ranges",
        code: `match value {
  Some(x) if x > 0 => {
    case x when
      1..10) "single"
      11..99) "double"
    esac
  }
  Err(e) => throw e
}`
    },
    {
        name: "Full pattern with wildcard",
        code: `match value {
  Some(x) if x > 0 => {
    case x when
      1..10) "single digit"
      11..99) "double digit"
      _) "large"
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