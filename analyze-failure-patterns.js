#!/usr/bin/env node

const fs = require('fs');
const report = JSON.parse(fs.readFileSync('test-failure-analysis.json', 'utf8'));

console.log('📊 FAILURE PATTERN ANALYSIS\n');

// Group failures by pattern
const patterns = {
  emptyAST: [],
  missingProperty: [],
  wrongKind: [],
  unexpectedValue: [],
  other: []
};

report.failures.assertion.forEach(failure => {
  failure.errors.forEach(error => {
    const msg = `${error.expected} | ${error.received}`;
    
    if (msg.includes('ast.body') && msg.includes('toHaveLength')) {
      patterns.emptyAST.push({ file: failure.file, error });
    } else if (msg.includes('toBeDefined()') || msg.includes('undefined')) {
      patterns.missingProperty.push({ file: failure.file, error });
    } else if (msg.includes('toBe(') && msg.includes('kind')) {
      patterns.wrongKind.push({ file: failure.file, error });
    } else if (msg.includes('toContain') || msg.includes('Expected:')) {
      patterns.unexpectedValue.push({ file: failure.file, error });
    } else {
      patterns.other.push({ file: failure.file, error });
    }
  });
});

// Report patterns
console.log('1. EMPTY AST BODY (' + patterns.emptyAST.length + ' failures)');
patterns.emptyAST.slice(0, 3).forEach(p => {
  console.log('   File:', p.file.split('/').pop());
  console.log('   Issue: Code not parsing (likely leading newline)\n');
});

console.log('2. MISSING PROPERTIES (' + patterns.missingProperty.length + ' failures)');
const propGroups = {};
patterns.missingProperty.forEach(p => {
  const prop = p.error.expected.split('.').pop();
  if (!propGroups[prop]) propGroups[prop] = [];
  propGroups[prop].push(p.file.split('/').pop());
});
Object.entries(propGroups).slice(0, 5).forEach(([prop, files]) => {
  console.log(`   Property: ${prop} (${files.length} files)`);
  console.log(`   Files: ${files.join(', ')}\n`);
});

console.log('3. WRONG NODE KIND (' + patterns.wrongKind.length + ' failures)');
patterns.wrongKind.slice(0, 3).forEach(p => {
  console.log('   File:', p.file.split('/').pop());
  console.log('   Expected:', p.error.expected);
  console.log('   Received:', p.error.received, '\n');
});

console.log('4. UNEXPECTED VALUES (' + patterns.unexpectedValue.length + ' failures)');
patterns.unexpectedValue.slice(0, 3).forEach(p => {
  console.log('   File:', p.file.split('/').pop());
  console.log('   Issue:', p.error.expected, '\n');
});

// Summary
console.log('\n📌 TOP ISSUES TO FIX:');
console.log('1. JSX code with leading newlines not parsing');
console.log('2. Missing genericParams on class declarations');
console.log('3. Package declarations not recognized');
console.log('4. Channel type syntax not parsing correctly');
console.log('5. TypeScript+JSX combinations failing');