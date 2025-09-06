const { Lexer } = require('./dist/lexer');

const code = `def render_list(items)
    <ul>
        <li>test</li>
    </ul>
end`;

console.log('Testing JSX lexing in Ruby def...\n');
console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nAll tokens:');
tokens.forEach((t, i) => {
    if (t.type !== 'EOF' && t.type !== 'NEWLINE') {
        console.log(`  [${i}] ${t.type}: "${t.value}"`);
    }
});