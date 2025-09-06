const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const util = require('util');

function testJSX(code, description) {
    console.log('\n' + '='.repeat(60));
    console.log(description);
    console.log('-'.repeat(60));
    
    try {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        // Count JSX nodes
        let jsxCount = 0;
        function countJSX(node) {
            if (node && typeof node === 'object') {
                if (node.kind && node.kind.startsWith('JSX')) {
                    jsxCount++;
                }
                for (const key in node) {
                    if (Array.isArray(node[key])) {
                        node[key].forEach(countJSX);
                    } else {
                        countJSX(node[key]);
                    }
                }
            }
        }
        countJSX(ast);
        
        if (jsxCount > 0) {
            console.log(`✅ SUCCESS: Found ${jsxCount} JSX nodes`);
            
            // Show first JSX element details
            if (ast.body[0]?.expr?.kind === 'JSXElement' || ast.body[0]?.expr?.kind === 'JSXFragment') {
                const jsx = ast.body[0].expr;
                console.log(`   Type: ${jsx.kind}`);
                if (jsx.openingElement) {
                    console.log(`   Tag: ${jsx.openingElement.name.name || '<fragment>'}`);
                    console.log(`   Attributes: ${jsx.openingElement.attributes.length}`);
                    console.log(`   Children: ${jsx.children.length}`);
                }
            }
        } else {
            console.log('❌ FAIL: No JSX nodes found');
            console.log('AST:', util.inspect(ast, { depth: 3, colors: true }));
        }
    } catch (e) {
        console.log('❌ ERROR:', e.message);
    }
}

// Test all major JSX features
console.log('JSX IMPLEMENTATION TEST SUITE');
console.log('=' .repeat(60));

// Basic elements
testJSX('<div />', '1. Self-closing element');
testJSX('<div></div>', '2. Empty container');
testJSX('<div>Hello</div>', '3. Container with text');
testJSX('<Button />', '4. Component (capital)');

// Attributes
testJSX('<div className="test" />', '5. String attribute');
testJSX('<Button onClick={handler} />', '6. Expression attribute');
testJSX('<Component {...props} />', '7. Spread props');
testJSX('<input disabled />', '8. Boolean attribute');

// Children
testJSX('<div>{message}</div>', '9. Expression child');
testJSX('<div>Text {expr} more</div>', '10. Mixed children');
testJSX('<div><span>Nested</span></div>', '11. Nested elements');

// Fragments
testJSX('<>Fragment</>', '12. Fragment with text');
testJSX('<>{items}</>', '13. Fragment with expression');
testJSX('<><div /><span /></>', '14. Fragment with elements');

// Complex
testJSX(`<div className="container">
    <h1>Title</h1>
    <p>{content}</p>
</div>`, '15. Multi-line JSX');

testJSX(`<Button 
    size="large"
    variant="primary"
    onClick={() => console.log('click')}
>
    Click me
</Button>`, '16. Complex component');

// In expressions
testJSX('const x = <div>Hello</div>', '17. JSX in assignment');
testJSX('return <div>Hello</div>', '18. JSX in return');

console.log('\n' + '=' .repeat(60));
console.log('TEST COMPLETE');