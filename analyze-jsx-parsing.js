const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const util = require('util');

console.log('=' .repeat(80));
console.log('JSX PARSING ANALYSIS - Current Implementation Status');
console.log('=' .repeat(80));

function analyze(code, description) {
    console.log(`\n### ${description}`);
    console.log(`Code: ${code}`);
    
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    // Check if any nodes were created
    if (ast.body.length === 0) {
        console.log('❌ No AST nodes created - JSX is not being parsed');
    } else {
        console.log(`✓ ${ast.body.length} AST node(s) created`);
        
        // Check what type of nodes were created
        const nodeTypes = ast.body.map(n => n.kind || n.type).join(', ');
        console.log(`   Node types: ${nodeTypes}`);
        
        // Look for JSX-specific nodes
        const hasJSX = JSON.stringify(ast).includes('JSX');
        if (!hasJSX) {
            console.log('   ⚠️  No JSX-specific nodes found');
        }
    }
}

// Test various JSX patterns
analyze('<div />', 'Self-closing element');
analyze('<div>text</div>', 'Element with text');
analyze('<div>{expr}</div>', 'Element with expression');
analyze('const x = <Button />', 'JSX in assignment');
analyze('return <div>Hello</div>', 'JSX in return statement');
analyze('<div><span>nested</span></div>', 'Nested elements');
analyze('<Component {...props} />', 'Spread props');
analyze('<>fragment</>', 'Fragment');

console.log('\n' + '=' .repeat(80));
console.log('CONCLUSION:');
console.log('=' .repeat(80));

console.log(`
The analysis shows that:

1. The lexer correctly tokenizes JSX syntax into individual tokens
   (<, >, /, identifiers, etc.)

2. The parser accepts these tokens without throwing errors (tests pass)

3. However, NO JSX-specific AST nodes are being created

4. The parser is either:
   - Skipping over JSX tokens entirely (empty AST body)
   - Treating them as regular operators/expressions (not JSX nodes)

This means JSX parsing is NOT actually implemented in the parser yet,
despite being specified in the spec.md. The tests are passing because
they only check for no errors, not for correct AST structure.

RECOMMENDATION: The parser needs JSX parsing logic to be implemented
to match the specification. This would involve:
- Detecting JSX context (< followed by identifier or >)
- Parsing JSX elements, attributes, children
- Creating JSX-specific AST node types
- Handling JSX vs generic/operator disambiguation
`);

// Let's also check what happens with mixed code
console.log('=' .repeat(80));
console.log('MIXED CODE ANALYSIS:');
console.log('=' .repeat(80));

const mixedCode = `
function Component() {
    const x = 5;
    return <div>Hello {x}</div>
}`;

console.log('Code:', mixedCode);
const lexer = new Lexer(mixedCode);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nParsed AST:');
console.log(util.inspect(ast, { depth: 5, colors: true }));

if (ast.body.length > 0 && ast.body[0].kind === 'FuncDecl') {
    console.log('\n✓ Function declaration parsed');
    const func = ast.body[0];
    if (func.body && func.body.body) {
        console.log(`  Function has ${func.body.body.length} statement(s)`);
        func.body.body.forEach((stmt, i) => {
            console.log(`  Statement ${i}: ${stmt.kind}`);
        });
    }
} else {
    console.log('\n❌ Function not properly parsed');
}