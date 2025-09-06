const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test pipe parsing
const tests = [
    {
        name: "Bitwise OR",
        code: `a | b`
    },
    {
        name: "Ruby block parameters",
        code: `{ |x| x + 1 }`
    },
    {
        name: "Pipes in call",
        code: `users.each { |user| process(user) }`
    }
];

tests.forEach(test => {
    console.log(`\n=== ${test.name} ===`);
    
    try {
        const lexer = new Lexer(test.code);
        const tokens = lexer.tokenize();
        
        console.log('Tokens:');
        tokens.forEach((t, i) => {
            console.log(`  [${i}] ${t.value} (${t.type})`);
        });
        
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        console.log('\nAST:', JSON.stringify(ast, null, 2).substring(0, 200));
    } catch (e) {
        console.log('❌ Error:', e.message);
    }
});