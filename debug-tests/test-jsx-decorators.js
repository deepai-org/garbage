const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test the failing decorator case
const code = `@observer
class TodoView {
    render() {
        return <div>{this.items}</div>
    }
}`;

console.log('Testing JSX with Python decorators...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens (first 20):');
for (let i = 0; i < Math.min(20, tokens.length); i++) {
    const t = tokens[i];
    console.log(`[${i}] "${t.value}" (${t.type})`);
}

const parser = new Parser(tokens);
try {
    const ast = parser.parse();
    console.log('\nParse result:');
    console.log('AST body length:', ast.body.length);
    ast.body.forEach((node, i) => {
        console.log(`[${i}]: ${node.kind}`);
        if (node.name) {
            console.log(`     Name: ${node.name.name}`);
        }
    });
} catch (e) {
    console.log('Parse error:', e.message);
}