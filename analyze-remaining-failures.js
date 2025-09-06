#!/usr/bin/env node

const { execSync } = require('child_process');

// Run tests and capture output (allow failure)
let output;
try {
  output = execSync('npm test 2>&1', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).toString();
} catch (e) {
  output = e.stdout || e.output.join('');
}

// Parse test results
const failurePatterns = {
  channelTypes: [],
  angleBreaketsJSX: [],
  complexPolyglot: [],
  typeAssertions: [],
  decorators: [],
  other: []
};

// Extract failure details
const lines = output.split('\n');
let currentTest = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Track current test
  if (line.includes('● ')) {
    currentTest = line.substring(line.indexOf('● ') + 2);
    
    // Categorize failures
    if (currentTest.toLowerCase().includes('channel')) {
      failurePatterns.channelTypes.push(currentTest);
    } else if (currentTest.toLowerCase().includes('angle') || 
               (currentTest.toLowerCase().includes('jsx') && currentTest.toLowerCase().includes('generic'))) {
      failurePatterns.angleBreaketsJSX.push(currentTest);
    } else if (currentTest.toLowerCase().includes('polyglot')) {
      failurePatterns.complexPolyglot.push(currentTest);
    } else if (currentTest.toLowerCase().includes('assertion')) {
      failurePatterns.typeAssertions.push(currentTest);
    } else if (currentTest.toLowerCase().includes('decorator')) {
      failurePatterns.decorators.push(currentTest);
    } else {
      failurePatterns.other.push(currentTest);
    }
  }
}

// Remove duplicates
for (const key in failurePatterns) {
  failurePatterns[key] = [...new Set(failurePatterns[key])];
}

// Generate report
console.log('='.repeat(60));
console.log('REMAINING FAILURES ANALYSIS (16 failures)');
console.log('='.repeat(60));
console.log('\n📊 FAILURE BREAKDOWN:\n');

const categories = [
  { name: '🔧 Channel Types', failures: failurePatterns.channelTypes, fix: 'Implement channel type parsing (Go-style)' },
  { name: '📐 Angle Brackets/JSX', failures: failurePatterns.angleBreaketsJSX, fix: 'Improve JSX depth tracking and angle bracket disambiguation' },
  { name: '🌐 Complex Polyglot', failures: failurePatterns.complexPolyglot, fix: 'Handle edge cases in mixed language constructs' },
  { name: '🎯 Type Assertions', failures: failurePatterns.typeAssertions, fix: 'Disambiguate <Type> assertions from JSX' },
  { name: '🎨 Decorators', failures: failurePatterns.decorators, fix: 'Add decorator support to AST' },
  { name: '📦 Other', failures: failurePatterns.other, fix: 'Various edge cases' }
];

let totalFailures = 0;
categories.forEach(cat => {
  if (cat.failures.length > 0) {
    console.log(`${cat.name}: ${cat.failures.length} failures`);
    console.log(`  Fix: ${cat.fix}`);
    cat.failures.slice(0, 2).forEach(f => console.log(`    • ${f.substring(0, 70)}${f.length > 70 ? '...' : ''}`));
    if (cat.failures.length > 2) {
      console.log(`    ... and ${cat.failures.length - 2} more`);
    }
    console.log();
    totalFailures += cat.failures.length;
  }
});

console.log('='.repeat(60));
console.log(`TOTAL: ${totalFailures} unique test failures`);
console.log('='.repeat(60));

console.log('\n🎯 PRIORITIZED FIX PLAN:\n');

const fixes = [
  { 
    priority: 1,
    name: 'Channel Types',
    effort: 'Low (30 min)',
    impact: '2 tests',
    description: 'Add chan<T> type parsing to parseTypeAnnotation()'
  },
  {
    priority: 2,
    name: 'JSX Depth Tracking Refinement',
    effort: 'Medium (1-2 hours)',
    impact: '5-6 tests',
    description: 'Improve JSX context tracking for fragments and self-closing tags'
  },
  {
    priority: 3,
    name: 'Angle Bracket Lookahead',
    effort: 'Medium (1 hour)',
    impact: '3-4 tests',
    description: 'Better distinguish <Type> assertions from <Component> JSX'
  },
  {
    priority: 4,
    name: 'Complex Polyglot Patterns',
    effort: 'High (2-3 hours)',
    impact: '4-5 tests',
    description: 'Handle extreme nesting and mixed paradigms'
  },
  {
    priority: 5,
    name: 'Decorator Support',
    effort: 'Low (30 min)',
    impact: '1-2 tests',
    description: 'Add decorator field to class/method nodes'
  }
];

fixes.forEach(fix => {
  console.log(`${fix.priority}. ${fix.name}`);
  console.log(`   Effort: ${fix.effort}`);
  console.log(`   Impact: ${fix.impact}`);
  console.log(`   ${fix.description}`);
  console.log();
});

console.log('💡 NEXT IMMEDIATE ACTION:');
console.log('Start with Channel Types - it\'s a quick win that will get us to 293/307 (95.4%)');
