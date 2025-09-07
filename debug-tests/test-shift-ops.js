const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `result := x ?? y || z && w <=> v << 2 >> 1 >>> 3`;

console.log('Testing shift operators...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
    console.log(`[${i}] "${t.value}" (${t.type})`);
});

const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    
    // Find shift operators
    let shifts = [];
    const findShifts = (node) => {
        if (!node) return;
        
        if (node.kind === 'Binary' && ['<<', '>>', '>>>'].includes(node.op)) {
            shifts.push(node.op);
        }
        
        for (const key in node) {
            const value = node[key];
            if (value && typeof value === 'object') {
                if (Array.isArray(value)) {
                    value.forEach(findShifts);
                } else {
                    findShifts(value);
                }
            }
        }
    };
    
    findShifts(ast);
    
    console.log(`\nFound ${shifts.length} shift operators:`, shifts);
} catch (e) {
    console.log('\nParse error:', e.message);
}