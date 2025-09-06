const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
const ChannelComponent = () => {
    const ch = make(chan int, 10);
    go func() {
        ch <- 42;
    }();
    
    return (
        <div>
            <span>Value: {<-ch}</span>
        </div>
    );
};
`;

console.log('Testing JSX with Go channels...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    console.log('Tokens around channel operations:');
    tokens.forEach((t, i) => {
        if (t.type === 'CHAN' || t.type === 'LARROW' || 
            (t.type === 'LT' && tokens[i+1] && tokens[i+1].type === 'MINUS')) {
            console.log(`  [${i}] ${t.type}: "${t.value}"`);
            if (tokens[i+1]) console.log(`  [${i+1}] ${tokens[i+1].type}: "${tokens[i+1].value}"`);
        }
    });
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed successfully!');
    console.log('AST nodes:', ast.body.length);
    
    // Check if channel operations are parsed correctly
    if (ast.body[0] && ast.body[0].body) {
        const funcBody = ast.body[0].body.body;
        console.log('Function body statements:', funcBody.length);
    } else {
        console.log('AST structure:', JSON.stringify(ast, null, 2));
    }
    
} catch (error) {
    console.error('\n❌ Parser error:', error.message);
    const lines = code.split('\n');
    if (error.line && error.column) {
        console.error(`Line ${error.line}: ${lines[error.line - 1]}`);
        console.error(' '.repeat(error.column - 1) + '^');
    }
}