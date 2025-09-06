#!/usr/bin/env node

/**
 * Analyzes which fixes would have the highest impact on test pass rate
 */

const fs = require('fs');

// Read the test failure analysis
const report = JSON.parse(fs.readFileSync('test-failure-analysis.json', 'utf8'));

console.log('🎯 FIX IMPACT ANALYSIS\n');
console.log('=' .repeat(60));

// Count failures by category
const categories = {
  jsxVirtualSemicolon: 0,
  emptyASTBody: 0,
  missingGenerics: 0,
  packageDecl: 0,
  goStatements: 0,
  decorators: 0,
  other: 0
};

// Analyze each failure
report.failures.assertion.forEach(failure => {
  const file = failure.file;
  
  failure.errors.forEach(error => {
    const msg = `${error.expected} ${error.received}`.toLowerCase();
    
    if (file.includes('jsx') && msg.includes('ast.body') && msg.includes('tohavelength')) {
      categories.jsxVirtualSemicolon++;
      categories.emptyASTBody++;
    } else if (msg.includes('genericparams')) {
      categories.missingGenerics++;
    } else if (msg.includes('packagedecl') || msg.includes('package')) {
      categories.packageDecl++;
    } else if (msg.includes('go ') || msg.includes('defer')) {
      categories.goStatements++;
    } else if (msg.includes('decorator')) {
      categories.decorators++;
    } else {
      categories.other++;
    }
  });
});

// Also count runtime errors (usually JSX related)
report.failures.runtime.forEach(failure => {
  if (failure.file.includes('jsx')) {
    categories.jsxVirtualSemicolon++;
  }
});

// Calculate impact
const totalFailures = Object.values(categories).reduce((a, b) => a + b, 0);

console.log('\n📊 FAILURE CATEGORIES:\n');
const sorted = Object.entries(categories)
  .sort((a, b) => b[1] - a[1])
  .filter(([_, count]) => count > 0);

sorted.forEach(([category, count]) => {
  const percentage = ((count / totalFailures) * 100).toFixed(1);
  const bar = '█'.repeat(Math.floor(count * 2));
  console.log(`${category.padEnd(20)} ${count.toString().padStart(3)} (${percentage}%) ${bar}`);
});

console.log('\n🔧 RECOMMENDED FIX ORDER:\n');

const fixes = [
  {
    name: 'Virtual Semicolon in JSX',
    impact: categories.jsxVirtualSemicolon + categories.emptyASTBody,
    effort: 'Medium',
    files: ['src/lexer.ts'],
    description: 'Fix lexer to not insert virtual semicolons inside JSX'
  },
  {
    name: 'Class Generic Parameters',
    impact: categories.missingGenerics,
    effort: 'Low',
    files: ['src/parser.ts', 'src/ast.ts'],
    description: 'Rename typeParams to genericParams or add both'
  },
  {
    name: 'Package Declarations',
    impact: categories.packageDecl,
    effort: 'Low',
    files: ['src/parser.ts', 'src/ast.ts'],
    description: 'Add package declaration parsing'
  },
  {
    name: 'Go Statements',
    impact: categories.goStatements,
    effort: 'Medium',
    files: ['src/parser.ts', 'src/ast.ts'],
    description: 'Implement go and defer statement parsing'
  },
  {
    name: 'Decorators',
    impact: categories.decorators,
    effort: 'Medium',
    files: ['src/parser.ts', 'src/ast.ts'],
    description: 'Fix decorator parsing and AST nodes'
  }
];

fixes.sort((a, b) => b.impact - a.impact);

fixes.forEach((fix, i) => {
  console.log(`\n${i + 1}. ${fix.name}`);
  console.log(`   Impact: ${fix.impact} failures fixed`);
  console.log(`   Effort: ${fix.effort}`);
  console.log(`   Files: ${fix.files.join(', ')}`);
  console.log(`   Description: ${fix.description}`);
});

console.log('\n📈 EXPECTED OUTCOMES:\n');

let cumulative = 0;
let testsPassing = 287; // Current passing tests

fixes.slice(0, 3).forEach(fix => {
  cumulative += fix.impact;
  testsPassing += fix.impact;
  const percentage = ((testsPassing / 307) * 100).toFixed(1);
  console.log(`After "${fix.name}": ~${testsPassing}/307 tests (${percentage}%)`);
});

console.log('\n✨ QUICK WINS:\n');
console.log('1. Fix class genericParams (Low effort, immediate impact)');
console.log('2. Add package declaration support (Low effort, fixes multiple tests)');
console.log('3. Update test compatibility layer for remaining mismatches');

console.log('\n🎯 CRITICAL PATH:\n');
console.log('1. Virtual Semicolon Fix -> Unlocks all JSX tests');
console.log('2. Generic Parameters -> Fixes TypeScript tests');
console.log('3. Package/Go/Defer -> Fixes polyglot tests');
console.log('\n=> These 3 fixes should get us to ~98% pass rate');

console.log('\n' + '='.repeat(60));
console.log('RECOMMENDATION: Start with Virtual Semicolon fix for highest impact');
console.log('=' .repeat(60));