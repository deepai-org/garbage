const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `
results <- result
errors <- e  
done <- true
r := <-results
e := <-errors
<-done
<-time.After(5000)
`;

console.log('Testing channel operations...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    
    // Count channel operations
    let sends = 0;
    let receives = 0;
    
    const findChannelOps = (node) => {
        if (!node) return;
        
        // Channel send: Binary with op '<-'
        if (node.kind === 'Binary' && node.op === '<-') {
            sends++;
            console.log(`Found send: ${node.left?.name || '?'} <- ...`);
        }
        
        // Channel receive: Unary with op '<-'
        if (node.kind === 'Unary' && node.op === '<-') {
            receives++;
            console.log(`Found receive: <-${node.argument?.name || '?'}`);
        }
        
        // Recurse
        for (const key in node) {
            const value = node[key];
            if (value && typeof value === 'object') {
                if (Array.isArray(value)) {
                    value.forEach(findChannelOps);
                } else {
                    findChannelOps(value);
                }
            }
        }
    };
    
    findChannelOps(ast);
    
    console.log(`\nTotal: ${sends} sends, ${receives} receives`);
} catch (e) {
    console.log('Parse error:', e.message);
}