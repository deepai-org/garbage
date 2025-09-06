const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
function AsyncComponent() {
    const ch = make(chan<JSX.Element>)
    
    go async () => {
        const data = await fetch('/api')
        ch <- <DataView data={data} />
    }
    
    return <div>{<- ch}</div>
}`;

console.log('Testing JSX with Go channels (detailed)...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    // Find make(chan<...>) tokens
    console.log('Tokens around make(chan<...>):');
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].value === 'make') {
            for (let j = i; j < Math.min(i + 12, tokens.length); j++) {
                console.log(`  [${j}] ${tokens[j].type}: "${tokens[j].value}"`);
            }
            break;
        }
    }
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed successfully!');
    console.log('AST body length:', ast.body.length);
    
    const func = ast.body[0];
    console.log('\nFunction:', func.name.name);
    console.log('Function body statements:', func.body.statements.length);
    
    // Check first statement (const ch = make(...))
    const firstStmt = func.body.statements[0];
    console.log('\nFirst statement kind:', firstStmt.kind);
    if (firstStmt.kind === 'ConstDecl' && firstStmt.values[0]) {
        const makeCall = firstStmt.values[0];
        console.log('Make call kind:', makeCall.kind);
        console.log('Make call args:', makeCall.args.length);
        if (makeCall.args[0]) {
            console.log('First arg:', JSON.stringify(makeCall.args[0], null, 2));
        }
        // Check for _typeNode
        if (makeCall._typeNode) {
            console.log('Has _typeNode:', makeCall._typeNode.kind);
            console.log('_typeNode details:', JSON.stringify(makeCall._typeNode, null, 2));
        }
    }
    
    // Look for GenericType nodes in the AST
    function findGenericTypes(node, path = '') {
        const results = [];
        
        if (!node || typeof node !== 'object') return results;
        
        if (node.kind === 'GenericType') {
            results.push({ path, node });
        }
        
        // Check _typeNode
        if (node._typeNode && node._typeNode.kind === 'GenericType') {
            results.push({ path: path + '._typeNode', node: node._typeNode });
        }
        
        for (const key in node) {
            if (key === 'span' || key === 'loc') continue;
            const child = node[key];
            if (Array.isArray(child)) {
                child.forEach((item, i) => {
                    results.push(...findGenericTypes(item, `${path}.${key}[${i}]`));
                });
            } else if (child && typeof child === 'object') {
                results.push(...findGenericTypes(child, `${path}.${key}`));
            }
        }
        
        return results;
    }
    
    const genericTypes = findGenericTypes(ast);
    console.log('\nGenericType nodes found:', genericTypes.length);
    genericTypes.forEach(({ path, node }) => {
        console.log(`  Path: ${path}`);
        console.log(`  Base: ${node.base.name}`);
        console.log(`  Args: ${node.args.length}`);
    });
    
} catch (error) {
    console.error('\n❌ Parser error:', error.message);
    console.error('Stack:', error.stack);
}