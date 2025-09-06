#!/usr/bin/env node

/**
 * Test Quality Checker for PolyScript
 * 
 * This tool analyzes test files to identify weak tests that need improvement.
 * It looks for patterns that indicate weak verification and provides recommendations.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patterns that indicate weak test verification
const WEAK_PATTERNS = [
  {
    pattern: /expect\([^)]*\)\.not\.toThrow\(\)/g,
    name: 'not.toThrow',
    severity: 'high',
    message: 'Test only verifies parsing doesn\'t throw, not AST structure'
  },
  {
    pattern: /expect\(ast\.body\.length\)\.toBeGreaterThan(?:OrEqual)?\(\d+\)/g,
    name: 'body.length comparison',
    severity: 'medium',
    message: 'Test only checks AST body length, not actual structure'
  },
  {
    pattern: /expect\([^)]*\)\.toBeDefined\(\)/g,
    name: 'toBeDefined',
    severity: 'low',
    message: 'Test only checks existence, not specific values or structure'
  },
  {
    pattern: /expect\(ast\.body\[0\]\.kind\)\.toBeDefined\(\)/g,
    name: 'kind.toBeDefined',
    severity: 'high',
    message: 'Test doesn\'t verify specific node type'
  },
  {
    pattern: /expect\(.*\.kind\)\.toBe\([^)]+\)\s*$/gm,
    name: 'only kind check',
    severity: 'low',
    message: 'Test only checks node kind, consider verifying more properties'
  }
];

// Patterns that indicate strong test verification
const STRONG_PATTERNS = [
  {
    pattern: /verifyJSXElement/g,
    name: 'JSX verification helper'
  },
  {
    pattern: /verifyGenericType/g,
    name: 'Generic type verification'
  },
  {
    pattern: /verifyAngleBrackets/g,
    name: 'Angle bracket disambiguation'
  },
  {
    pattern: /analyzeAngleBrackets/g,
    name: 'Angle bracket analysis'
  },
  {
    pattern: /✅ STRONG:/g,
    name: 'Strong verification marker'
  }
];

class TestQualityChecker {
  constructor() {
    this.results = {
      totalFiles: 0,
      totalTests: 0,
      weakTests: [],
      strongTests: [],
      summary: {}
    };
  }

  analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    
    // Skip non-test files
    if (!fileName.includes('.test.') || fileName.includes('-updated.')) {
      return;
    }

    this.results.totalFiles++;
    
    // Count test cases
    const testMatches = content.match(/(?:test|it)\s*\(/g) || [];
    const testCount = testMatches.length;
    this.results.totalTests += testCount;

    // Check for weak patterns
    const weaknesses = [];
    WEAK_PATTERNS.forEach(weakPattern => {
      const matches = content.match(weakPattern.pattern) || [];
      if (matches.length > 0) {
        weaknesses.push({
          pattern: weakPattern.name,
          count: matches.length,
          severity: weakPattern.severity,
          message: weakPattern.message
        });
      }
    });

    // Check for strong patterns
    const strengths = [];
    STRONG_PATTERNS.forEach(strongPattern => {
      const matches = content.match(strongPattern.pattern) || [];
      if (matches.length > 0) {
        strengths.push({
          pattern: strongPattern.name,
          count: matches.length
        });
      }
    });

    // Calculate quality score
    const weakScore = weaknesses.reduce((sum, w) => {
      const weight = w.severity === 'high' ? 3 : w.severity === 'medium' ? 2 : 1;
      return sum + (w.count * weight);
    }, 0);
    
    const strongScore = strengths.reduce((sum, s) => sum + s.count * 2, 0);
    const qualityScore = Math.max(0, 100 - (weakScore * 5) + (strongScore * 3));

    // Store results
    const fileResult = {
      file: fileName,
      path: filePath,
      testCount,
      weaknesses,
      strengths,
      weakScore,
      strongScore,
      qualityScore: Math.min(100, qualityScore)
    };

    if (weaknesses.length > 0) {
      this.results.weakTests.push(fileResult);
    }
    if (strengths.length > 0) {
      this.results.strongTests.push(fileResult);
    }

    return fileResult;
  }

  analyzeDirectory(dir) {
    const testFiles = glob.sync(path.join(dir, '**/*.test.ts'));
    testFiles.forEach(file => this.analyzeFile(file));
  }

  generateReport() {
    console.log('\n📊 TEST QUALITY REPORT');
    console.log('='.repeat(50));
    
    console.log(`\n📁 Files Analyzed: ${this.results.totalFiles}`);
    console.log(`🧪 Total Tests: ${this.results.totalTests}`);
    
    // Sort by quality score
    const sortedWeak = this.results.weakTests.sort((a, b) => a.qualityScore - b.qualityScore);
    
    console.log('\n❌ WEAK TESTS (Need Improvement)');
    console.log('-'.repeat(50));
    
    sortedWeak.slice(0, 10).forEach(test => {
      console.log(`\n📄 ${test.file} (Quality: ${test.qualityScore.toFixed(0)}%)`);
      console.log(`   Tests: ${test.testCount}`);
      
      test.weaknesses.forEach(weakness => {
        const icon = weakness.severity === 'high' ? '🔴' : 
                     weakness.severity === 'medium' ? '🟡' : '🟢';
        console.log(`   ${icon} ${weakness.pattern}: ${weakness.count} occurrences`);
        console.log(`      → ${weakness.message}`);
      });
    });

    console.log('\n✅ STRONG TESTS (Good Examples)');
    console.log('-'.repeat(50));
    
    const sortedStrong = this.results.strongTests
      .filter(t => t.qualityScore > 70)
      .sort((a, b) => b.qualityScore - a.qualityScore);
    
    sortedStrong.slice(0, 5).forEach(test => {
      console.log(`\n📄 ${test.file} (Quality: ${test.qualityScore.toFixed(0)}%)`);
      test.strengths.forEach(strength => {
        console.log(`   ✓ ${strength.pattern}: ${strength.count} uses`);
      });
    });

    // Summary statistics
    const avgQuality = this.results.weakTests.length > 0 ?
      this.results.weakTests.reduce((sum, t) => sum + t.qualityScore, 0) / this.results.weakTests.length : 100;
    
    const highSeverityCount = this.results.weakTests.reduce((sum, t) => 
      sum + t.weaknesses.filter(w => w.severity === 'high').reduce((s, w) => s + w.count, 0), 0);
    
    console.log('\n📈 SUMMARY');
    console.log('-'.repeat(50));
    console.log(`Average Quality Score: ${avgQuality.toFixed(1)}%`);
    console.log(`Files with Weak Tests: ${this.results.weakTests.length}`);
    console.log(`Files with Strong Tests: ${this.results.strongTests.length}`);
    console.log(`High Severity Issues: ${highSeverityCount}`);
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS');
    console.log('-'.repeat(50));
    
    if (highSeverityCount > 0) {
      console.log('1. Priority: Fix high-severity issues (not.toThrow, kind.toBeDefined)');
    }
    console.log('2. Use verification helpers from test/helpers/ast-verifiers.ts');
    console.log('3. Add ✅ STRONG: markers to document verified sections');
    console.log('4. Verify angle bracket disambiguation in all tests');
    console.log('5. Check actual AST structure, not just parsing success');

    // Files to update
    console.log('\n📝 TOP FILES TO UPDATE');
    console.log('-'.repeat(50));
    sortedWeak.slice(0, 5).forEach((test, i) => {
      console.log(`${i + 1}. ${test.file} (Quality: ${test.qualityScore.toFixed(0)}%)`);
    });

    return this.results;
  }

  exportJSON(outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 Full report exported to: ${outputPath}`);
  }
}

// Main execution
if (require.main === module) {
  const checker = new TestQualityChecker();
  const testDir = path.join(__dirname, 'test');
  
  console.log(`🔍 Analyzing tests in: ${testDir}`);
  checker.analyzeDirectory(testDir);
  
  const results = checker.generateReport();
  
  // Export detailed JSON report
  const reportPath = path.join(__dirname, 'test-quality-report.json');
  checker.exportJSON(reportPath);
  
  // Exit with error code if quality is too low
  const avgQuality = results.weakTests.length > 0 ?
    results.weakTests.reduce((sum, t) => sum + t.qualityScore, 0) / results.weakTests.length : 100;
  
  if (avgQuality < 50) {
    console.log('\n⚠️  Test quality is below acceptable threshold (50%)');
    process.exit(1);
  }
}

module.exports = TestQualityChecker;