const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test complex expression with multiple angle bracket types
const code = `function process() {
    const stream: Stream<T> = source<Data>();
    if (x < y && y > z) {
        send(chan <- value);
        shift = a << 2;
    }
    return <Component<Props> />;
}`;

console.log('Testing complex angle bracket disambiguation...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('Parse successful!');
    
    // Count different types of angle bracket usage
    function countNodes(node, predicate) {
        let count = 0;
        function walk(n) {
            if (!n) return;
            if (predicate(n)) count++;
            for (let key in n) {
                if (key !== 'span' && typeof n[key] === 'object') {
                    if (Array.isArray(n[key])) {
                        n[key].forEach(walk);
                    } else {
                        walk(n[key]);
                    }
                }
            }
        }
        walk(node);
        return count;
    }
    
    const genericTypes = countNodes(ast, n => n && n.kind === 'GenericType');
    const jsxElements = countNodes(ast, n => n && n.kind === 'JSXElement');
    const comparisons = countNodes(ast, n => n && n.kind === 'Binary' && (n.op === '<' || n.op === '>'));
    const channels = countNodes(ast, n => n && n.kind === 'Binary' && n.op === '<-');
    
    console.log('\nCounts:');
    console.log('  Generic types:', genericTypes);
    console.log('  JSX elements:', jsxElements);
    console.log('  Comparisons:', comparisons);
    console.log('  Channel ops:', channels);
    
} catch (e) {
    console.log('Parse error:', e.message);
}