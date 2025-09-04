const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test type predicate functions with 'is' keyword
const code = `
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(x: any): x is number {
  return typeof x === 'number';
}

const hasName = (obj: any): obj is { name: string } => {
  return obj && typeof obj.name === 'string';
};

class TypeChecker {
  static isArray(val: unknown): val is Array<any> {
    return Array.isArray(val);
  }
  
  isValid(item: unknown): item is ValidItem {
    return item !== null;
  }
}
`;

console.log('Testing type predicates with "is" keyword:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Show tokens around first 'is'
let firstIs = -1;
tokens.forEach((t, i) => {
  if (t.value === 'is' && firstIs === -1) {
    firstIs = i;
    console.log('\nTokens around first "is":');
    for (let j = Math.max(0, i-3); j <= Math.min(tokens.length-1, i+3); j++) {
      if (tokens[j].type !== 'EOF') {
        console.log(`  [${j}] ${tokens[j].type}:${tokens[j].value}`);
      }
    }
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  console.log('First 5 errors:');
  parser.errors.slice(0, 5).forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
} else {
  console.log('Success!');
}