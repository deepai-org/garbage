const { execSync } = require('child_process');
const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Get detailed test output
let testOutput;
try {
    testOutput = execSync('npm test 2>&1', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).toString();
} catch (error) {
    testOutput = error.stdout || error.output?.join('') || '';
}

// Extract specific failure details
const failureDetails = [];
const sections = testOutput.split('● ');

sections.forEach(section => {
    if (!section.trim()) return;
    
    const lines = section.split('\n');
    const testName = lines[0]?.trim();
    
    if (!testName || testName.includes('Console') || testName.includes('Test suite failed')) {
        return;
    }
    
    // Find the error message
    let errorType = 'Unknown';
    let errorDetail = '';
    
    for (let i = 1; i < lines.length && i < 20; i++) {
        const line = lines[i];
        if (line.includes('Expected')) {
            errorType = 'Assertion';
            errorDetail = line.trim();
            if (lines[i+1]?.includes('Received')) {
                errorDetail += ' | ' + lines[i+1].trim();
            }
            break;
        } else if (line.includes('TypeError')) {
            errorType = 'TypeError';
            errorDetail = line.trim();
            break;
        } else if (line.includes('Error')) {
            errorType = 'ParseError';
            errorDetail = line.trim();
            break;
        }
    }
    
    failureDetails.push({
        test: testName,
        errorType,
        errorDetail
    });
});

console.log('=' .repeat(80));
console.log('DETAILED ANALYSIS OF 15 REMAINING FAILURES');
console.log('=' .repeat(80));
console.log();

// Group by category
const categories = {
    angleBracket: [],
    typeScript: [],
    polyglot: [],
    jsx: [],
    other: []
};

failureDetails.forEach(failure => {
    if (failure.test.includes('Angle Bracket')) {
        categories.angleBracket.push(failure);
    } else if (failure.test.includes('TypeScript') || failure.test.includes('typed')) {
        categories.typeScript.push(failure);
    } else if (failure.test.includes('polyglot') || failure.test.includes('Polyglot')) {
        categories.polyglot.push(failure);
    } else if (failure.test.includes('JSX')) {
        categories.jsx.push(failure);
    } else {
        categories.other.push(failure);
    }
});

// Print analysis
console.log('📊 FAILURE BREAKDOWN BY CATEGORY:\n');

Object.entries(categories).forEach(([cat, failures]) => {
    if (failures.length === 0) return;
    
    console.log(`${cat.toUpperCase()} (${failures.length} failures):`);
    failures.forEach(f => {
        console.log(`  • ${f.test}`);
        console.log(`    Error: ${f.errorType} - ${f.errorDetail.substring(0, 80)}...`);
    });
    console.log();
});

// Test specific problem patterns
console.log('=' .repeat(80));
console.log('🔬 SPECIFIC PROBLEM PATTERNS:');
console.log('=' .repeat(80));
console.log();

// Test 1: JSX with conditional
const conditionalTest = `<>
    {isLoggedIn ? (
        <Dashboard />
    ) : (
        <LoginForm />
    )}
</>`;

console.log('1. JSX Fragment with Conditional:');
console.log('   Code:', conditionalTest.replace(/\n/g, '\\n'));
try {
    const lexer = new Lexer(conditionalTest);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    console.log('   ✓ Parses successfully');
    console.log('   AST body length:', ast.body.length);
} catch (error) {
    console.log('   ✗ Parse error:', error.message);
}
console.log();

// Test 2: Complex angle brackets
const angleBracketTest = `const x = a < b && c > d ? e<f> : g<h>();`;

console.log('2. Complex Angle Bracket Mix:');
console.log('   Code:', angleBracketTest);
try {
    const lexer = new Lexer(angleBracketTest);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    console.log('   ✓ Parses successfully');
} catch (error) {
    console.log('   ✗ Parse error:', error.message);
}
console.log();

