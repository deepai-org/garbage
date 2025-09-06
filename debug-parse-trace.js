const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Simple case that works
const code1 = `<div>{items.map(item => <li>{item}</li>)}</div>`;
// Case that fails
const code2 = `<div>{$items->map($item => <li>{$item}</li>)}</div>`;

function testCode(name, code) {
    console.log(`\n=== ${name} ===`);
    console.log('Code:', code);
    
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    // Check if isJSXElement would work
    class TestParser extends Parser {
        test() {
            this.current = 0;
            const result = this.isJSXElement();
            console.log('isJSXElement() at position 0:', result);
            
            // Try parsing
            this.current = 0;
            try {
                const expr = this.parseExpression();
                console.log('parseExpression() returned:', expr?.kind);
                return expr;
            } catch (e) {
                console.log('parseExpression() error:', e.message);
                return null;
            }
        }
    }
    
    const parser = new TestParser(tokens);
    const expr = parser.test();
    
    if (expr) {
        // Count JSX
        let count = 0;
        function countJSX(node) {
            if (node?.kind === 'JSXElement') count++;
            if (node && typeof node === 'object') {
                for (const key in node) {
                    if (key === 'span') continue;
                    const value = node[key];
                    if (Array.isArray(value)) {
                        value.forEach(countJSX);
                    } else if (value && typeof value === 'object') {
                        countJSX(value);
                    }
                }
            }
        }
        countJSX(expr);
        console.log('JSX elements in expression:', count);
    }
}

testCode('Working case', code1);
testCode('Failing case', code2);