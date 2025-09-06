const fs = require('fs');
const path = require('path');

// Find tests that likely involve angle brackets
function findAngleBracketTests(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    
    const tests = [];
    const lines = content.split('\n');
    
    let currentTest = null;
    let inTest = false;
    let testCode = '';
    
    lines.forEach((line, index) => {
        // Detect test start
        if (line.match(/^\s*(it|test)\s*\(['"]/)) {
            if (currentTest && testCode) {
                // Check if previous test had angle brackets
                if (testCode.includes('<') || testCode.includes('>')) {
                    currentTest.hasAngleBrackets = true;
                    currentTest.patterns = analyzeAngleBrackets(testCode);
                    tests.push(currentTest);
                }
            }
            
            const match = line.match(/['"](.*?)['"]/);
            if (match) {
                currentTest = {
                    name: match[1],
                    line: index + 1,
                    hasAngleBrackets: false,
                    patterns: []
                };
                testCode = '';
                inTest = true;
            }
        }
        
        // Collect test code
        if (inTest) {
            testCode += line + '\n';
            
            // Detect test end
            if (line.match(/^\s*\}\);?\s*$/) && testCode.length > 100) {
                inTest = false;
            }
        }
    });
    
    // Check last test
    if (currentTest && testCode && (testCode.includes('<') || testCode.includes('>'))) {
        currentTest.hasAngleBrackets = true;
        currentTest.patterns = analyzeAngleBrackets(testCode);
        tests.push(currentTest);
    }
    
    return {
        fileName,
        tests
    };
}

function analyzeAngleBrackets(code) {
    const patterns = [];
    
    // JSX patterns
    if (code.match(/<[A-Z]\w*[\s/>]/)) patterns.push('JSX Component');
    if (code.match(/<[a-z]\w*[\s/>]/)) patterns.push('JSX Element');
    if (code.match(/<>/)) patterns.push('JSX Fragment');
    
    // Generic patterns
    if (code.match(/:\s*\w+<\w+>/)) patterns.push('Generic Type');
    if (code.match(/Array<|Map<|Set<|Promise<|Vec<|List<|Option<|Result</)) patterns.push('Generic Collection');
    if (code.match(/function\s+\w+<\w+>/)) patterns.push('Generic Function');
    
    // Comparison patterns
    if (code.match(/\w+\s*<\s*\d+/)) patterns.push('Numeric Comparison');
    if (code.match(/\w+\s*>\s*\d+/)) patterns.push('Numeric Comparison');
    if (code.match(/\w+\s*<=\s*\d+/)) patterns.push('Less/Equal');
    if (code.match(/\w+\s*>=\s*\d+/)) patterns.push('Greater/Equal');
    
    // Channel operations
    if (code.match(/<-\w+/)) patterns.push('Channel Receive');
    if (code.match(/\w+\s*<-\s*\w+/)) patterns.push('Channel Send');
    
    // Shift operators
    if (code.match(/<<|>>/)) patterns.push('Shift Operator');
    
    return [...new Set(patterns)];
}

// Check if test has weak verification
function hasWeakVerification(filePath, testName) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    let inTest = false;
    let hasWeakCheck = false;
    let hasStrongCheck = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.includes(testName)) {
            inTest = true;
        }
        
        if (inTest) {
            // Weak patterns
            if (line.match(/expect\(\(\) => .*\.parse\(\)\)\.not\.toThrow/) ||
                line.match(/expect\(ast\.body\.length\)\.toBeGreaterThan/) ||
                line.match(/expect\(ast\)\.toBeDefined/)) {
                hasWeakCheck = true;
            }
            
            // Strong patterns
            if (line.match(/\.kind\)\.toBe/) ||
                line.match(/as AST\./) ||
                line.match(/\.op\)\.toBe/)) {
                hasStrongCheck = true;
            }
            
            // End of test
            if (line.match(/^\s*\}\);?\s*$/)) {
                break;
            }
        }
    }
    
    return hasWeakCheck && !hasStrongCheck;
}

