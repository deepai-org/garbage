const fs = require('fs');
const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const files = [
  './src/parser.ts',
  './src/lexer.ts', 
  './src/transpiler.ts'
];

let totalErrors = 0;
let totalClasses = 0;
let totalMethods = 0;
let totalFunctions = 0;

console.log('PolyScript Self-Parsing Test');
console.log('=' .repeat(50));

files.forEach(filePath => {
  console.log(`\n📄 ${filePath}`);
  console.log('-'.repeat(40));
  
  const source = fs.readFileSync(filePath, 'utf-8');
  console.log(`  Size: ${(source.length / 1024).toFixed(1)} KB`);
  
  // Tokenize and parse
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  console.log(`  Tokens: ${tokens.length}`);
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  // Count elements
  let classCount = 0;
  let methodCount = 0;
  let functionCount = 0;
  
  function countElements(node) {
    if (node && typeof node === 'object') {
      if (node.kind === 'ClassDecl') {
        classCount++;
      }
      if (node.kind === 'Method' || node.kind === 'Constructor') {
        methodCount++;
      }
      if (node.kind === 'FuncDecl') {
        functionCount++;
      }
      
      for (const key in node) {
        if (node[key]) {
          if (Array.isArray(node[key])) {
            node[key].forEach(child => countElements(child));
          } else if (typeof node[key] === 'object') {
            countElements(node[key]);
          }
        }
      }
    }
  }
  
  countElements(ast);
  
  console.log(`  Classes: ${classCount}`);
  console.log(`  Methods: ${methodCount}`);
  console.log(`  Functions: ${functionCount}`);
  console.log(`  Errors: ${parser.errors.length} ${parser.errors.length === 0 ? '✅' : '❌'}`);
  
  totalErrors += parser.errors.length;
  totalClasses += classCount;
  totalMethods += methodCount;
  totalFunctions += functionCount;
  
  if (parser.errors.length > 0) {
    console.log('  First error:', parser.errors[0].message);
  }
});

console.log('\n' + '='.repeat(50));
console.log('📊 SUMMARY');
console.log('='.repeat(50));
console.log(`Total Classes: ${totalClasses}`);
console.log(`Total Methods: ${totalMethods}`);
console.log(`Total Functions: ${totalFunctions}`);
console.log(`Total Errors: ${totalErrors}`);

if (totalErrors === 0) {
  console.log('\n🎉 SUCCESS: 100% self-parsing achieved!');
  console.log('The PolyScript parser can parse its entire TypeScript implementation!');
} else {
  console.log('\n⚠️ FAILURE: Some parsing errors remain');
}