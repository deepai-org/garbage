const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test what happens after parsing 'def foo()'
const code = `def foo
  puts "hello"
end`;

console.log('Testing def parsing flow...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens after def foo:');
for (let i = 0; i < Math.min(10, tokens.length); i++) {
    const t = tokens[i];
    console.log(`[${i}] "${t.value}" (${t.type})`);
}

// Check what comes after the parameters
console.log('\nAfter "def foo", next tokens are:');
// def=0, foo=1, then what?
console.log('Token[2]:', tokens[2] ? `"${tokens[2].value}" (${tokens[2].type})` : 'EOF');
console.log('Token[3]:', tokens[3] ? `"${tokens[3].value}" (${tokens[3].type})` : 'EOF');

// Now parse
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nParsing result:');
console.log('AST body length:', ast.body.length);
ast.body.forEach((node, i) => {
    console.log(`[${i}]: ${node.kind}`);
});