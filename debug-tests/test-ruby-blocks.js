const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test Ruby blocks in different contexts
const tests = [
    {
        name: "Ruby block alone",
        code: `users.each { |user| process(user) }`
    },
    {
        name: "Ruby block in JSX",
        code: `<div>
  {users.each { |user| process(user) }}
</div>`
    },
    {
        name: "Ruby do...end block",
        code: `users.each do |user|
  process(user)
end`
    },
    {
        name: "Ruby do...end in JSX",
        code: `<div>
  {users.each do |user|
    process(user)
  end}
</div>`
    }
];

tests.forEach(test => {
    console.log(`\n=== ${test.name} ===`);
    
    try {
        const lexer = new Lexer(test.code);
        const tokens = lexer.tokenize();
        
        // Show some tokens
        console.log('Key tokens:');
        for (let i = 0; i < Math.min(15, tokens.length); i++) {
            if (['each', '{', '|', 'do', 'end', '<', '>', 'div'].includes(tokens[i].value)) {
                console.log(`  [${i}] ${tokens[i].value} (${tokens[i].type})`);
            }
        }
        
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        console.log('AST nodes:', ast.body.length);
        const node = ast.body[0];
        console.log('First node:', node?.kind);
        
        if (node?.kind === 'JSXElement') {
            console.log('  Tag:', node.tag.name);
            console.log('  Children:', node.children?.length || 0);
            if (node.children?.length > 0) {
                console.log('  First child:', node.children[0].kind);
            }
        }
    } catch (e) {
        console.log('❌ Error:', e.message);
    }
});