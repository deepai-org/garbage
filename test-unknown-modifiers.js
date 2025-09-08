const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

function testUnknownModifiers(code, description) {
  console.log(`\n=== ${description} ===`);
  console.log('Code:', code);
  
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('Parsed successfully!');
    
    const cls = ast.body[0];
    if (cls.kind === 'ClassDecl' && cls.members) {
      console.log('Class members:');
      cls.members.forEach((m, i) => {
        const info = [`  ${i}: ${m.kind} "${m.name?.name || '?'}"`];
        if (m.visibility) info.push(`visibility=${m.visibility}`);
        if (m.static) info.push('static');
        if (m.readonly) info.push('readonly');
        if (m.unknownModifiers) info.push(`unknown=[${m.unknownModifiers.join(', ')}]`);
        console.log(info.join(' '));
      });
    }
  } catch (e) {
    console.error('Parse error:', e.message);
  }
}

// Test cases for unknown modifiers
testUnknownModifiers(`class Test {
  volatile x: number;
}`, 'Volatile field');

testUnknownModifiers(`class Test {
  synchronized foo() {}
}`, 'Synchronized method');

testUnknownModifiers(`class Test {
  transient private data: any;
}`, 'Mixed known and unknown modifiers');

testUnknownModifiers(`class Test {
  native extern getSystemTime(): number;
}`, 'Multiple unknown modifiers');

testUnknownModifiers(`class Test {
  public volatile static readonly x: number = 5;
}`, 'Complex modifier mix');