// Test 3: TypeScript complex types
const tsComplexTest = `type Props = React.FC<{ children: React.ReactNode }>;`;

console.log('3. TypeScript Complex Types:');
console.log('   Code:', tsComplexTest);
try {
    const lexer = new Lexer(tsComplexTest);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    console.log('   ✓ Parses successfully');
} catch (error) {
    console.log('   ✗ Parse error:', error.message);
}
console.log();

console.log('=' .repeat(80));
console.log('🏗️  ARCHITECTURAL CHANGES NEEDED:');
console.log('=' .repeat(80));
console.log();

console.log('1. CONTEXT-AWARE LEXER (High Priority)');
console.log('   Problem: Lexer doesn\'t track JSX/TypeScript context properly');
console.log('   Solution:');
console.log('   • Add JSXDepth counter to track nesting level');
console.log('   • Add TypeContext flag for type annotation regions');
console.log('   • Preserve ALL whitespace in JSX text regions');
console.log('   • Track generic depth separately from JSX depth');
console.log();

console.log('2. IMPROVED PARSER LOOKAHEAD (High Priority)');
console.log('   Problem: Can\'t distinguish <Type> from <Component> reliably');
console.log('   Solution:');
console.log('   • Implement multi-token lookahead for angle brackets');
console.log('   • Check for JSX attributes (key=value) vs type arguments');
console.log('   • Look for self-closing /> vs comparison operators');
console.log('   • Consider preceding context (type position vs expression)');
console.log();

console.log('3. DESTRUCTURING PATTERN AST (Medium Priority)');
console.log('   Problem: Destructuring patterns stored as strings');
console.log('   Solution:');
console.log('   • Add DestructuringPattern AST node type');
console.log('   • Parse object/array patterns properly');
console.log('   • Support nested destructuring');
console.log('   • Handle default values and rest spread');
console.log();

console.log('4. TYPE SYSTEM COMPLETION (Medium Priority)');
console.log('   Problem: Missing React.FC, JSX.Element, and other TS types');
console.log('   Solution:');
console.log('   • Add QualifiedType for namespaced types (React.FC)');
console.log('   • Support typeof operator in type position');
console.log('   • Add keyof, infer, and other TS operators');
console.log('   • Handle mapped and conditional types');
console.log();

console.log('5. POLYGLOT MODE SWITCHING (Low Priority)');
console.log('   Problem: Language context switching is ad-hoc');
console.log('   Solution:');
console.log('   • Add explicit LanguageMode enum');
console.log('   • Track mode stack for nested contexts');
console.log('   • Define clear mode transition rules');
console.log('   • Handle operator precedence per language');
console.log();

console.log('=' .repeat(80));
console.log('📋 IMPLEMENTATION ROADMAP:');
console.log('=' .repeat(80));
console.log();

console.log('WEEK 1: Foundation (Expected: 305/317 tests)');
console.log('├─ Day 1-2: Refactor lexer for context awareness');
console.log('├─ Day 3-4: Implement proper JSX depth tracking');
console.log('└─ Day 5: Add TypeScript context regions');
console.log();

console.log('WEEK 2: Parser Intelligence (Expected: 312/317 tests)');
console.log('├─ Day 1-2: Multi-token lookahead system');
console.log('├─ Day 3: Angle bracket disambiguation logic');
console.log('├─ Day 4: Destructuring pattern AST nodes');
console.log('└─ Day 5: Integration and testing');
console.log();

console.log('WEEK 3: Completion (Expected: 317/317 tests)');
console.log('├─ Day 1-2: Remaining TypeScript types');
console.log('├─ Day 3: Polyglot mode improvements');
console.log('├─ Day 4: Edge case fixes');
console.log('└─ Day 5: Final testing and polish');
console.log();

console.log('Total estimated time: 15 working days');
console.log('Current: 302/317 (95.3%)');
console.log('Target: 317/317 (100.0%)');