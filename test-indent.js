const { quickTest } = require('./debug-utils');

// Test with actual indentation
const code = `def middle():
  fn inner():
    return 1
  return inner`;

console.log('Testing indented code:');
quickTest(code, { showTokens: true });