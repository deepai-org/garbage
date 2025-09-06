const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Exact test code
const code = `
function renderTemplate($title, $items) {
    return (
        <div>
            <h1>{$title}</h1>
            {$items->map($item => 
                <li>{$item->name}</li>
            )}
        </div>
    )
}`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('AST body length:', ast.body.length);
    
    // Count JSX recursively
    function countJSX(node, depth = 0) {
        let count = 0;
        const indent = '  '.repeat(depth);
        
        if (node && node.kind === 'JSXElement') {
            count++;
            const tagName = node.openingElement?.name?.name || node.openingElement?.tagName?.name;
            console.log(`${indent}Found JSX: <${tagName}>`);
        }
        
        // Recursively search all properties
        if (node && typeof node === 'object') {
            for (const key in node) {
                if (key === 'span') continue;
                const value = node[key];
                if (value) {
                    if (Array.isArray(value)) {
                        value.forEach(item => {
                            count += countJSX(item, depth + 1);
                        });
                    } else if (typeof value === 'object') {
                        count += countJSX(value, depth + 1);
                    }
                }
            }
        }
        
        return count;
    }
    
    const jsxCount = countJSX(ast);
    console.log('\nTotal JSX elements:', jsxCount);
    
} catch (e) {
    console.log('Parse error:', e.message);
}