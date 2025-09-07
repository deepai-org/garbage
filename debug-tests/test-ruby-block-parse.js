const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test just the Ruby block parsing
const code = `items.each do |item|
  puts item
end`;

console.log('Testing Ruby block parsing...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
    console.log(`[${i}] "${t.value}" (${t.type})`);
});

const parser = new Parser(tokens);
try {
    const ast = parser.parse();
    console.log('\nParse successful!');
    console.log('AST body:', ast.body.length);
    
    if (ast.body[0]) {
        const stmt = ast.body[0];
        console.log('Statement kind:', stmt.kind);
        if (stmt.kind === 'ExprStmt') {
            const expr = stmt.expr;
            console.log('Expression kind:', expr.kind);
            if (expr.kind === 'Member') {
                console.log('  Object:', expr.object.name);
                console.log('  Property:', expr.property.name);
            } else if (expr.kind === 'Call') {
                console.log('  Callee:', expr.callee.kind);
                if (expr.rubyBlock) {
                    console.log('  Has Ruby block!');
                    console.log('    Block params:', expr.rubyBlock.params.map(p => p.name));
                    console.log('    Block statements:', expr.rubyBlock.body.length);
                }
            }
        }
    }
    
    // Check if there's an extra 'end' statement
    if (ast.body.length > 1) {
        console.log('\n⚠️ Extra statements detected:');
        for (let i = 1; i < ast.body.length; i++) {
            const node = ast.body[i];
            console.log(`  [${i}]: ${node.kind}`);
            if (node.kind === 'ExprStmt' && node.expr.kind === 'Identifier') {
                console.log(`       Identifier: ${node.expr.name}`);
            }
        }
    }
} catch (e) {
    console.log('Parse error:', e.message);
}