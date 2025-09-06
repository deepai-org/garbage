const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test various constructs to understand actual AST structure
const testCases = [
    { name: 'Function call', code: 'doWork()' },
    { name: 'Unary yield', code: 'yield value' },
    { name: 'Export function', code: 'export function foo() {}' },
    { name: 'Package declaration', code: 'package main' },
    { name: 'Go statement', code: 'go doWork()' },
    { name: 'Channel send', code: 'ch <- value' },
    { name: 'Channel receive', code: '<- ch' },
    { name: 'Throw statement', code: 'throw new Error("test")' }
];

testCases.forEach(test => {
    console.log(`\n=== ${test.name} ===`);
    console.log(`Code: ${test.code}`);
    try {
        const lexer = new Lexer(test.code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        if (ast.body.length > 0) {
            const node = ast.body[0];
            console.log(`Node kind: ${node.kind}`);
            
            // Check specific properties based on node type
            if (node.kind === 'ExprStmt') {
                const expr = node.expr;
                console.log(`  Expression kind: ${expr.kind}`);
                if (expr.kind === 'Call') {
                    console.log(`    Call target property: ${expr.func ? 'func' : expr.callee ? 'callee' : 'unknown'}`);
                    const target = expr.func || expr.callee;
                    if (target) {
                        console.log(`    Target name: ${target.name || target.kind}`);
                    }
                } else if (expr.kind === 'Unary') {
                    console.log(`    Unary op: ${expr.op}`);
                    console.log(`    Has operand: ${!!expr.operand}`);
                    console.log(`    Has argument: ${!!expr.argument}`);
                } else if (expr.kind === 'Binary') {
                    console.log(`    Binary op: ${expr.op}`);
                    console.log(`    Left: ${expr.left.kind || expr.left.name}`);
                    console.log(`    Right: ${expr.right.kind || expr.right.name}`);
                }
            } else if (node.kind === 'FuncDecl') {
                console.log(`  Function name: ${node.name.name}`);
                console.log(`  Has exported property: ${node.hasOwnProperty('exported')}`);
                console.log(`  Has export property: ${node.hasOwnProperty('export')}`);
            }
        } else {
            console.log('No AST nodes generated');
        }
    } catch (error) {
        console.log(`Parse error: ${error.message}`);
    }
});