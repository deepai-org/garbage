const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test C# properties
const code = `class Component {
    public string Title { get; set; }
    
    public Render() {
        return <h1>{this.Title}</h1>
    }
}`;

console.log('Testing C# properties with JSX...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Key tokens:');
tokens.forEach((t, i) => {
    if (t.value === 'public' || t.value === 'string' || t.value === 'Title' || 
        t.value === 'get' || t.value === 'set' || t.value === '{' || t.value === '}') {
        console.log(`[${i}] "${t.value}" (${t.type})`);
    }
});

const parser = new Parser(tokens);
try {
    const ast = parser.parse();
    console.log('\nParse result:');
    console.log('AST body length:', ast.body.length);
    
    if (ast.body.length > 1) {
        console.log('\n⚠️ Multiple top-level nodes detected!');
    }
    
    ast.body.forEach((node, i) => {
        console.log(`[${i}]: ${node.kind}`);
        if (node.kind === 'ClassDecl') {
            console.log(`     Name: ${node.name.name}`);
            console.log(`     Members: ${node.members.length}`);
            node.members.forEach((m, j) => {
                console.log(`       [${j}]: ${m.kind} - ${m.name?.name || '(anonymous)'}`);
            });
        } else if (node.kind === 'ExprStmt') {
            console.log(`     Expression: ${node.expr.kind} - ${node.expr.name || node.expr.callee?.name || '?'}`);
        }
    });
} catch (e) {
    console.log('Parse error:', e.message);
}