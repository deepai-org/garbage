const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Add patterns one by one to find the breaking point
const tests = [
    {
        name: "Two arms",
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
    },
    {
        name: "Three arms (add None)",
        code: `match value {
  Some(x) if x > 0 => {
    case x when
      1..10) "single digit"
      11..99) "double digit"
      _) "large"
    esac
  }
  None => "empty"
  Err(e) => throw e
}`
    },
    {
        name: "Four arms (add Ok before Err)",
        code: `match value {
  Some(x) if x > 0 => {
    case x when
      1..10) "single digit"
      11..99) "double digit"
      _) "large"
    esac
  }
  None => "empty"
  Ok(result) => false
  Err(e) => throw e
}`
    },
    {
        name: "Ok with nested match",
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
    _ => false
  }
  Err(e) => throw e
}`
    },
    {
        name: "Full failing case",
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