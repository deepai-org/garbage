const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
const RubyComponent = () => {
    const data = [1, 2, 3].map do |x|
        x * 2
    end;
    
    return (
        <div>
            {data.each do |item|
                <span key={item}>{item}</span>
            end}
        </div>
    );
};
`;

console.log('Testing JSX with Ruby blocks...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    console.log('Tokens around JSX expression:');
    let inJsx = false;
    tokens.forEach((t, i) => {
        if (t.type === 'LBRACE' && tokens[i-1] && tokens[i-1].type === 'GT') {
            inJsx = true;
            console.log(`  [${i}] Start JSX expression: ${t.type}`);
        }
        if (inJsx && (t.type === 'DO' || t.type === 'END' || t.type === 'PIPE' || t.type === 'IDENTIFIER')) {
            console.log(`  [${i}] ${t.type}: "${t.value}"`);
        }
        if (inJsx && t.type === 'RBRACE') {
            inJsx = false;
            console.log(`  [${i}] End JSX expression: ${t.type}`);
        }
    });
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed successfully!');
    console.log('AST nodes:', ast.body.length);
    
} catch (error) {
    console.error('\n❌ Parser error:', error.message);
    const lines = code.split('\n');
    if (error.line && error.column) {
        console.error(`Line ${error.line}: ${lines[error.line - 1]}`);
        console.error(' '.repeat(error.column - 1) + '^');
    }
}