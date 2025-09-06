const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test class member parsing
const code = `class Test {
  async handle<T>() { }
}`;

console.log('Testing class members...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
    if (t.type !== 'EOF' && t.type !== 'VirtualSemi' && t.value !== '{' && t.value !== '}') {
        console.log(`  [${i}] "${t.value}" (${t.type})`);
    }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nFull AST:', JSON.stringify(ast, null, 2).substring(0, 1500));