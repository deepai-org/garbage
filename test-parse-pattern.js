const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test how Pattern::Regex should be parsed
const code = `match value {
  Pattern::Regex(r) => r.test(input)
  Err(e) => throw e
}`;

console.log('Testing Pattern::Regex parsing...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens for Pattern::Regex:');
for (let i = 0; i < tokens.length; i++) {
    if (i >= 5 && i <= 10) {
        console.log(`[${i}] ${tokens[i].value} (${tokens[i].type})`);
    }
}

console.log('\nParsing...');
try {
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    const node = ast.body[0];
    if (node?.kind === 'Match') {
        console.log('✅ Parsed as Match');
        console.log('  Arms:', node.arms.length);
        
        // Check first arm pattern
        const firstArm = node.arms[0];
        console.log('  First arm pattern:', firstArm.patterns[0]?.kind);
        if (firstArm.patterns[0]?.kind === 'Call') {
            console.log('    Callee:', firstArm.patterns[0].callee?.kind);
            if (firstArm.patterns[0].callee?.kind === 'MemberAccess') {
                console.log('      Object:', firstArm.patterns[0].callee.object?.name);
                console.log('      Property:', firstArm.patterns[0].callee.property?.name);
            } else {
                console.log('      Name:', firstArm.patterns[0].callee?.name);
            }
        }
    } else if (node?.kind === 'ExprStmt') {
        console.log('⚠️ Parsed as ExprStmt');
        console.log('  Expression:', node.expr.kind);
        if (node.expr.kind === 'Call') {
            console.log('    Callee:', node.expr.callee?.name || node.expr.callee?.kind);
        }
    }
} catch (e) {
    console.log('❌ Error:', e.message);
    console.log('Stack:', e.stack);
}