const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test switch statement
const code = `switch (x) {
    case 1:
        console.log("one");
        break;
    case 2:
        console.log("two");
        break;
    default:
        console.log("other");
}`;

console.log('Testing switch statement...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('Parse successful!');
    console.log('AST body:', ast.body.length);
    
    if (ast.body[0]) {
        const node = ast.body[0];
        console.log('Node kind:', node.kind);
        if (node.kind === 'Switch') {
            console.log('  Cases:', node.cases?.length);
        }
    }
} catch (e) {
    console.log('Parse error:', e.message);
    console.log('Stack:', e.stack);
}