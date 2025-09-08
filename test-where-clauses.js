const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

function testWhereClause(code, description) {
  console.log(`\n${description}:`);
  console.log(`Code: ${code}`);
  
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    const stmt = ast.body[0];
    if (stmt.kind === 'ImplDecl') {
      console.log('Impl block found:');
      console.log('  Type:', stmt.type ? stmt.type.kind : 'none');
      console.log('  Trait:', stmt.trait ? stmt.trait.kind : 'none');
      console.log('  Where clause:', stmt.whereClause ? 'YES' : 'NO');
      
      if (stmt.whereClause) {
        console.log('  Where constraints:');
        if (Array.isArray(stmt.whereClause)) {
          stmt.whereClause.forEach((constraint, i) => {
            console.log(`    ${i}: ${JSON.stringify(constraint)}`);
          });
        } else {
          console.log(`    ${JSON.stringify(stmt.whereClause)}`);
        }
      }
      
      console.log('  Members:', stmt.members ? stmt.members.length : 0);
    } else {
      console.log('Statement kind:', stmt.kind);
    }
  } catch (e) {
    console.error('Error:', e.message);
    if (e.message.includes('where')) {
      console.error('Note: Where clause parsing issue detected');
    }
  }
}

// Test various where clause scenarios
console.log('=== Testing Where Clauses in Impl Blocks ===');

// Simple where clause
testWhereClause(`impl<T> Container<T> where T: Clone {
  fn clone_first(&self) -> T {
    self.items[0].clone()
  }
}`, 'Simple where clause with single constraint');

// Multiple constraints
testWhereClause(`impl<T, U> Pair<T, U> 
where 
  T: Display + Debug,
  U: Clone + Send
{
  fn show(&self) { }
}`, 'Multiple constraints in where clause');

// Complex constraints
testWhereClause(`impl<T> Graph<T> 
where 
  T: Eq + Hash,
  T::Item: Display,
  for<'a> &'a T: IntoIterator
{
  fn process(&self) { }
}`, 'Complex where clause with associated types and HRTB');

// Trait impl with where clause
testWhereClause(`impl<T> Display for Container<T> 
where T: Display {
  fn fmt(&self, f: &mut Formatter) -> Result {
    write!(f, "{}", self.value)
  }
}`, 'Trait implementation with where clause');

// Empty impl with where clause (should still parse the clause)
testWhereClause(`impl<T> Container<T> where T: Default {
}`, 'Empty impl with where clause');