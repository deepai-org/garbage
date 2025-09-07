const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test different using patterns
const tests = [
    {
        name: "Using with block",
        code: `using file = openFile("data.txt") {
    console.log(file)
}`
    },
    {
        name: "Using standalone (C# style)",
        code: `using file = openFile("data.txt")`
    },
    {
        name: "Using with Python as",
        code: `with openFile("data.txt") as file:
    print(file)`
    }
];

tests.forEach(test => {
    console.log(`\n=== ${test.name} ===`);
    console.log(`Code: ${test.code.replace(/\n/g, '\\n')}`);
    
    try {
        const lexer = new Lexer(test.code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        console.log('Parse successful!');
        console.log('AST body:', ast.body.length);
        if (ast.body[0]) {
            console.log('Statement kind:', ast.body[0].kind);
        }
    } catch (e) {
        console.log('Parse error:', e.message);
    }
});