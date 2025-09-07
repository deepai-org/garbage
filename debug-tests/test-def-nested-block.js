const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test the nested block case
const code = `def foo
  items.each do |item|
    puts item
  end
end`;

console.log('Testing def with nested do...end block...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('All tokens:');
tokens.forEach((t, i) => {
    console.log(`[${i}] "${t.value}" (${t.type})`);
});

console.log('\n\nKey observations:');
const endTokens = tokens.filter((t, i) => t.value === 'end').map((t, i) => tokens.indexOf(t));
console.log('End token indices:', endTokens);
endTokens.forEach(idx => {
    const prevToken = tokens[idx - 1];
    const nextToken = tokens[idx + 1];
    console.log(`  end[${idx}]: prev="${prevToken?.value}", next="${nextToken?.value}"`);
});

const parser = new Parser(tokens);
try {
    const ast = parser.parse();
    console.log('\nParse result:');
    console.log('AST body:', ast.body.length);
    if (ast.body.length === 0) {
        console.log('❌ ERROR: No function parsed!');
    } else {
        ast.body.forEach(node => {
            console.log(`  ${node.kind}: ${node.name?.name || '(anonymous)'}`);
            if (node.kind === 'FuncDecl') {
                console.log(`    Body statements: ${node.body.statements.length}`);
            }
        });
    }
} catch (e) {
    console.log('Parse error:', e.message);
}