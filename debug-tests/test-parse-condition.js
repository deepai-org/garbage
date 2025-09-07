const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Add logging to understand the parse flow
const code = `def foo
  items.each do |item|
    puts item
  end
end`;

console.log('Testing parse flow with endCount logic...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Show where we expect parsing to stop
console.log('Tokens:');
tokens.forEach((t, i) => {
    if (i === 15) {
        console.log(`[${i}] "${t.value}" (${t.type}) <- EXPECTED FUNCTION END`);
    } else if (t.value === 'do' || t.value === 'end' || t.value === 'def') {
        console.log(`[${i}] "${t.value}" (${t.type})`);
    }
});

console.log('\nParsing...');
const parser = new Parser(tokens);

// Add some reflection to see internal state
console.log('Initial parser.current:', parser.current);

try {
    const ast = parser.parse();
    console.log('\nParse result:');
    console.log('AST body:', ast.body.length);
    if (ast.body.length === 0) {
        console.log('❌ Parser stopped too early or failed to parse function');
    } else {
        ast.body.forEach(node => {
            console.log(`  ${node.kind}: ${node.name?.name || '(anonymous)'}`);
        });
    }
} catch (e) {
    console.log('Parse error:', e.message);
}