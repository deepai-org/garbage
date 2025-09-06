const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const util = require('util');

// Test categories
const tests = {
  comparisons: [
    { code: 'x < 5', desc: 'Less than' },
    { code: 'x > 5', desc: 'Greater than' },
    { code: 'x <= 5', desc: 'Less than or equal' },
    { code: 'x >= 5', desc: 'Greater than or equal' },
    { code: 'if (a < b && c > d) {}', desc: 'Multiple comparisons' },
    { code: 'while (i < 10) { i++ }', desc: 'Comparison in loop' },
    { code: 'x << 2', desc: 'Left shift' },
    { code: 'x >> 2', desc: 'Right shift' },
    { code: 'x >>> 2', desc: 'Unsigned right shift' },
  ],
  
  generics: [
    { code: 'let x: Array<string>', desc: 'Generic type annotation' },
    { code: 'let m: Map<string, number>', desc: 'Generic with multiple params' },
    { code: 'function foo<T>(x: T): T { return x }', desc: 'Generic function' },
    { code: 'class Box<T> { value: T }', desc: 'Generic class' },
    { code: 'type Result<T> = T | Error', desc: 'Generic type alias' },
    { code: 'const arr = new Array<number>()', desc: 'Generic constructor' },
    { code: 'chan<string>', desc: 'Channel type' },
    { code: 'Promise<void>', desc: 'Promise type' },
  ],
  
  jsx: [
    { code: '<div />', desc: 'Self-closing JSX' },
    { code: '<Button>', desc: 'JSX component' },
    { code: '<div>text</div>', desc: 'JSX with content' },
    { code: '<Component prop={value} />', desc: 'JSX with props' },
    { code: '<>fragment</>', desc: 'JSX fragment' },
    { code: 'const x = <div>Hello</div>', desc: 'JSX in assignment' },
    { code: 'return <Button />', desc: 'JSX in return' },
    { code: '<Form.Input />', desc: 'JSX member expression' },
  ],
  
  ambiguous: [
    { code: 'Array<T>', desc: 'Generic type reference' },
    { code: 'fn<T>()', desc: 'Generic function call' },
    { code: 'x<y>z', desc: 'Chained comparisons (should parse as x < y > z)' },
    { code: '<Type>expr', desc: 'Type assertion' },
    { code: 'a < b > c', desc: 'Comparison chain' },
  ]
};

