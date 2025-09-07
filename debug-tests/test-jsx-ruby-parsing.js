const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Just the JSX with Ruby block
const code = `<ul>
    {items.each do |item|
        <li>{item.name}</li>
    end}
</ul>`;

console.log('Testing JSX with Ruby block parsing...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Key tokens:');
tokens.forEach((t, i) => {
    if (t.value === 'do' || t.value === 'end' || t.value === '{' || t.value === '}') {
        console.log(`[${i}] "${t.value}" (${t.type})`);
    }
});

const parser = new Parser(tokens);
try {
    const ast = parser.parse();
    console.log('\nParse successful!');
    console.log('AST body:', ast.body.length);
    
    if (ast.body[0]) {
        const jsxElem = ast.body[0].expr;
        console.log('JSX element:', jsxElem.kind);
        console.log('Children:', jsxElem.children?.length);
    }
} catch (e) {
    console.log('Parse error:', e.message);
}