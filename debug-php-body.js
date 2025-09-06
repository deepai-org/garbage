const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test PHP-style JSX
const code = `
function renderTemplate($title, $items) {
    return (
        <div>
            <h1>{$title}</h1>
            {$items->map($item => 
                <li>{$item->name}</li>
            )}
        </div>
    )
}`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Check tokens
console.log('Key tokens:');
let inFunc = false;
tokens.forEach((t, i) => {
    if (t.value === 'renderTemplate') inFunc = true;
    if (t.value === '}' && inFunc) inFunc = false;
    
    if (inFunc && (t.value === '<' || t.value === '>' || t.value === 'div' || t.value === 'h1' || t.value === 'li')) {
        console.log(`[${i}]: ${t.type}:${t.value}`);
    }
});

const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    const func = ast.body[0];
    
    if (func && func.body) {
        console.log('\nFunction body:', func.body.kind);
        console.log('Statements:', func.body.statements?.length);
        
        func.body.statements?.forEach((stmt, i) => {
            console.log(`\nStatement ${i}:`, stmt.kind);
            if (stmt.kind === 'Return') {
                console.log('  Return values:', stmt.values?.length);
                stmt.values?.forEach((val, j) => {
                    console.log(`  Value ${j}:`, val.kind);
                    if (val.kind === 'JSXElement') {
                        console.log('    JSX tag:', val.openingElement?.name?.name);
                    }
                });
            }
        });
    }
} catch (e) {
    console.log('Parse error:', e.message);
}