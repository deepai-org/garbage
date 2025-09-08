const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

function testImplMember(code, description) {
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
      console.log('  Members:', stmt.members ? stmt.members.length : 0);
      
      if (stmt.members && stmt.members.length > 0) {
        stmt.members.forEach((member, i) => {
          console.log(`  Member ${i}:`);
          console.log(`    Kind: ${member.kind}`);
          if (member.name) {
            console.log(`    Name: ${member.name.name || member.name}`);
          }
          if (member.value !== undefined) {
            console.log(`    Has value: ${member.value ? 'YES' : 'NO'}`);
          }
        });
      }
    } else {
      console.log('Statement kind:', stmt.kind);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

console.log('=== Testing Impl Block Members ===');

// Test associated types
testImplMember(`impl<T> Iterator for Container<T> {
  type Item = T;
  type IntoIter = std::vec::IntoIter<T>;
}`, 'Associated types in impl block');

// Test associated constants
testImplMember(`impl MyTrait for MyStruct {
  const MAX_SIZE: usize = 1024;
  const DEFAULT_NAME: &'static str = "default";
}`, 'Associated constants in impl block');

// Test mixed members
testImplMember(`impl<T> Container<T> {
  type Item = T;
  const CAPACITY: usize = 100;
  
  fn new() -> Self {
    Self { items: Vec::new() }
  }
  
  fn push(&mut self, item: T) {
    self.items.push(item);
  }
}`, 'Mixed types, constants, and functions');

// Test with where clause and various members
testImplMember(`impl<T> Display for Container<T> 
where T: Display {
  type Error = fmt::Error;
  
  fn fmt(&self, f: &mut Formatter) -> Result {
    write!(f, "{}", self.value)
  }
}`, 'Impl with where clause and mixed members');

// Test const fn (special function type)
testImplMember(`impl Math {
  const fn square(x: i32) -> i32 {
    x * x
  }
  
  pub const fn cube(x: i32) -> i32 {
    x * x * x
  }
}`, 'Const functions in impl block');