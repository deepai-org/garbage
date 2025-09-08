const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
class Component {
  @Input() title: string;
  @Output() click = new EventEmitter();
  
  @HostListener('click')
  onClick() { }
}`;

console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

const classDecl = ast.body[0];
console.log('\nClass members:');
classDecl.members.forEach((m, i) => {
  console.log(`  ${i}: ${m.kind} "${m.name?.name}"`, 
    m.decorators ? `decorators: ${m.decorators.map(d => d.name.name).join(', ')}` : '');
});