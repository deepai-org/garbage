const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `function test(arr: []string) {}`;

console.log('Testing bracket array type...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Key tokens:');
for (let i = 0; i < tokens.length && i < 12; i++) {
    console.log(`[${i}] "${tokens[i].value}" (${tokens[i].type})`);
}

const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\nAST body length:', ast.body.length);
    if (ast.body[0]) {
        console.log('First node:', ast.body[0].kind);
        if (ast.body[0].kind === 'FuncDecl') {
            const func = ast.body[0];
            console.log('Function name:', func.name?.name);
            console.log('Params:', func.params?.length);
            if (func.params?.[0]) {
                console.log('First param name:', func.params[0].name?.name);
                console.log('First param type:', func.params[0].type);
            }
        }
    }
} catch (e) {
    console.log('\nParse error:', e.message);
}