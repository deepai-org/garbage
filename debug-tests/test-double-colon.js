const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test double colon patterns
const tests = [
    {
        name: "Simple nested match",
        code: `match value {
  Ok(result) => match result.type {
    Regex(r) => r.test(input)
    _ => false
  }
  Err(e) => throw e
}`
    },
    {
        name: "With double colon pattern",
        code: `match value {
  Ok(result) => match result.type {
    Pattern::Regex(r) => r.test(input)
    _ => false
  }
  Err(e) => throw e
}`
    },
    {
        name: "Two double colon patterns",
        code: `match value {
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
        
        // Show relevant tokens
        console.log('Key tokens:');
        for (let i = 0; i < tokens.length; i++) {
            if (tokens[i].value === '::' || 
                (tokens[i].value === 'Pattern' && i < tokens.length - 1) ||
                (tokens[i].value === 'Regex' && i > 0 && tokens[i-1].value === '::') ||
                (tokens[i].value === 'Glob' && i > 0 && tokens[i-1].value === '::')) {
                console.log(`  [${i}] ${tokens[i].value} (${tokens[i].type})`);
            }
        }
        
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