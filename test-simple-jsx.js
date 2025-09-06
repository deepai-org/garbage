const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const util = require('util');

function testJSX(code, description) {
    console.log('\n' + '='.repeat(60));
    console.log(description);
    console.log('-'.repeat(60));
    console.log('Code:', code);
    console.log('-'.repeat(60));
    
    try {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        
        console.log('Tokens:');
        tokens.forEach((t, i) => {
            if (t.type !== 'EOF') {
                console.log(`  [${i}] ${t.type}: "${t.value}" at ${t.line}:${t.column}`);
            }
        });
        
        console.log('-'.repeat(60));
        
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        console.log('AST:', util.inspect(ast, { depth: 4, colors: true }));
        console.log('✓ Parsed successfully');
        
    } catch (e) {
        console.log('✗ Error:', e.message);
    }
}

// Test basic JSX elements
testJSX('<div />', 'Self-closing div');
testJSX('<Button />', 'Self-closing component');
testJSX('<div>Hello</div>', 'Simple container');
testJSX('<div>{message}</div>', 'Container with expression');
testJSX('<>Fragment</>', 'Fragment');

// Test attributes
testJSX('<div className="test" />', 'Element with string attribute');
testJSX('<Button onClick={handler} />', 'Element with expression attribute');
testJSX('<Component {...props} />', 'Element with spread props');