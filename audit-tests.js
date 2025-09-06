const fs = require('fs');
const path = require('path');

// Patterns that indicate weak testing
const weakPatterns = [
    /expect\(\(\) => parser\.parse\(\)\)\.not\.toThrow/,  // Only checks no error
    /expect\(ast\.body\.length\)\.toBeGreaterThan/,       // Only checks has nodes
    /expect\(ast\.body\)\.toHaveLength\(\d+\)/,           // Only checks node count
    /expect\(ast\)\.toBeDefined/,                         // Only checks exists
    /expect\(\(\) => parseCode\(.*?\)\)\.not\.toThrow/,   // Only checks no error
];

// Patterns that indicate strong testing
const strongPatterns = [
    /expect\(.*?\.kind\)\.toBe/,                          // Checks AST node type
    /as AST\./,                                           // Type casting to specific AST
    /expect\(.*?\.op\)\.toBe/,                           // Checks operator
    /expect\(.*?\.name\)\.toBe/,                         // Checks names
];

function analyzeTestFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const fileName = path.basename(filePath);
    
    const tests = [];
    let currentTest = null;
    let inTest = false;
    let testStartLine = 0;
    
    lines.forEach((line, index) => {
        // Detect test start
        if (line.match(/^\s*(it|test)\s*\(['"]/)) {
            const match = line.match(/['"](.*?)['"]/);
            if (match) {
                currentTest = {
                    name: match[1],
                    startLine: index + 1,
                    endLine: index + 1,
                    lines: [line],
                    hasWeakCheck: false,
                    hasStrongCheck: false,
                    weakChecks: [],
                    strongChecks: []
                };
                inTest = true;
                testStartLine = index;
            }
        }
        
        // Collect test lines
        if (inTest && currentTest) {
            currentTest.lines.push(line);
            
            // Check for weak patterns
            weakPatterns.forEach(pattern => {
                if (pattern.test(line)) {
                    currentTest.hasWeakCheck = true;
                    currentTest.weakChecks.push({
                        line: index + 1,
                        code: line.trim()
                    });
                }
            });
            
            // Check for strong patterns
            strongPatterns.forEach(pattern => {
                if (pattern.test(line)) {
                    currentTest.hasStrongCheck = true;
                    currentTest.strongChecks.push({
                        line: index + 1,
                        code: line.trim()
                    });
                }
            });
            
            // Detect test end (rough heuristic)
            if (line.match(/^\s*\}\);?\s*$/) && index > testStartLine + 1) {
                currentTest.endLine = index + 1;
                tests.push(currentTest);
                currentTest = null;
                inTest = false;
            }
        }
    });
    
    return {
        fileName,
        filePath,
        tests,
        totalTests: tests.length,
        weakTests: tests.filter(t => t.hasWeakCheck && !t.hasStrongCheck),
        strongTests: tests.filter(t => t.hasStrongCheck),
        mixedTests: tests.filter(t => t.hasWeakCheck && t.hasStrongCheck)
    };
}

// Analyze all test files
const testDir = path.join(__dirname, 'test');
const testFiles = fs.readdirSync(testDir)
    .filter(file => file.endsWith('.test.ts'))
    .map(file => path.join(testDir, file));

const results = testFiles.map(analyzeTestFile);

// Generate report
console.log('TEST AUDIT REPORT');
console.log('=================\n');

let totalTests = 0;
let totalWeak = 0;
let totalStrong = 0;
let totalMixed = 0;

results.forEach(result => {
    totalTests += result.totalTests;
    totalWeak += result.weakTests.length;
    totalStrong += result.strongTests.length;
    totalMixed += result.mixedTests.length;
});

console.log('SUMMARY');
console.log('-------');
console.log(`Total test files: ${results.length}`);
console.log(`Total tests: ${totalTests}`);
console.log(`✅ Strong tests (verify AST): ${totalStrong} (${(totalStrong/totalTests*100).toFixed(1)}%)`);
console.log(`⚠️  Weak tests (only check no error): ${totalWeak} (${(totalWeak/totalTests*100).toFixed(1)}%)`);
console.log(`🔄 Mixed tests (have both): ${totalMixed} (${(totalMixed/totalTests*100).toFixed(1)}%)\n`);

console.log('FILES NEEDING ATTENTION');
console.log('-----------------------');

const filesNeedingWork = results
    .filter(r => r.weakTests.length > 0)
    .sort((a, b) => b.weakTests.length - a.weakTests.length);

filesNeedingWork.forEach(result => {
    const weakPercent = (result.weakTests.length / result.totalTests * 100).toFixed(1);
    console.log(`\n📁 ${result.fileName}`);
    console.log(`   Total tests: ${result.totalTests}`);
    console.log(`   ❌ Weak tests: ${result.weakTests.length} (${weakPercent}%)`);
    
    if (result.weakTests.length <= 10) {
        console.log('   Tests needing update:');
        result.weakTests.forEach(test => {
            console.log(`     - "${test.name}" (line ${test.startLine})`);
        });
    } else {
        console.log(`   Too many to list (${result.weakTests.length} tests need updating)`);
    }
});

console.log('\n\nDETAILED WEAK TEST EXAMPLES');
console.log('----------------------------');

// Show examples of weak tests that need fixing
let examplesShown = 0;
for (const result of filesNeedingWork) {
    for (const test of result.weakTests) {
        if (examplesShown >= 5) break;
        
        console.log(`\n${result.fileName}: "${test.name}"`);
        console.log('Weak checks found:');
        test.weakChecks.forEach(check => {
            console.log(`  Line ${check.line}: ${check.code}`);
        });
        examplesShown++;
    }
    if (examplesShown >= 5) break;
}

// Generate priority list
console.log('\n\nPRIORITY UPDATE LIST');
console.log('--------------------');
console.log('Files ranked by number of weak tests:\n');

filesNeedingWork.slice(0, 10).forEach((result, index) => {
    console.log(`${index + 1}. ${result.fileName} - ${result.weakTests.length} weak tests`);
});

// Write detailed report to file
const report = {
    summary: {
        totalFiles: results.length,
        totalTests,
        strongTests: totalStrong,
        weakTests: totalWeak,
        mixedTests: totalMixed
    },
    files: results.map(r => ({
        fileName: r.fileName,
        totalTests: r.totalTests,
        weakTests: r.weakTests.length,
        strongTests: r.strongTests.length,
        weakTestNames: r.weakTests.map(t => t.name)
    }))
};

fs.writeFileSync('test-audit-report.json', JSON.stringify(report, null, 2));
console.log('\n\n✅ Full report saved to test-audit-report.json');