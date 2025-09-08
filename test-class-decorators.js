const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
@Component
class MyComponent {
  @Input() title: string;
  
  @HostListener('click')
  onClick() { }
}`;

console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

const classDecl = ast.body[0];
console.log('\nClass decorators:', classDecl.decorators?.length || 0);

console.log('\nMembers:');
classDecl.members.forEach((member, i) => {
  console.log(`Member ${i}:`);
  console.log('  kind:', member.kind);
  console.log('  name:', member.name?.name);
  console.log('  decorators:', member.decorators?.length || 0);
  if (member.decorators) {
    member.decorators.forEach(d => {
      console.log(`    - @${d.name.name}`);
    });
  }
});