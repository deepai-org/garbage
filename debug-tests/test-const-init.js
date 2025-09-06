const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
    return <input ref={ref} {...props} />
})`;

console.log('Testing const declaration parsing...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Full AST:', JSON.stringify(ast, null, 2).substring(0, 2000));