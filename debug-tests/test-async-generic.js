const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test async method with generics
const tests = [
    {
        name: "Regular method with generic",
        code: `class Test {
  handle<T>() { }
}`
    },
    {
        name: "Async method with generic",
        code: `class Test {
  async handle<T>() { }
}`
    },
    {
        name: "Full async generic method",
        code: `class WebServer {
  async handle<T>(req: Request, res: Response): Promise<T> {
    return null
  }
}`
    }
];

tests.forEach(test => {
    console.log(`\n=== ${test.name} ===`);
    
    try {
        const lexer = new Lexer(test.code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        if (ast.body.length > 0 && ast.body[0].kind === 'ClassDecl') {
            const cls = ast.body[0];
            console.log('Class:', cls.name.name);
            console.log('Members:', cls.members.length);
            
            if (cls.members.length > 0) {
                const method = cls.members[0];
                console.log('First member:', method.kind);
                
                if (method.kind === 'Method') {
                    console.log('  Name:', method.name?.name);
                    console.log('  Async:', method.async);
                    console.log('  Has genericParams?', !!method.genericParams);
                    console.log('  Has typeParams?', !!method.typeParams);
                    console.log('  Has _genericArgs?', !!method._genericArgs);
                    
                    if (method.genericParams) {
                        console.log('  Generic count:', method.genericParams.length);
                        method.genericParams.forEach((g, i) => {
                            console.log(`    [${i}]: ${g.name}`);
                        });
                    }
                    if (method.typeParams) {
                        console.log('  TypeParam count:', method.typeParams.length);
                        method.typeParams.forEach((g, i) => {
                            console.log(`    [${i}]: ${g.name}`);
                        });
                    }
                }
            }
        }
    } catch (e) {
        console.log('❌ Error:', e.message);
    }
});