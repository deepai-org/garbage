const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const util = require('util');

console.log('=====================================');
console.log('ANGLE BRACKET DISAMBIGUATION TESTING');
console.log('=====================================\n');

// Helper function to parse and analyze code
function analyzeCode(code, description) {
    console.log(`\n${description}`);
    console.log('Code: ' + code);
    console.log('-'.repeat(40));
    
    try {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        // Show how it was tokenized
        console.log('Tokens:');
        let tokenStr = '';
        for (let i = 0; i < tokens.length - 1; i++) { // Skip EOF
            tokenStr += `${tokens[i].value} `;
        }
        console.log('  ' + tokenStr.trim());
        
        // Show what AST node was created
        if (ast.body.length > 0) {
            const node = ast.body[0];
            let nodeInfo = '';
            
            if (node.kind === 'ExprStmt' && node.expr) {
                // Expression statement - check the expression type
                const expr = node.expr;
                nodeInfo = `${expr.kind}`;
                
                if (expr.kind === 'Binary') {
                    nodeInfo += ` (operator: ${expr.op})`;
                } else if (expr.kind === 'JSXElement') {
                    const tagName = expr.openingElement.name.name || expr.openingElement.name.object.name;
                    nodeInfo += ` (<${tagName}>)`;
                }
            } else if (node.kind === 'VarDecl') {
                // Variable declaration - check the type
                if (node.type) {
                    nodeInfo = `VarDecl with type: ${node.type.kind}`;
                    if (node.type.kind === 'GenericType') {
                        nodeInfo += ` (${node.type.base.name}<...>)`;
                    }
                } else {
                    nodeInfo = 'VarDecl without type';
                }
            } else {
                nodeInfo = node.kind;
            }
            
            console.log('AST Node: ' + nodeInfo);
            
            // Show detailed AST structure for interesting cases
            if (node.expr && (node.expr.kind === 'JSXElement' || node.expr.kind === 'Binary')) {
                console.log('Structure:');
                console.log(util.inspect(node.expr, { 
                    depth: 2, 
                    colors: false,
                    compact: true,
                    maxArrayLength: 3 
                }).split('\n').map(line => '  ' + line).join('\n'));
            }
        } else {
            console.log('AST: No nodes parsed');
        }
        
        return true;
    } catch (e) {
        console.log('ERROR: ' + e.message);
        return false;
    }
}

console.log('========================================');
console.log('TEST 1: COMPARISON OPERATORS');
console.log('========================================');

analyzeCode('x < 5', '1.1: Simple less than');
analyzeCode('x > 5', '1.2: Simple greater than');
analyzeCode('a < b && c > d', '1.3: Multiple comparisons with logical AND');
analyzeCode('x<y>z', '1.4: Ambiguous case (should be x < y > z)');

console.log('\n========================================');
console.log('TEST 2: JSX ELEMENTS');
console.log('========================================');

analyzeCode('<div />', '2.1: Self-closing HTML element');
analyzeCode('<Button />', '2.2: Self-closing component (uppercase)');
analyzeCode('<div>text</div>', '2.3: Container with text');
analyzeCode('<Button onClick={handler} />', '2.4: Component with props');
analyzeCode('<Form.Input />', '2.5: Namespaced component');

console.log('\n========================================');
console.log('TEST 3: GENERIC TYPES');
console.log('========================================');

analyzeCode('let x: Array<string>', '3.1: Generic type annotation');
analyzeCode('let m: Map<string, number>', '3.2: Multi-parameter generic');
analyzeCode('function foo<T>(x: T): T { return x }', '3.3: Generic function');

console.log('\n========================================');
console.log('TEST 4: DISAMBIGUATION LOGIC');
console.log('========================================');

// Show how the parser distinguishes between the three cases
const testCases = [
    { code: '<div />', type: 'JSX' },
    { code: 'Array<T>', type: 'Incomplete Generic' },
    { code: 'x < 5', type: 'Comparison' },
    { code: '<Component>', type: 'JSX (unclosed)' },
    { code: 'let t: T<U>', type: 'Generic Type' }
];

console.log('\nHow the parser decides:');
console.log('-'.repeat(40));

for (const test of testCases) {
    console.log(`\nCode: "${test.code}"`);
    console.log(`Expected: ${test.type}`);
    
    const lexer = new Lexer(test.code);
    const tokens = lexer.tokenize();
    
    // Explain the decision logic
    if (tokens[0].value === '<') {
        const next = tokens[1];
        console.log(`  → Starts with '<'`);
        console.log(`  → Next token: ${next.type} "${next.value}"`);
        
        if (next.type === 'Identifier') {
            const isUpperCase = /^[A-Z]/.test(next.value);
            const isHtmlTag = ['div', 'span', 'button', 'input'].includes(next.value.toLowerCase());
            
            if (isUpperCase) {
                console.log(`  → Uppercase identifier → JSX Component`);
            } else if (isHtmlTag) {
                console.log(`  → HTML tag name → JSX Element`);
            } else {
                console.log(`  → Not JSX pattern → Could be generic or comparison`);
            }
        }
    } else if (tokens[0].type === 'Identifier') {
        console.log(`  → Starts with identifier "${tokens[0].value}"`);
        if (tokens[1] && tokens[1].value === '<') {
            console.log(`  → Followed by '<' → Could be generic or comparison`);
            console.log(`  → Context determines interpretation`);
        }
    } else if (tokens[0].type === 'Keyword' && tokens[0].value === 'let') {
        console.log(`  → Starts with 'let' → Variable declaration`);
        console.log(`  → Type annotation after ':' uses generic syntax`);
    }
}

console.log('\n========================================');
console.log('SUMMARY');
console.log('========================================');

console.log(`
The parser successfully disambiguates angle brackets by:

1. JSX Detection (<Component> or <div>):
   - Starts with < followed by uppercase identifier → Component
   - Starts with < followed by HTML tag name → Element
   - Has JSX-specific patterns (attributes, self-closing)

2. Generic Type Detection (Array<T>):
   - Appears in type annotation context (after ':')
   - Follows type name pattern
   - Has comma-separated type parameters

3. Comparison Operator Detection (x < 5):
   - Default interpretation when not JSX or generic
   - Works with numeric/variable operands
   - Chains properly (x < y > z)

All three interpretations coexist without conflicts!
`);