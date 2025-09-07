const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Import normalization
function normalizeSwitchStmt(stmt) {
  if (!stmt) return stmt;
  
  let result = stmt;
  
  // Map discriminant to expr if needed
  if (stmt.discriminant && !stmt.expr) {
    result = {
      ...result,
      expr: stmt.discriminant
    };
  }
  
  // If there's a separate defaultCase, merge it into cases array
  if (stmt.defaultCase && stmt.cases) {
    const cases = [...stmt.cases];
    // Add default case to the array with isDefault flag
    cases.push({
      isDefault: true,
      value: null,
      patterns: [],
      body: stmt.defaultCase // defaultCase is already a Block
    });
    result = {
      ...result,
      cases
    };
  }
  
  return result;
}

const code = `case $option in
  "start")
    console.log("Starting")
    ;;
  "stop")
    echo "Stopping"
    ;;
  *)
    echo "Unknown"
    ;;
esac`;

console.log('Testing normalized Bash case...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    const switchStmt = ast.body[0];
    
    console.log('Before normalization:');
    console.log('  Cases:', switchStmt.cases?.length);
    console.log('  Has defaultCase:', !!switchStmt.defaultCase);
    
    const normalized = normalizeSwitchStmt(switchStmt);
    
    console.log('\nAfter normalization:');
    console.log('  Cases:', normalized.cases?.length);
    console.log('  Case types:');
    normalized.cases?.forEach((c, i) => {
        if (c.isDefault) {
            console.log(`    Case ${i}: DEFAULT`);
        } else if (c.patterns?.[0]) {
            console.log(`    Case ${i}: pattern`);
        }
    });
} catch (e) {
    console.log('Parse error:', e.message);
}