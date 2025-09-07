const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test short declarations
const tests = [
    { name: "Simple short decl", code: "x := 5" },
    { name: "Multiple short decls", code: "results := []\nerrors := []" },
    { name: "In function", code: "function test() { results := [] }" }
];

tests.forEach(test => {
    console.log(`\n=== ${test.name} ===`);
    console.log(`Code: ${test.code}`);
    
    const lexer = new Lexer(test.code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    
    try {
        const ast = parser.parse();
        
        const findShortDecls = (node) => {
            if (!node) return [];
            
            let decls = [];
            if (node.kind === 'ShortDecl') {
                decls.push(node);
            }
            
            for (const key in node) {
                const value = node[key];
                if (value && typeof value === 'object') {
                    if (Array.isArray(value)) {
                        value.forEach(item => {
                            decls = decls.concat(findShortDecls(item));
                        });
                    } else {
                        decls = decls.concat(findShortDecls(value));
                    }
                }
            }
            
            return decls;
        };
        
        const shortDecls = findShortDecls(ast);
        console.log(`  Found ${shortDecls.length} short declarations`);
        shortDecls.forEach(d => {
            if (d.pairs && d.pairs[0]) {
                console.log(`    - ${d.pairs[0].name?.name || 'unknown'} := ...`);
            }
        });
    } catch (e) {
        console.log(`  Error: ${e.message}`);
    }
});