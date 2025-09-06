const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
    return <input ref={ref} {...props} />
})`;

console.log('Testing React.forwardRef with generics...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Find generic types
const findGenericTypes = (node) => {
    const generics = [];
    
    const traverse = (n) => {
        if (!n) return;
        
        // Check Call nodes for genericArgs
        if (n.kind === 'Call' && n.genericArgs) {
            generics.push({
                kind: 'Call',
                callee: n.callee?.property?.name || n.callee?.name,
                genericArgs: n.genericArgs
            });
        }
        
        // Check for GenericType nodes
        if (n.kind === 'GenericType') {
            generics.push({
                kind: 'GenericType',
                base: n.base?.name,
                args: n.args
            });
        }
        
        // Traverse all properties
        for (const key in n) {
            if (key !== 'span' && n[key]) {
                if (Array.isArray(n[key])) {
                    n[key].forEach(traverse);
                } else if (typeof n[key] === 'object') {
                    traverse(n[key]);
                }
            }
        }
    };
    
    traverse(node);
    return generics;
};

console.log('AST nodes:', ast.body.length);
if (ast.body.length > 0) {
    const decl = ast.body[0];
    console.log('Declaration:', decl.kind);
    
    if (decl.kind === 'ConstDecl') {
        console.log('  Name:', decl.names[0].name);
        
        // Check the init expression
        const init = decl.init && decl.init[0];
        console.log('  Init:', init?.kind);
        
        if (init?.kind === 'Call') {
            console.log('    Callee:', init.callee?.kind);
            if (init.callee?.kind === 'Member') {
                console.log('      Object:', init.callee.object?.name);
                console.log('      Property:', init.callee.property?.name);
            }
            console.log('    Has genericArgs?', !!init.genericArgs);
            if (init.genericArgs) {
                console.log('    Generic count:', init.genericArgs.length);
                init.genericArgs.forEach((g, i) => {
                    console.log(`      [${i}]:`, g.kind, g.id?.name || g.base?.name);
                });
            }
        }
    }
}

const generics = findGenericTypes(ast);
console.log('\nTotal generics found:', generics.length);
generics.forEach((g, i) => {
    console.log(`  [${i}]:`, JSON.stringify(g, null, 2).substring(0, 200));
});