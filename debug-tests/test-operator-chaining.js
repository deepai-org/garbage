const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test various operator chaining patterns
const tests = [
    { name: "Comparison chain", code: "a < b < c" },
    { name: "Mixed operators", code: "a + b * c - d" },
    { name: "Bitwise chain", code: "a & b | c ^ d" },
    { name: "Logical chain", code: "a && b || c" },
    { name: "Assignment chain", code: "a = b = c" },
    { name: "Ternary chain", code: "a ? b : c ? d : e" },
    { name: "Member access chain", code: "a.b.c.d()" },
    { name: "Optional chain", code: "a?.b?.c?.()" },
    { name: "Pipeline operator", code: "data |> filter |> map" },
    { name: "Range operator", code: "1..10" }
];

tests.forEach(test => {
    console.log(`\n=== ${test.name} ===`);
    console.log(`Code: ${test.code}`);
    
    const lexer = new Lexer(test.code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    
    try {
        const ast = parser.parse();
        if (ast.body.length > 0) {
            const node = ast.body[0];
            if (node.kind === 'ExprStmt') {
                console.log(`  Result: ${node.expr.kind}`);
                if (node.expr.kind === 'Binary') {
                    console.log(`    Op: ${node.expr.op}`);
                }
            }
        }
    } catch (e) {
        console.log(`  Error: ${e.message}`);
    }
});