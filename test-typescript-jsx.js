const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `interface ButtonProps {
    size: 'small' | 'medium' | 'large'
    variant: string
    onClick?: () => void
}

function Button({ size, variant, onClick }: ButtonProps) {
    return <button className={size} onClick={onClick}>{variant}</button>
}`;

console.log('Code:');
console.log(code);
console.log('\n' + '='.repeat(50) + '\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Show tokens around the function
console.log('Tokens around function keyword:');
for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].value === 'function') {
        for (let j = Math.max(0, i - 2); j < Math.min(tokens.length, i + 10); j++) {
            const t = tokens[j];
            console.log(`  ${j === i ? '>' : ' '} ${j}: ${t.type} "${t.value}"${t.virtualSemi ? ' (virtualSemi)' : ''}`);
        }
        break;
    }
}

console.log('\n' + '='.repeat(50) + '\n');

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST body length:', ast.body.length);
ast.body.forEach((item, i) => {
    console.log(`  ${i}: ${item.kind} - ${item.name?.name || '(no name)'}`);
});

if (ast.body.length < 2) {
    console.log('\n⚠️  Function not parsed! Checking for parse errors...');
    
    // Try parsing just the function
    const funcCode = `function Button({ size }: any) {
    return <button>{size}</button>
}`;
    
    console.log('\nTrying simpler function:');
    console.log(funcCode);
    
    const funcLexer = new Lexer(funcCode);
    const funcTokens = funcLexer.tokenize();
    const funcParser = new Parser(funcTokens);
    const funcAst = funcParser.parse();
    
    console.log('Simple function AST body length:', funcAst.body.length);
    funcAst.body.forEach((item, i) => {
        console.log(`  ${i}: ${item.kind} - ${item.name?.name || '(no name)'}`);
    });
}