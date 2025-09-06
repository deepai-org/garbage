const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test Go defer statement
const tests = [
    {
        name: "Simple defer",
        code: `defer file.Close()`
    },
    {
        name: "Defer in function",
        code: `func main() {
    file := open("test.txt")
    defer file.Close()
    processFile(file)
}`
    },
    {
        name: "Multiple defers",
        code: `
defer cleanup()
defer log("done")
defer file.Close()`
    }
];

tests.forEach(test => {
    console.log(`\n=== ${test.name} ===`);
    
    try {
        const lexer = new Lexer(test.code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        console.log('AST nodes:', ast.body.length);
        
        // Find defer statements
        const findDefers = (node) => {
            const defers = [];
            const traverse = (n) => {
                if (!n) return;
                if (n.kind === 'Defer') {
                    defers.push(n);
                }
                for (const key in n) {
                    if (key !== 'span' && n[key]) {
                        if (Array.isArray(n[key])) {
                            n[key].forEach(traverse);
                        } else if (typeof n[key] === 'object') {
                            traverse(n[key]);
                        }
                    }
                }
            };
            traverse(node);
            return defers;
        };
        
        const defers = findDefers(ast);
        console.log('Defer statements found:', defers.length);
        
        if (defers.length > 0) {
            defers.forEach((d, i) => {
                console.log(`  [${i}]: Defer`);
                if (d.expr) {
                    console.log(`       Expression: ${d.expr.kind}`);
                }
            });
        }
        
        // Show first node details
        if (ast.body.length > 0) {
            const first = ast.body[0];
            console.log('\nFirst node:', first.kind);
            if (first.kind === 'ExprStmt' && first.expr) {
                console.log('  Expression:', first.expr.kind);
                if (first.expr.kind === 'Call' && first.expr.callee) {
                    console.log('    Callee:', first.expr.callee.name || first.expr.callee.kind);
                }
            }
        }
    } catch (e) {
        console.log('❌ Error:', e.message);
    }
});