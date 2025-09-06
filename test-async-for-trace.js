const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
async for await (const item of input) {
  select {
    case x:
      continue
  }
}
`;

console.log('Tracing async for await parsing...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
    if (t.type !== 'EOF' && t.type !== 'NEWLINE') {
        const marker = t.type === 'VirtualSemi' ? '[VSEMI]' : `${t.type}: "${t.value}"`;
        console.log(`  [${i}] ${marker}`);
    }
});

// Manually trace the parsing
console.log('\nParsing trace:');
console.log('1. parseStatement sees "async" at [0] and "for" at [1]');
console.log('2. Consumes both, calls parseLoop()');
console.log('3. parseLoop sees previous="for", checks for "await" at [2]');
console.log('4. isAwait=true, expects "(" at [3]');
console.log('5. Expects const/let/var at [4]');
console.log('6. Gets variable "item" at [5]');
console.log('7. Expects "of" at [6]');
console.log('8. Gets iterable "input" at [7]');
console.log('9. Expects ")" at [8]');
console.log('10. Calls parseBlock() expecting "{" at [9]');

try {
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed successfully');
    console.log('Result:', JSON.stringify(ast, null, 2));
} catch (error) {
    console.error('\n❌ Parse error:', error.message);
}