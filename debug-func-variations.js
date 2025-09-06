const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test different function variations
const tests = [
    {
        name: "Basic function with return",
        code: `function test() {
    return 42
}`
    },
    {
        name: "Function with JSX return",
        code: `function test() {
    return <div>Hello</div>
}`
    },
    {
        name: "Function with parenthesized return",
        code: `function test() {
    return (
        <div>Hello</div>
    )
}`
    },
    {
        name: "Function with PHP parameters",
        code: `function test($param) {
    return $param
}`
    },
    {
        name: "Full PHP example",
        code: `function renderTemplate($title, $items) {
    return (
        <div>
            <h1>{$title}</h1>
        </div>
    )
}`
    }
];

tests.forEach(test => {
    console.log(`\n=== ${test.name} ===`);
    
    const lexer = new Lexer(test.code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    
    try {
        const ast = parser.parse();
        console.log('✓ Parsed');
        
        if (ast.body[0]) {
            const func = ast.body[0];
            console.log('  Function:', func.name?.name);
            console.log('  Body statements:', func.body?.statements?.length || 0);
            
            if (func.body?.statements?.[0]) {
                const stmt = func.body.statements[0];
                console.log('  First statement:', stmt.kind);
                if (stmt.kind === 'Return' && stmt.values?.[0]) {
                    console.log('  Return value:', stmt.values[0].kind);
                }
            }
        }
    } catch (e) {
        console.log('✗ Error:', e.message);
    }
});