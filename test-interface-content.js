const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `interface ButtonProps {
    size: string
}

function Button() {
    return null
}`;

console.log('Code:');
console.log(code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nTokens from interface close to function:');
for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].value === '}' && i < tokens.length - 5) {
        for (let j = i; j < Math.min(tokens.length, i + 8); j++) {
            const t = tokens[j];
            console.log(`  ${j}: ${t.type} "${t.value}"${t.virtualSemi ? ' (virtualSemi)' : ''}`);
        }
        break;
    }
}

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nAST body length:', ast.body.length);
ast.body.forEach((item, i) => {
    console.log(`  ${i}: ${item.kind} - ${item.name?.name || '(no name)'}`);
});