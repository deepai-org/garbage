const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const testCases = [
    '<>Hello World</>',
    '<div>Hello World</div>',
    '<span>  Multiple  Spaces  </span>',
    `<div>
        Line breaks
        and spaces
    </div>`
];

testCases.forEach(code => {
    console.log('=' .repeat(50));
    console.log('Code:', JSON.stringify(code));
    console.log('-' .repeat(50));
    
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    // Find JSXText tokens
    const jsxTextTokens = tokens.filter(t => t.type === 'JSXText');
    
    console.log('JSXText tokens found:', jsxTextTokens.length);
    jsxTextTokens.forEach((token, i) => {
        console.log(`  Token ${i}: "${token.value}" (length: ${token.value.length})`);
        console.log(`    Original: ${JSON.stringify(token.value)}`);
    });
    
    // Parse and check
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    // Find JSXText nodes in AST
    function findJSXText(node, results = []) {
        if (!node) return results;
        
        if (node.kind === 'JSXText') {
            results.push(node);
        }
        
        // Traverse children
        Object.values(node).forEach(child => {
            if (typeof child === 'object' && child !== null) {
                if (Array.isArray(child)) {
                    child.forEach(c => findJSXText(c, results));
                } else {
                    findJSXText(child, results);
                }
            }
        });
        
        return results;
    }
    
    const jsxTextNodes = findJSXText(ast);
    console.log('\nJSXText nodes in AST:', jsxTextNodes.length);
    jsxTextNodes.forEach((node, i) => {
        console.log(`  Node ${i}: "${node.value}" (length: ${node.value.length})`);
    });
    
    console.log();
});