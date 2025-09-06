const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test PHP-style JSX
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

console.log('Testing PHP-style JSX:\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('✓ Parsed successfully');
    console.log('Body length:', ast.body.length);
    
    if (ast.body[0]) {
        const func = ast.body[0];
        console.log('\nFunction:', func.kind, func.name?.name);
        console.log('Params:', func.params?.map(p => p.name.name));
        
        // Find JSX elements in the AST
        let jsxCount = 0;
        const jsxElements = [];
        
        function findJSX(node, path = '') {
            if (!node) return;
            
            if (node.kind === 'JSXElement') {
                jsxCount++;
                const tagName = node.openingElement?.tagName || node.openingElement?.name;
                jsxElements.push(tagName?.name || 'unknown');
                console.log(`Found JSX element #${jsxCount}: <${tagName?.name}> at ${path}`);
            }
            
            // Recursively search
            for (const key in node) {
                if (key === 'span') continue;
                const value = node[key];
                if (value && typeof value === 'object') {
                    if (Array.isArray(value)) {
                        value.forEach((item, i) => {
                            if (item && typeof item === 'object') {
                                findJSX(item, `${path}.${key}[${i}]`);
                            }
                        });
                    } else {
                        findJSX(value, `${path}.${key}`);
                    }
                }
            }
        }
        
        console.log('\nSearching for JSX elements:');
        findJSX(ast);
        console.log('\nTotal JSX elements found:', jsxCount);
        console.log('JSX tags:', jsxElements);
    }
} catch (e) {
    console.log('✗ Parse error:', e.message);
}