// Analyze all test files
const testDir = path.join(__dirname, 'test');
const testFiles = fs.readdirSync(testDir)
    .filter(file => file.endsWith('.test.ts'))
    .map(file => path.join(testDir, file));

console.log('ANGLE BRACKET TEST ANALYSIS');
console.log('============================\n');

const allResults = [];
let totalAngleBracketTests = 0;
let weakAngleBracketTests = 0;

testFiles.forEach(filePath => {
    const result = findAngleBracketTests(filePath);
    
    if (result.tests.length > 0) {
        result.tests.forEach(test => {
            totalAngleBracketTests++;
            const isWeak = hasWeakVerification(filePath, test.name);
            if (isWeak) {
                weakAngleBracketTests++;
                test.needsUpdate = true;
            }
        });
        allResults.push(result);
    }
});

console.log('SUMMARY');
console.log('-------');
console.log(`Total tests with angle brackets: ${totalAngleBracketTests}`);
console.log(`Tests with weak verification: ${weakAngleBracketTests}`);
console.log(`Percentage needing update: ${(weakAngleBracketTests/totalAngleBracketTests*100).toFixed(1)}%\n`);

console.log('ANGLE BRACKET PATTERNS FOUND');
console.log('-----------------------------');
const patternCounts = {};
allResults.forEach(result => {
    result.tests.forEach(test => {
        test.patterns.forEach(pattern => {
            patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
        });
    });
});

Object.entries(patternCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([pattern, count]) => {
        console.log(`${pattern}: ${count} tests`);
    });

console.log('\n\nTESTS NEEDING ANGLE BRACKET VERIFICATION');
console.log('-----------------------------------------');

const priority = allResults.flatMap(result => 
    result.tests
        .filter(test => test.needsUpdate)
        .map(test => ({
            file: result.fileName,
            test: test.name,
            patterns: test.patterns,
            line: test.line
        }))
);

// Group by pattern type
const byPattern = {
    'JSX': [],
    'Generics': [],
    'Comparisons': [],
    'Channels': [],
    'Mixed': []
};

priority.forEach(item => {
    const hasJSX = item.patterns.some(p => p.includes('JSX'));
    const hasGeneric = item.patterns.some(p => p.includes('Generic'));
    const hasComparison = item.patterns.some(p => p.includes('Comparison') || p.includes('Equal'));
    const hasChannel = item.patterns.some(p => p.includes('Channel'));
    
    const count = [hasJSX, hasGeneric, hasComparison, hasChannel].filter(x => x).length;
    
    if (count > 1) {
        byPattern['Mixed'].push(item);
    } else if (hasJSX) {
        byPattern['JSX'].push(item);
    } else if (hasGeneric) {
        byPattern['Generics'].push(item);
    } else if (hasComparison) {
        byPattern['Comparisons'].push(item);
    } else if (hasChannel) {
        byPattern['Channels'].push(item);
    }
});

Object.entries(byPattern).forEach(([category, items]) => {
    if (items.length > 0) {
        console.log(`\n${category} Tests (${items.length}):`);
        items.slice(0, 5).forEach(item => {
            console.log(`  📁 ${item.file}`);
            console.log(`     "${item.test}" (line ${item.line})`);
            console.log(`     Patterns: ${item.patterns.join(', ')}`);
        });
        if (items.length > 5) {
            console.log(`  ... and ${items.length - 5} more`);
        }
    }
});

// Save detailed report
const report = {
    summary: {
        totalAngleBracketTests,
        weakAngleBracketTests,
        percentageNeedingUpdate: (weakAngleBracketTests/totalAngleBracketTests*100).toFixed(1)
    },
    patternCounts,
    testsByCategory: byPattern
};

fs.writeFileSync('angle-bracket-tests-report.json', JSON.stringify(report, null, 2));
console.log('\n\n✅ Detailed report saved to angle-bracket-tests-report.json');