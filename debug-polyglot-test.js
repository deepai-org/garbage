const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code1 = `
# Mixing all operator styles
result := x ?? y || z && w <=> v << 2 >> 1 >>> 3
`;

console.log('Test 1: Operator mixing');
console.log('Code:', code1);

try {
  const lexer = new Lexer(code1);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('AST body length:', ast.body.length);
  if (ast.body[0]) {
    console.log('First statement:', JSON.stringify(ast.body[0], null, 2));
  }
} catch (e) {
  console.log('Error:', e.message);
}

console.log('\n-------------------\n');

const code2 = `
match value {
  Some(x) if x > 0 => {
    print("positive")
  }
}
`;

console.log('Test 2: Pattern matching');
console.log('Code:', code2);

try {
  const lexer = new Lexer(code2);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('AST body length:', ast.body.length);
  
  // Find comparisons
  function findComparisons(node) {
    const results = [];
    
    function traverse(n) {
      if (n && typeof n === 'object') {
        if (n.kind === 'Binary' && ['<', '>', '<=', '>='].includes(n.op)) {
          results.push(n);
        }
        for (const key in n) {
          if (n[key] && typeof n[key] === 'object') {
            if (Array.isArray(n[key])) {
              n[key].forEach(traverse);
            } else {
              traverse(n[key]);
            }
          }
        }
      }
    }
    
    traverse(node);
    return results;
  }
  
  const comparisons = findComparisons(ast);
  console.log('Comparisons found:', comparisons.length);
  if (comparisons[0]) {
    console.log('First comparison:', comparisons[0]);
  }
} catch (e) {
  console.log('Error:', e.message);
}