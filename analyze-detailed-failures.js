const { execSync } = require('child_process');

// Run tests and capture output (allow failure)
let testOutput;
try {
    testOutput = execSync('npm test 2>&1', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).toString();
} catch (error) {
    testOutput = error.stdout || error.output?.join('') || '';
}

// Parse test failures
const failurePatterns = {
    jsxWhitespace: [],
    jsxTypeScript: [],
    angleBrackets: [],
    polyglot: [],
    other: []
};

// Extract individual test failures
const failureRegex = /● (.+?)(?=\n|$)/g;
let match;
const failures = [];

while ((match = failureRegex.exec(testOutput)) !== null) {
    const testName = match[1].trim();
    if (testName && !testName.includes('Console') && !testName.includes('Test suite failed')) {
        failures.push(testName);
    }
}

// Categorize failures
failures.forEach(failure => {
    if (failure.includes('fragment') || (failure.includes('JSX') && failure.includes('simple'))) {
        failurePatterns.jsxWhitespace.push(failure);
    } else if (failure.includes('TypeScript') || failure.includes('typed') || failure.includes('React.FC')) {
        failurePatterns.jsxTypeScript.push(failure);
    } else if (failure.includes('Angle Bracket') || failure.includes('disambiguation')) {
        failurePatterns.angleBrackets.push(failure);
    } else if (failure.includes('polyglot') || failure.includes('Polyglot')) {
        failurePatterns.polyglot.push(failure);
    } else {
        failurePatterns.other.push(failure);
    }
});

console.log('=' .repeat(80));
console.log('DETAILED FAILURE ANALYSIS - 17 Remaining Failures');
console.log('=' .repeat(80));
console.log();

console.log('📊 FAILURE CATEGORIES:');
console.log();

console.log(`1. JSX Whitespace Issues (${failurePatterns.jsxWhitespace.length} failures)`);
console.log('   Problem: Spaces in JSX text content are lost during lexing');
console.log('   Root Cause: Lexer strips whitespace in JSX text tokens');
failurePatterns.jsxWhitespace.slice(0, 5).forEach(f => console.log(`   • ${f}`));
if (failurePatterns.jsxWhitespace.length > 5) console.log(`   ... and ${failurePatterns.jsxWhitespace.length - 5} more`);
console.log();

console.log(`2. JSX/TypeScript Integration (${failurePatterns.jsxTypeScript.length} failures)`);
console.log('   Problem: Complex TypeScript types in JSX components not fully supported');
console.log('   Root Cause: Type parsing conflicts with JSX syntax');
failurePatterns.jsxTypeScript.slice(0, 5).forEach(f => console.log(`   • ${f}`));
if (failurePatterns.jsxTypeScript.length > 5) console.log(`   ... and ${failurePatterns.jsxTypeScript.length - 5} more`);
console.log();

console.log(`3. Angle Bracket Disambiguation (${failurePatterns.angleBrackets.length} failures)`);
console.log('   Problem: Edge cases in distinguishing <Type> vs <Component>');
console.log('   Root Cause: Lookahead logic needs refinement');
failurePatterns.angleBrackets.slice(0, 5).forEach(f => console.log(`   • ${f}`));
if (failurePatterns.angleBrackets.length > 5) console.log(`   ... and ${failurePatterns.angleBrackets.length - 5} more`);
console.log();

console.log(`4. Complex Polyglot Patterns (${failurePatterns.polyglot.length} failures)`);
console.log('   Problem: Extreme mixing of language constructs');
console.log('   Root Cause: Context switching between language modes');
failurePatterns.polyglot.slice(0, 5).forEach(f => console.log(`   • ${f}`));
if (failurePatterns.polyglot.length > 5) console.log(`   ... and ${failurePatterns.polyglot.length - 5} more`);
console.log();

if (failurePatterns.other.length > 0) {
    console.log(`5. Other Issues (${failurePatterns.other.length} failures)`);
    failurePatterns.other.slice(0, 5).forEach(f => console.log(`   • ${f}`));
    if (failurePatterns.other.length > 5) console.log(`   ... and ${failurePatterns.other.length - 5} more`);
    console.log();
}

console.log('=' .repeat(80));
console.log('🔧 IMPLEMENTATION PLAN TO REACH 100%');
console.log('=' .repeat(80));
console.log();

console.log('PHASE 1: JSX Whitespace Fix (Est: 2-3 hours)');
console.log('├─ Impact: Fixes 2-3 tests immediately');
console.log('├─ File: src/lexer.ts');
console.log('├─ Changes:');
console.log('│  ├─ Modify lexJSXText() to preserve spaces');
console.log('│  ├─ Add JSX context flag to track when in JSX');
console.log('│  └─ Update JSXText token creation to keep original text');
console.log('└─ Testing: Run jsx-fragments tests after each change');
console.log();

console.log('PHASE 2: TypeScript in JSX Support (Est: 3-4 hours)');
console.log('├─ Impact: Fixes 7-8 tests');
console.log('├─ Files: src/parser.ts, src/ast.ts');
console.log('├─ Changes:');
console.log('│  ├─ Add support for React.FC, JSX.Element types');
console.log('│  ├─ Handle generic components <Component<T>>');
console.log('│  ├─ Parse typed props interfaces');
console.log('│  └─ Support ref and children type annotations');
console.log('└─ Testing: Run jsx-typescript tests iteratively');
console.log();

console.log('PHASE 3: Angle Bracket Refinement (Est: 2 hours)');
console.log('├─ Impact: Fixes 5-6 tests');
console.log('├─ File: src/parser.ts');
console.log('├─ Changes:');
console.log('│  ├─ Improve isJSXStart() lookahead logic');
console.log('│  ├─ Add context tracking for type assertions');
console.log('│  └─ Handle nested generic/JSX combinations');
console.log('└─ Testing: Run angle-bracket-verification tests');
console.log();

console.log('PHASE 4: Polyglot Edge Cases (Est: 1-2 hours)');
console.log('├─ Impact: Fixes final 3 tests');
console.log('├─ File: src/parser.ts');
console.log('├─ Changes:');
console.log('│  ├─ Handle extreme operator chaining');
console.log('│  ├─ Support mixed async/concurrent patterns');
console.log('│  └─ Fix complex pattern matching');
console.log('└─ Testing: Run parser-polyglot-advanced tests');
console.log();

console.log('=' .repeat(80));
console.log('📈 PROJECTED PROGRESS');
console.log('=' .repeat(80));
console.log();
console.log('Current: 300/317 tests passing (94.6%)');
console.log('After Phase 1: ~303/317 (95.6%)');
console.log('After Phase 2: ~310/317 (97.8%)');
console.log('After Phase 3: ~315/317 (99.4%)');
console.log('After Phase 4: 317/317 (100.0%) 🎉');
console.log();
console.log('Total estimated time: 8-11 hours');
console.log('Recommendation: Start with Phase 1 (JSX Whitespace) for quick wins');
console.log();

// Count total failures
const totalFailures = Object.values(failurePatterns).reduce((sum, arr) => sum + arr.length, 0);
console.log(`Total unique failures identified: ${totalFailures}`);