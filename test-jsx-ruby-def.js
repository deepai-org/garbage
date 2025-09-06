const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
def render_list(items)
    <ul>
        {items.each do |item|
            <li>{item.name}</li>
        end}
    </ul>
end`;

console.log('Testing JSX with Ruby def and blocks...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    console.log('Key tokens:');
    tokens.forEach((t, i) => {
        if (t.type === 'DEF' || t.type === 'END' || t.type === 'DO' || 
            t.type === 'LT' || t.type === 'JSX_TAG_START' || t.value === 'ul' || t.value === 'li') {
            console.log(`  [${i}] ${t.type}: "${t.value}"`);
        }
    });
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed successfully!');
    console.log('AST body length:', ast.body.length);
    
    if (ast.body[0]) {
        const def = ast.body[0];
        console.log('\nFunction declaration:');
        console.log('  Kind:', def.kind);
        console.log('  Name:', def.name?.name);
        console.log('  Params:', def.params?.length);
        
        // Count JSX elements in the function body
        function countJSX(node, depth = 0) {
            let count = 0;
            if (!node) return count;
            
            if (node.kind === 'JSXElement') {
                count++;
                console.log('  '.repeat(depth) + 'Found JSX:', node.openingElement.name.name);
            }
            
            for (const key in node) {
                if (key === 'span' || key === 'loc') continue;
                const value = node[key];
                if (Array.isArray(value)) {
                    value.forEach(item => count += countJSX(item, depth + 1));
                } else if (value && typeof value === 'object') {
                    count += countJSX(value, depth + 1);
                }
            }
            return count;
        }
        
        console.log('\nJSX elements in function:');
        const jsxCount = countJSX(def);
        console.log('Total JSX elements found:', jsxCount);
    }
    
} catch (error) {
    console.error('\n❌ Parser error:', error.message);
    console.error('At token index:', error.current);
    
    const lines = code.split('\n');
    if (error.line && error.column) {
        console.error(`\nLine ${error.line}: ${lines[error.line - 1]}`);
        console.error(' '.repeat(error.column - 1) + '^');
    }
}