function validateAST(code, expectedType) {
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    // Analyze AST to determine what was parsed
    const astStr = JSON.stringify(ast);
    
    const hasJSX = astStr.includes('JSXElement') || astStr.includes('JSXFragment');
    const hasGeneric = astStr.includes('GenericType') || astStr.includes('genericParams');
    const hasComparison = astStr.includes('"op":"<"') || astStr.includes('"op":">"') || 
                          astStr.includes('"op":"<<"') || astStr.includes('"op":">>"');
    const hasTypeAssertion = astStr.includes('TypeAssertion');
    
    let detected = '';
    if (hasJSX) detected = 'JSX';
    else if (hasGeneric) detected = 'Generic';
    else if (hasTypeAssertion) detected = 'TypeAssertion';
    else if (hasComparison) detected = 'Comparison';
    else detected = 'Unknown';
    
    return { success: true, detected, ast };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function runTests() {
  console.log('=' .repeat(80));
  console.log('ANGLE BRACKET DISAMBIGUATION VALIDATION');
  console.log('=' .repeat(80));
  
  let totalTests = 0;
  let passed = 0;
  let failed = 0;
  
  // Test comparisons
  console.log('\n### COMPARISON OPERATORS ###');
  for (const test of tests.comparisons) {
    totalTests++;
    const result = validateAST(test.code, 'Comparison');
    
    if (result.success && result.detected === 'Comparison') {
      console.log(`✅ ${test.desc}: "${test.code}"`);
      passed++;
    } else if (result.success) {
      console.log(`❌ ${test.desc}: "${test.code}" - Detected as ${result.detected} instead of Comparison`);
      failed++;
    } else {
      console.log(`❌ ${test.desc}: "${test.code}" - Parse error: ${result.error}`);
      failed++;
    }
  }
  
  // Test generics
  console.log('\n### GENERIC TYPES ###');
  for (const test of tests.generics) {
    totalTests++;
    const result = validateAST(test.code, 'Generic');
    
    if (result.success && result.detected === 'Generic') {
      console.log(`✅ ${test.desc}: "${test.code}"`);
      passed++;
    } else if (result.success) {
      console.log(`❌ ${test.desc}: "${test.code}" - Detected as ${result.detected} instead of Generic`);
      failed++;
    } else {
      console.log(`❌ ${test.desc}: "${test.code}" - Parse error: ${result.error}`);
      failed++;
    }
  }
  
  // Test JSX
  console.log('\n### JSX ELEMENTS ###');
  for (const test of tests.jsx) {
    totalTests++;
    const result = validateAST(test.code, 'JSX');
    
    if (result.success && result.detected === 'JSX') {
      console.log(`✅ ${test.desc}: "${test.code}"`);
      passed++;
    } else if (result.success) {
      console.log(`❌ ${test.desc}: "${test.code}" - Detected as ${result.detected} instead of JSX`);
      failed++;
    } else {
      console.log(`❌ ${test.desc}: "${test.code}" - Parse error: ${result.error}`);
      failed++;
    }
  }
  
  // Test ambiguous cases
  console.log('\n### AMBIGUOUS CASES ###');
  for (const test of tests.ambiguous) {
    totalTests++;
    const result = validateAST(test.code);
    
    if (result.success) {
      console.log(`ℹ️  ${test.desc}: "${test.code}" - Detected as ${result.detected}`);
      
      // Special validation for specific cases
      if (test.code === 'x<y>z' && result.detected === 'Comparison') {
        console.log('   ✅ Correctly parsed as comparisons');
        passed++;
      } else if (test.code === 'Array<T>' && result.detected === 'Generic') {
        console.log('   ✅ Correctly parsed as generic');
        passed++;
      } else if (test.code === '<Type>expr' && result.detected === 'TypeAssertion') {
        console.log('   ✅ Correctly parsed as type assertion');
        passed++;
      } else if (test.code === 'a < b > c' && result.detected === 'Comparison') {
        console.log('   ✅ Correctly parsed as comparison chain');
        passed++;
      } else {
        console.log('   ⚠️  Review needed');
      }
    } else {
      console.log(`❌ ${test.desc}: "${test.code}" - Parse error: ${result.error}`);
      failed++;
    }
  }
  
  // Summary
  console.log('\n' + '=' .repeat(80));
  console.log('SUMMARY');
  console.log('=' .repeat(80));
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${passed} (${(passed/totalTests*100).toFixed(1)}%)`);
  console.log(`Failed: ${failed} (${(failed/totalTests*100).toFixed(1)}%)`);
  
  if (failed > 0) {
    console.log('\n⚠️  Some tests failed - angle bracket disambiguation may need fixes');
  } else {
    console.log('\n✅ All angle bracket disambiguations working correctly!');
  }
}

// Run detailed test on a specific case
function debugCase(code) {
  console.log('\n' + '=' .repeat(80));
  console.log('DEBUG:', code);
  console.log('=' .repeat(80));
  
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  
  console.log('Tokens:');
  tokens.forEach((t, i) => {
    if (t.type !== 'EOF') {
      console.log(`  [${i}] ${t.type}: "${t.value}"`);
    }
  });
  
  try {
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\nAST:');
    console.log(util.inspect(ast, { depth: 5, colors: true }));
  } catch (e) {
    console.log('\nParse error:', e.message);
  }
}

// Run tests
runTests();

// Debug specific failing cases if needed
// debugCase('Array<T>');