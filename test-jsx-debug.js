const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const util = require('util');

function testJSX(code, description) {
    console.log('\n' + '='.repeat(60));
    console.log(description);
    console.log('-'.repeat(60));
    console.log('Code:', code);
    
    try {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        console.log('\nAST:', util.inspect(ast, { depth: 6, colors: true }));
        
        if (ast.body.length > 0) {
            console.log('✓ Parsed', ast.body.length, 'node(s)');
            
            // Check for JSX nodes
            const jsxCount = JSON.stringify(ast).match(/JSX/g)?.length || 0;
            if (jsxCount > 0) {
                console.log('✓ Found', jsxCount, 'JSX-related properties');
            } else {
                console.log('⚠️  No JSX nodes found');
            }
        } else {
            console.log('❌ No nodes parsed');
        }
    } catch (e) {
        console.log('✗ Error:', e.message);
        console.log('Stack:', e.stack.split('\n').slice(0, 5).join('\n'));
    }
}

// Test various JSX patterns
testJSX('<div />', '1. Self-closing element');
testJSX('<div></div>', '2. Empty container');
testJSX('<div>Hello</div>', '3. Container with text');
testJSX('const x = <div />', '4. JSX in assignment');
testJSX('const x = <div>Hello</div>', '5. JSX with text in assignment');
testJSX('<Button onClick={handler} />', '6. Component with prop');
testJSX('<>{children}</>', '7. Fragment with expression');
testJSX(`
function App() {
    return <div>Hello</div>
}`, '8. JSX in function return');
testJSX(`
const App = () => (
    <div>
        <h1>Title</h1>
        <p>Content</p>
    </div>
)`, '9. Nested JSX in arrow function');