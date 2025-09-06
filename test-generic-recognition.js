const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test generic type recognition issues
const tests = [
    {
        name: "Simple generic",
        code: `Array<string>`
    },
    {
        name: "Member access with generic",
        code: `React.forwardRef<T1, T2>()`
    },
    {
        name: "Chained generics",
        code: `Observable<T>.pipe<R>()`
    },
    {
        name: "Nested generics",
        code: `Map<string, Array<number>>`
    }
];

tests.forEach(test => {
    console.log(`\n=== ${test.name} ===`);
    console.log(`Code: ${test.code}`);
    
    try {
        const lexer = new Lexer(test.code);
        const tokens = lexer.tokenize();
        
        console.log('Tokens:');
        tokens.forEach((t, i) => {
            if (t.type !== 'EOF' && t.type !== 'VirtualSemi') {
                console.log(`  [${i}] ${t.value} (${t.type})`);
            }
        });
        
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        // Check if generics were captured
        const findGenerics = (node) => {
            const generics = [];
            
            const traverse = (n) => {
                if (!n) return;
                
                if (n.genericArgs) {
                    generics.push({ node: n.kind, args: n.genericArgs });
                }
                if (n._genericArgs) {
                    generics.push({ node: n.kind, temp: n._genericArgs });
                }
                if (n.kind === 'GenericType') {
                    generics.push({ type: 'GenericType', base: n.base?.name, args: n.args });
                }
                
                // Traverse all properties
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
            return generics;
        };
        
        const generics = findGenerics(ast);
        console.log('\nGenerics found:', generics.length);
        if (generics.length > 0) {
            console.log('Details:', JSON.stringify(generics, null, 2));
        }
        
        console.log('\nFirst node:', ast.body[0]?.kind);
        if (ast.body[0]?.kind === 'ExprStmt') {
            const expr = ast.body[0].expr;
            console.log('Expression:', expr.kind);
            if (expr.kind === 'Call') {
                console.log('  Callee:', expr.callee?.kind);
                console.log('  Has genericArgs?', !!expr.genericArgs);
                console.log('  Has _genericArgs?', !!expr._genericArgs);
            }
        }
    } catch (e) {
        console.log('❌ Error:', e.message);
    }
});