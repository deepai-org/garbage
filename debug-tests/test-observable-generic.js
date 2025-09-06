const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test Observable<T>.pipe<R>() step by step
const tests = [
    {
        name: "Just Observable",
        code: `Observable`
    },
    {
        name: "Observable with generic",
        code: `Observable<T>`
    },
    {
        name: "Observable.pipe",
        code: `Observable.pipe`
    },
    {
        name: "Observable<T>.pipe",
        code: `Observable<T>.pipe`
    },
    {
        name: "Observable.pipe<R>",
        code: `Observable.pipe<R>`
    },
    {
        name: "Observable<T>.pipe<R>",
        code: `Observable<T>.pipe<R>`
    },
    {
        name: "Observable<T>.pipe<R>()",
        code: `Observable<T>.pipe<R>()`
    }
];

tests.forEach(test => {
    console.log(`\n=== ${test.name} ===`);
    
    try {
        const lexer = new Lexer(test.code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        if (ast.body.length === 0) {
            console.log('❌ No AST nodes generated');
            return;
        }
        
        const node = ast.body[0];
        if (node?.kind === 'ExprStmt') {
            const expr = node.expr;
            console.log('Expression:', expr.kind);
            
            const printExpr = (e, indent = '  ') => {
                if (e.kind === 'Identifier') {
                    console.log(`${indent}Name: ${e.name}`);
                } else if (e.kind === 'Member') {
                    console.log(`${indent}Member:`);
                    console.log(`${indent}  Object:`);
                    printExpr(e.object, indent + '    ');
                    console.log(`${indent}  Property: ${e.property?.name}`);
                } else if (e.kind === 'Call') {
                    console.log(`${indent}Call:`);
                    console.log(`${indent}  Callee:`);
                    printExpr(e.callee, indent + '    ');
                    console.log(`${indent}  Args: ${e.args?.length || 0}`);
                    if (e.genericArgs) {
                        console.log(`${indent}  GenericArgs: ${e.genericArgs.length}`);
                    }
                }
            };
            
            printExpr(expr);
            
            // Check for _genericArgs
            const checkTemp = (e) => {
                if (e._genericArgs) {
                    console.log(`⚠️ Temporary _genericArgs found on ${e.kind}`);
                }
                if (e.object) checkTemp(e.object);
                if (e.callee) checkTemp(e.callee);
            };
            checkTemp(expr);
        }
    } catch (e) {
        console.log('❌ Error:', e.message);
    }
});