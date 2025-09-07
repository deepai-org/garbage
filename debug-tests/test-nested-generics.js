const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test nested generics with >>
const code = `fn test(x: Option<Result<Vec<T>, Error>>) {}`;

console.log('Testing nested generics...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('All tokens:');
tokens.forEach((t, i) => {
    console.log(`[${i}] "${t.value}" (${t.type})`);
});

const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\nParse result:');
    const node = ast.body[0];
    console.log('Kind:', node.kind);
    if (node.kind === 'FuncDecl') {
        console.log('Name:', node.name.name);
        console.log('Params:', node.params?.length);
        if (node.params && node.params.length > 0) {
            console.log('First param name:', node.params[0].name?.name);
            console.log('First param has type:', !!node.params[0].type);
        }
    }
} catch (e) {
    console.log('\nParse error:', e.message);
}