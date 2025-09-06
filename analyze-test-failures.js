#!/usr/bin/env node

/**
 * Test Failure Analysis Tool
 * 
 * Analyzes failing tests to identify patterns and common issues
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestFailureAnalyzer {
  constructor() {
    this.failures = {
      compilation: [],
      runtime: [],
      assertion: []
    };
    this.patterns = new Map();
  }

  analyze() {
    console.log('🔍 Analyzing Test Failures...\n');
    
    // Get list of test files
    const testFiles = this.getTestFiles();
    const updatedTests = testFiles.filter(f => f.includes('-updated.test.ts'));
    
    console.log(`Found ${testFiles.length} test files (${updatedTests.length} updated)\n`);
    
    // Analyze each updated test file
    updatedTests.forEach(file => {
      this.analyzeTestFile(file);
    });
    
    this.identifyPatterns();
    this.generateReport();
  }

  getTestFiles() {
    try {
      const output = execSync('find test -name "*.test.ts"', { encoding: 'utf8' });
      return output.split('\n').filter(f => f);
    } catch (e) {
      return [];
    }
  }

  analyzeTestFile(filePath) {
    console.log(`Analyzing: ${path.basename(filePath)}`);
    
    try {
      // Run test and capture output
      const output = execSync(`npm test -- ${filePath} 2>&1`, { 
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10
      });
      console.log(`  ✅ Passing`);
    } catch (error) {
      const output = error.stdout || error.message;
      
      // Parse TypeScript compilation errors
      const tsErrors = this.parseTypeScriptErrors(output);
      if (tsErrors.length > 0) {
        this.failures.compilation.push({
          file: filePath,
          errors: tsErrors
        });
        console.log(`  ❌ Compilation errors: ${tsErrors.length}`);
      }
      
      // Parse runtime errors
      const runtimeErrors = this.parseRuntimeErrors(output);
      if (runtimeErrors.length > 0) {
        this.failures.runtime.push({
          file: filePath,
          errors: runtimeErrors
        });
        console.log(`  ❌ Runtime errors: ${runtimeErrors.length}`);
      }
      
      // Parse assertion failures
      const assertionErrors = this.parseAssertionErrors(output);
      if (assertionErrors.length > 0) {
        this.failures.assertion.push({
          file: filePath,
          errors: assertionErrors
        });
        console.log(`  ❌ Assertion failures: ${assertionErrors.length}`);
      }
    }
  }

  parseTypeScriptErrors(output) {
    const errors = [];
    const tsErrorPattern = /error\s+TS(\d+):\s+(.+)/g;
    const propertyPattern = /Property '(\w+)' does not exist on type '(.+)'/g;
    const comparisonPattern = /This comparison appears to be unintentional/g;
    
    let match;
    while ((match = tsErrorPattern.exec(output)) !== null) {
      const errorCode = match[1];
      const message = match[2];
      
      // Extract property name if it's a property error
      let property = null;
      let type = null;
      const propMatch = propertyPattern.exec(message);
      if (propMatch) {
        property = propMatch[1];
        type = propMatch[2];
      }
      
      errors.push({
        code: `TS${errorCode}`,
        message: message,
        property: property,
        type: type
      });
    }
    
    return errors;
  }

  parseRuntimeErrors(output) {
    const errors = [];
    const patterns = [
      /TypeError: (.+)/g,
      /ReferenceError: (.+)/g,
      /Cannot read prop(?:erty|erties) '(.+)' of (undefined|null)/g
    ];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(output)) !== null) {
        errors.push({
          type: 'runtime',
          message: match[0]
        });
      }
    });
    
    return errors;
  }

  parseAssertionErrors(output) {
    const errors = [];
    const patterns = [
      /Expected: (.+)\n\s+Received: (.+)/g,
      /expect\((.+)\)\.(.+)\n/g
    ];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(output)) !== null) {
        errors.push({
          type: 'assertion',
          expected: match[1],
          received: match[2] || 'unknown'
        });
      }
    });
    
    return errors;
  }

  identifyPatterns() {
    // Analyze compilation errors
    this.failures.compilation.forEach(failure => {
      failure.errors.forEach(error => {
        if (error.property) {
          const key = `Missing property: ${error.property}`;
          if (!this.patterns.has(key)) {
            this.patterns.set(key, {
              count: 0,
              examples: [],
              types: new Set()
            });
          }
          const pattern = this.patterns.get(key);
          pattern.count++;
          pattern.types.add(error.type);
          if (pattern.examples.length < 3) {
            pattern.examples.push(path.basename(failure.file));
          }
        }
        
        // Track error codes
        const codeKey = `Error ${error.code}`;
        if (!this.patterns.has(codeKey)) {
          this.patterns.set(codeKey, {
            count: 0,
            examples: [],
            messages: new Set()
          });
        }
        const codePattern = this.patterns.get(codeKey);
        codePattern.count++;
        codePattern.messages.add(error.message.substring(0, 100));
        if (codePattern.examples.length < 3) {
          codePattern.examples.push(path.basename(failure.file));
        }
      });
    });
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST FAILURE ANALYSIS REPORT');
    console.log('='.repeat(60));
    
    // Summary
    console.log('\n📈 SUMMARY');
    console.log(`  Compilation failures: ${this.failures.compilation.length} files`);
    console.log(`  Runtime failures: ${this.failures.runtime.length} files`);
    console.log(`  Assertion failures: ${this.failures.assertion.length} files`);
    
    // Top patterns
    console.log('\n🔍 TOP FAILURE PATTERNS');
    const sortedPatterns = Array.from(this.patterns.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);
    
    sortedPatterns.forEach(([key, data]) => {
      console.log(`\n  ${key} (${data.count} occurrences)`);
      if (data.types && data.types.size > 0) {
        console.log(`    Types: ${Array.from(data.types).slice(0, 3).join(', ')}`);
      }
      if (data.messages && data.messages.size > 0) {
        console.log(`    Messages:`);
        Array.from(data.messages).slice(0, 2).forEach(msg => {
          console.log(`      - ${msg}...`);
        });
      }
      console.log(`    Examples: ${data.examples.join(', ')}`);
    });
    
    // Common missing properties
    console.log('\n❌ MISSING PROPERTIES');
    const missingProps = new Map();
    
    this.failures.compilation.forEach(failure => {
      failure.errors.forEach(error => {
        if (error.property) {
          const key = error.property;
          if (!missingProps.has(key)) {
            missingProps.set(key, {
              count: 0,
              types: new Set(),
              files: new Set()
            });
          }
          const prop = missingProps.get(key);
          prop.count++;
          prop.types.add(error.type);
          prop.files.add(path.basename(failure.file));
        }
      });
    });
    
    const sortedProps = Array.from(missingProps.entries())
      .sort((a, b) => b[1].count - a[1].count);
    
    sortedProps.forEach(([prop, data]) => {
      console.log(`\n  Property: ${prop} (${data.count} times)`);
      console.log(`    On types: ${Array.from(data.types).slice(0, 5).join(', ')}`);
      console.log(`    In files: ${Array.from(data.files).slice(0, 3).join(', ')}`);
    });
    
    // Root causes
    console.log('\n🔧 ROOT CAUSES');
    console.log('  1. AST type definitions don\'t match actual parser output');
    console.log('  2. Properties have different names (e.g., "then" vs "consequent")');
    console.log('  3. Optional properties not properly marked');
    console.log('  4. Node kinds differ from TypeScript definitions');
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS');
    console.log('  1. Update AST type definitions to match actual parser');
    console.log('  2. Enhance ast-compat.ts compatibility layer');
    console.log('  3. Add type guards for optional properties');
    console.log('  4. Create AST structure documentation');
    
    // Export detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        compilationFailures: this.failures.compilation.length,
        runtimeFailures: this.failures.runtime.length,
        assertionFailures: this.failures.assertion.length
      },
      patterns: Object.fromEntries(
        Array.from(this.patterns.entries()).map(([k, v]) => [
          k, 
          {
            count: v.count,
            examples: v.examples,
            types: v.types ? Array.from(v.types) : undefined,
            messages: v.messages ? Array.from(v.messages) : undefined
          }
        ])
      ),
      missingProperties: Object.fromEntries(
        Array.from(missingProps.entries()).map(([k, v]) => [
          k,
          {
            count: v.count,
            types: Array.from(v.types),
            files: Array.from(v.files)
          }
        ])
      ),
      failures: this.failures
    };
    
    fs.writeFileSync('test-failure-analysis.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Detailed report saved to: test-failure-analysis.json');
  }
}

// Run analysis
const analyzer = new TestFailureAnalyzer();
analyzer.analyze();