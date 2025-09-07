const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test Python-style class with decorator
const code = `@observer
@inject('store')
class TodoView:
    def render(self):
        return (
            <div>
                <h1>{self.store.title}</h1>
            </div>
        )`;

console.log('Testing Python-style class...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('First 15 tokens:');
for (let i = 0; i < Math.min(15, tokens.length); i++) {
    console.log(`[${i}] "${tokens[i].value}" (${tokens[i].type})`);
}

const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\nParse result:');
    console.log('AST body:', ast.body.length);
    ast.body.forEach((node, i) => {
        console.log(`[${i}]: ${node.kind} - ${node.name?.name || '(anonymous)'}`);
    });
} catch (e) {
    console.log('\nParse error:', e.message);
}