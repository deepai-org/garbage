const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test simple comparison first
const tests = [
    { name: "Simple comparison", code: "if a < b { }" },
    { name: "In for loop", code: "for i in 0..10 { if i < 5 { } }" },
    { name: "Destructured for", code: "for (a, b) in vec { if a < b { } }" }
];

tests.forEach(test => {
    console.log(`\n=== ${test.name} ===`);
    console.log(`Code: ${test.code}`);
    
    const lexer = new Lexer(test.code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    
    try {
        const ast = parser.parse();
        
        const findComparisons = (node) => {
            if (!node) return [];
            
            let comparisons = [];
            if (node.kind === 'Binary' && node.op === '<') {
                comparisons.push(node);
            }
            
            for (const key in node) {
                const value = node[key];
                if (value && typeof value === 'object') {
                    if (Array.isArray(value)) {
                        value.forEach(item => {
                            comparisons = comparisons.concat(findComparisons(item));
                        });
                    } else {
                        comparisons = comparisons.concat(findComparisons(value));
                    }
                }
            }
            
            return comparisons;
        };
        
        const comparisons = findComparisons(ast);
        console.log(`  Found ${comparisons.length} comparisons`);
        comparisons.forEach(c => {
            console.log(`    - Binary op: ${c.op}`);
        });
    } catch (e) {
        console.log(`  Error: ${e.message}`);
    }
});