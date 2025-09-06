const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test comprehensive angle bracket disambiguation
const tests = [
    // Comparisons
    { code: 'x < 5', expected: 'Binary', desc: 'Less than' },
    { code: 'x > 5', expected: 'Binary', desc: 'Greater than' },
    { code: 'x <= 5', expected: 'Binary', desc: 'Less/equal' },
    { code: 'x >= 5', expected: 'Binary', desc: 'Greater/equal' },
    { code: 'a < b && c > d', expected: 'Binary', desc: 'Multiple comparisons' },
    
    // Generics in type position
    { code: 'let x: Array<string>', expected: 'GenericType', desc: 'Generic type annotation' },
    { code: 'let m: Map<string, number>', expected: 'GenericType', desc: 'Multi-param generic' },
    { code: 'function foo<T>(x: T): T { return x }', expected: 'FuncDecl', desc: 'Generic function' },
    
    // JSX
    { code: '<div />', expected: 'JSXElement', desc: 'Self-closing JSX' },
    { code: '<Button onClick={handler} />', expected: 'JSXElement', desc: 'JSX with props' },
    { code: '<div>content</div>', expected: 'JSXElement', desc: 'JSX container' },
    
    // Ambiguous
    { code: 'x<y>z', expected: 'Binary', desc: 'Chained comparisons (x < y > z)' },
];

let passed = 0;
let failed = 0;

console.log('ANGLE BRACKET DISAMBIGUATION VERIFICATION\n');
console.log('=' .repeat(60));

for (const test of tests) {
    try {
        const lexer = new Lexer(test.code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        let actual = 'Unknown';
        
        if (ast.body.length > 0) {
            const first = ast.body[0];
            
            if (first.kind === 'ExprStmt' && first.expr) {
                actual = first.expr.kind;
            } else if (first.kind === 'VarDecl' && first.type) {
                actual = first.type.kind;
            } else {
                actual = first.kind;
            }
        }
        
        const success = actual === test.expected;
        
        if (success) {
            console.log(`✅ ${test.desc}: "${test.code}"`);
            console.log(`   Parsed as: ${actual}`);
            passed++;
        } else {
            console.log(`❌ ${test.desc}: "${test.code}"`);
            console.log(`   Expected: ${test.expected}, Got: ${actual}`);
            failed++;
        }
    } catch (e) {
        console.log(`❌ ${test.desc}: "${test.code}"`);
        console.log(`   Error: ${e.message}`);
        failed++;
    }
}

console.log('\n' + '=' .repeat(60));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log(`Success rate: ${(passed / tests.length * 100).toFixed(1)}%`);

if (failed === 0) {
    console.log('\n✅ All angle bracket disambiguations working correctly!');
} else {
    console.log('\n⚠️ Some angle bracket disambiguations need attention');
}