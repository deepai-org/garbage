const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test different match styles
const tests = [
    {
        name: "Simple match",
        code: `match value {
  Some(x) => x
  None => 0
}`
    },
    {
        name: "Match with guard",
        code: `match value {
  Some(x) if x > 0 => x
  None => 0
}`
    },
    {
        name: "Match with block body",
        code: `match value {
  Some(x) => { x + 1 }
  None => 0
}`
    },
    {
        name: "Complex nested",
        code: `match value {
  Some(x) => {
    case x when
      1) "one"
      2) "two"
    esac
  }
  None => 0
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
        } else {
            console.log('❌ Unexpected:', node?.kind);
        }
    } catch (e) {
        console.log('❌ Error:', e.message);
    }
});