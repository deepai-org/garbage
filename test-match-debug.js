const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test match parsing standalone first
const matchOnly = `match x {
  Some(v) if v > 0 => v * 2,
  None => 0,
  _ => -1
}`;

console.log('Testing standalone match:');
try {
  const lexer = new Lexer(matchOnly);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  console.log(`✅ Standalone match works: ${ast.body.length} nodes`);
} catch (e) {
  console.log(`❌ Standalone match fails: ${e.message}`);
}

// Test match in array
const matchInArray = `[
  match x {
    Some(v) if v > 0 => v * 2,
    None => 0,
    _ => -1
  }
]`;

console.log('\nTesting match in array:');
try {
  const lexer = new Lexer(matchInArray);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  console.log(`✅ Match in array works: ${ast.body.length} nodes`);
} catch (e) {
  console.log(`❌ Match in array fails: ${e.message}`);
}

// Test simple comprehension
const simpleComp = `[x * 2 for x in items]`;

console.log('\nTesting simple comprehension:');
try {
  const lexer = new Lexer(simpleComp);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  console.log(`✅ Simple comprehension works: ${ast.body.length} nodes`);
} catch (e) {
  console.log(`❌ Simple comprehension fails: ${e.message}`);
}