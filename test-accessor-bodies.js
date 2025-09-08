const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

function testAccessorBodies(code, description) {
  console.log(`\n${description}:`);
  console.log(`Code: ${code}`);
  
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    const stmt = ast.body[0];
    if (stmt.kind === 'ClassDecl') {
      console.log('Class found:', stmt.name.name);
      console.log('Members:');
      stmt.members.forEach((member, i) => {
        if (member.kind === 'Field') {
          console.log(`  ${i}: Field "${member.name?.name}":`);
          console.log(`      Type: ${member.type ? member.type.kind : 'none'}`);
          console.log(`      Has value: ${member.value ? 'yes' : 'no'}`);
          
          // Check for accessor bodies (get/set)
          if (member.getter) {
            console.log(`      Has getter: yes`);
            console.log(`        Getter body statements: ${member.getter.statements ? member.getter.statements.length : 0}`);
          }
          if (member.setter) {
            console.log(`      Has setter: yes`);
            console.log(`        Setter body statements: ${member.setter.statements ? member.setter.statements.length : 0}`);
          }
        } else if (member.kind === 'Property') {
          console.log(`  ${i}: Property "${member.name?.name}":`);
          console.log(`      Type: ${member.type ? member.type.kind : 'none'}`);
          if (member.getter) {
            console.log(`      Has getter: yes`);
            console.log(`        Getter body: ${member.getter ? JSON.stringify(member.getter) : 'none'}`);
          }
          if (member.setter) {
            console.log(`      Has setter: yes`);
            console.log(`        Setter body: ${member.setter ? JSON.stringify(member.setter) : 'none'}`);
          }
        } else {
          console.log(`  ${i}: ${member.kind} "${member.name?.name || '<anonymous>'}"`);
        }
      });
    } else {
      console.log('Statement kind:', stmt.kind);
    }
  } catch (e) {
    console.error('Error:', e.message);
    if (e.message.includes('accessor') || e.message.includes('get') || e.message.includes('set')) {
      console.error('Note: Accessor parsing issue detected');
    }
  }
}

// Test various property accessor scenarios
console.log('=== Testing Property Accessor Bodies ===');

// C# style properties with accessor bodies
testAccessorBodies(`class Person {
  private string _name;
  
  public string Name {
    get {
      return _name;
    }
    set {
      _name = value;
    }
  }
}`, 'C# style property with get/set bodies');

// TypeScript style getters and setters
testAccessorBodies(`class Temperature {
  private _celsius: number = 0;
  
  get celsius(): number {
    return this._celsius;
  }
  
  set celsius(value: number) {
    this._celsius = value;
  }
  
  get fahrenheit(): number {
    return this._celsius * 9/5 + 32;
  }
  
  set fahrenheit(value: number) {
    this._celsius = (value - 32) * 5/9;
  }
}`, 'TypeScript style getters and setters');

// Mixed accessor styles
testAccessorBodies(`class Mixed {
  public string Status { get; set; }
  
  private int _count;
  public int Count {
    get { return _count; }
    private set { _count = value; }
  }
}`, 'Mixed accessor styles');

// Simple auto-properties
testAccessorBodies(`class AutoProps {
  public string Title { get; set; }
  public int Age { get; private set; }
  public bool IsActive { get; }
}`, 'Auto-properties without bodies');