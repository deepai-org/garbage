const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test C# class with arrow function
const code = `class Component {
    public string Title { get; set; }
    
    public Render() => (
        <div>
            <h1>{this.Title}</h1>
        </div>
    )
}`;

console.log('Testing C# class with arrow function...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Key tokens around arrow:');
tokens.forEach((t, i) => {
    if (t.value === 'Render' || t.value === '=>' || t.value === '(' || t.value === ')') {
        console.log(`[${i}] "${t.value}" (${t.type})`);
    }
});

const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\nParse result:');
    console.log('AST body:', ast.body.length);
    
    if (ast.body.length === 0) {
        console.log('⚠️ Empty AST body!');
        console.log('Parser errors:', parser.errors.length);
        if (parser.errors.length > 0) {
            parser.errors.forEach(e => console.log('  Error:', e.message));
        }
    } else {
        ast.body.forEach((node, i) => {
            console.log(`[${i}]: ${node.kind} - ${node.name?.name || '(anonymous)'}`);
        });
    }
} catch (e) {
    console.log('\nParse error:', e.message);
}