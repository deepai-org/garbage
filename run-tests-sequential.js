const { execSync } = require('child_process');

const testFiles = [
  'parser.test.ts',
  'parser-polyglot.test.ts', 
  'parser-polyglot-advanced.test.ts',
  'parser-polyglot-showcase.test.ts'
];

console.log('Running tests sequentially...\n');

let totalPassed = 0;
let totalFailed = 0;

for (const file of testFiles) {
  console.log(`\n========== Running ${file} ==========`);
  
  try {
    const output = execSync(`npm test -- ${file} --verbose=false 2>&1`, {
      cwd: process.cwd(),
      timeout: 30000, // 30 second timeout per file
      encoding: 'utf-8'
    });
    
    // Extract pass/fail counts
    const passMatch = output.match(/Tests:.*?(\d+) passed/);
    const failMatch = output.match(/Tests:.*?(\d+) failed/);
    
    const passed = passMatch ? parseInt(passMatch[1]) : 0;
    const failed = failMatch ? parseInt(failMatch[1]) : 0;
    
    console.log(`✅ Passed: ${passed}`);
    if (failed > 0) {
      console.log(`❌ Failed: ${failed}`);
    }
    
    totalPassed += passed;
    totalFailed += failed;
    
  } catch (error) {
    if (error.signal === 'SIGTERM') {
      console.log('❌ Test timed out after 30 seconds');
      totalFailed++;
    } else {
      // Test failures will throw, extract the counts from output
      const output = error.stdout?.toString() || '';
      const passMatch = output.match(/Tests:.*?(\d+) passed/);
      const failMatch = output.match(/Tests:.*?(\d+) failed/);
      
      const passed = passMatch ? parseInt(passMatch[1]) : 0;
      const failed = failMatch ? parseInt(failMatch[1]) : 0;
      
      if (passed > 0) console.log(`✅ Passed: ${passed}`);
      if (failed > 0) console.log(`❌ Failed: ${failed}`);
      
      totalPassed += passed;
      totalFailed += failed;
    }
  }
}

console.log('\n========== SUMMARY ==========');
console.log(`Total Passed: ${totalPassed}`);
console.log(`Total Failed: ${totalFailed}`);
console.log(`Pass Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);