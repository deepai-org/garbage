const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `a << 2 >> 1 >>> 3`;

console.log('Testing shift operator order...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    
    // Find shift operators in order
    let shifts = [];
    const findShiftsInOrder = (node, depth = 0) => {
        if (!node) return;
        
        if (node.kind === 'Binary' && ['<<', '>>', '>>>'].includes(node.op)) {
            console.log(`${'  '.repeat(depth)}Found ${node.op} at depth ${depth}`);
            shifts.push({ op: node.op, depth });
        }
        
        // Visit left first, then right (in-order traversal)
        if (node.left) findShiftsInOrder(node.left, depth + 1);
        if (node.right) findShiftsInOrder(node.right, depth + 1);
        
        // Also check other properties
        for (const key in node) {
            if (key === 'left' || key === 'right') continue;
            const value = node[key];
            if (value && typeof value === 'object') {
                if (Array.isArray(value)) {
                    value.forEach(v => findShiftsInOrder(v, depth + 1));
                } else if (value.kind) {
                    findShiftsInOrder(value, depth + 1);
                }
            }
        }
    };
    
    findShiftsInOrder(ast);
    
    console.log(`\nShift operators in traversal order:`, shifts.map(s => s.op));
} catch (e) {
    console.log('\nParse error:', e.message);
}