const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test different JSX patterns
const tests = [
    {
        name: "Simple JSX",
        code: `<div><h1>Test</h1></div>`
    },
    {
        name: "JSX with expression",
        code: `<div><h1>{title}</h1></div>`
    },
    {
        name: "JSX with arrow function",
        code: `<div>{items.map(item => <li>{item}</li>)}</div>`
    },
    {
        name: "JSX with PHP arrow",
        code: `<div>{$items->map($item => <li>{$item}</li>)}</div>`
    },
    {
        name: "Full PHP example inline",
        code: `<div><h1>{$title}</h1>{$items->map($item => <li>{$item->name}</li>)}</div>`
    },
    {
        name: "With newlines like test",
        code: `<div>
    <h1>{$title}</h1>
    {$items->map($item => 
        <li>{$item->name}</li>
    )}
</div>`
    }
];

tests.forEach(test => {
    console.log(`\n=== ${test.name} ===`);
    
    const lexer = new Lexer(test.code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    
    try {
        const ast = parser.parse();
        
        // Count JSX
        let jsxCount = 0;
        function countJSX(node) {
            if (node && node.kind === 'JSXElement') {
                jsxCount++;
                const tag = node.openingElement?.name?.name || node.openingElement?.tagName?.name;
                console.log(`  Found: <${tag}>`);
            }
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
        
        countJSX(ast);
        console.log(`✓ Total JSX: ${jsxCount}`);
    } catch (e) {
        console.log(`✗ Error: ${e.message}`);
    }
});