const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
function process<T, U>(data: Stream<T>) {
  const jsx = <Button onClick={() => x < 5} />;
  const shifted = bits << 2 >> 1;
  const chan = <-ch;
  ch <- value;
  
  if (a < b && c > d) {
    return <Result<Vec<T>, Error>>{
      ok: true,
      value: data
    };
  }
}
`;

console.log('Parsing mixed angle bracket code...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
  const ast = parser.parse();
  
  // Count different types
  let jsxCount = 0;
  let comparisons = 0;
  let shifts = 0;
  
  function analyze(node) {
    if (!node || typeof node !== 'object') return;
    
    if (node.kind === 'JSXElement') {
      jsxCount++;
      const tag = node.openingElement?.name?.name || 'unknown';
      console.log(`Found JSX: <${tag}>`);
    } else if (node.kind === 'Binary') {
      if (['<', '>', '<=', '>='].includes(node.op)) {
        comparisons++;
        console.log(`Found comparison: ${node.op}`);
      } else if (['<<', '>>', '>>>'].includes(node.op)) {
        shifts++;
        console.log(`Found shift: ${node.op}`);
      }
    }
    
    for (const key in node) {
      if (key === 'span') continue;
      const value = node[key];
      if (Array.isArray(value)) {
        value.forEach(analyze);
      } else if (value && typeof value === 'object') {
        analyze(value);
      }
    }
  }
  
  analyze(ast);
  
  console.log('\nSummary:');
  console.log(`JSX elements: ${jsxCount}`);
  console.log(`Comparisons: ${comparisons}`);
  console.log(`Shift operators: ${shifts}`);
} catch (e) {
  console.log('Parse error:', e.message);
}
