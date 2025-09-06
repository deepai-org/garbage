// Simulate what would happen with a broken parser

const code = `
async fn processStream<T>(input: Stream<T>) -> Result<Vec<T>, Error> {
  i < 10
  <-ch
  ch <- item
}
`;

console.log('Testing with current weak test:');
console.log('--------------------------------');

// Current test logic
function weakTest(code) {
    // Pretend parser that returns garbage
    const ast = {
        body: [
            { kind: 'Garbage', value: 'I parsed nothing correctly!' }
        ]
    };
    
    // The actual test check:
    const passes = ast.body.length >= 1;
    
    console.log('Test checks: ast.body.length >= 1');
    console.log('AST has', ast.body.length, 'nodes');
    console.log('Test result:', passes ? '✅ PASS' : '❌ FAIL');
    
    return passes;
}

const result1 = weakTest(code);

console.log('\nEven though the parser returned garbage, test PASSED!');
console.log('The AST could be completely wrong and we\'d never know.\n');

console.log('Testing with proper verification:');
console.log('----------------------------------');

function strongTest(code) {
    // Same broken parser
    const ast = {
        body: [
            { kind: 'Garbage', value: 'I parsed nothing correctly!' }
        ]
    };
    
    console.log('Test checks:');
    console.log('  - ast.body[0].kind === "FuncDecl"');
    console.log('  - func.genericParams exists');
    console.log('  - func.params[0].type.kind === "GenericType"');
    console.log('  - etc...\n');
    
    try {
        const func = ast.body[0];
        if (func.kind !== 'FuncDecl') {
            throw new Error(`Expected FuncDecl, got ${func.kind}`);
        }
        if (!func.genericParams) {
            throw new Error('Missing generic parameters');
        }
        // ... more checks
        return true;
    } catch (e) {
        console.log('Test result: ❌ FAIL');
        console.log('Error:', e.message);
        return false;
    }
}

const result2 = strongTest(code);

console.log('\nWith proper checks, the broken parser is caught!');

console.log('\n========================================');
console.log('ANGLE BRACKET DISAMBIGUATION IN THIS CODE:');
console.log('========================================');

const patterns = [
    { pattern: '<T>', context: 'processStream<T>', interpretation: 'Generic parameter' },
    { pattern: '<T>', context: 'Stream<T>', interpretation: 'Generic type' },
    { pattern: '<Vec<T>, Error>', context: 'Result<Vec<T>, Error>', interpretation: 'Multi-param generic' },
    { pattern: '<T>', context: 'Vec<T>', interpretation: 'Nested generic' },
    { pattern: '<', context: 'i < 10', interpretation: 'Comparison operator' },
    { pattern: '<-', context: '<-ch', interpretation: 'Channel receive' },
    { pattern: '<-', context: 'ch <- item', interpretation: 'Channel send' }
];

console.log('\nThe weak test verifies NONE of these interpretations!');
console.log('\nPatterns that should be verified:');
patterns.forEach((p, i) => {
    console.log(`${i + 1}. ${p.pattern} in "${p.context}" → ${p.interpretation}`);
});