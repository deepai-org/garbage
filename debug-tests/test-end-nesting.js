const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test with detailed token tracking
const code = `def render_list(items)
    <ul>
        {items.each do |item|
            <li>{item.name}</li>
        end}
    </ul>
end`;

console.log('Testing nested end tokens...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Find all 'end' tokens with context
console.log('End tokens with context:');
tokens.forEach((t, i) => {
    if (t.value === 'end') {
        const prev = tokens[i-1];
        const next = tokens[i+1];
        console.log(`\nEnd at index ${i} (line ${t.line}, col ${t.column}):`);
        console.log(`  Previous token: "${prev?.value}" (${prev?.type})`);
        console.log(`  Next token: "${next?.value}" (${next?.type})`);
    }
});

// Check if parser is handling nested structures
console.log('\n\nParsing...');
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('Parse successful!');
    console.log('AST body:', ast.body.length);
    
    if (ast.body[0]?.kind === 'FuncDecl') {
        const func = ast.body[0];
        console.log('\nFunction analysis:');
        console.log('  Name:', func.name.name);
        console.log('  Body statements:', func.body.statements.length);
        
        if (func.body.statements.length > 0) {
            func.body.statements.forEach((stmt, i) => {
                console.log(`  Statement[${i}]:`, stmt.kind);
            });
        }
    }
} catch (e) {
    console.log('Parse error:', e.message);
}