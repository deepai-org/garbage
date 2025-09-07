const { Lexer } = require('../dist/lexer');

const code = `case $option in
  "start")
    console.log(\`Starting service...\`)
    ;;
  "stop")
    echo "Stopping..."
    ;;
  *)
    throw new Error("Unknown option")
    ;;
esac`;

console.log('Testing switch/case tokens...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

let inCase = false;
tokens.forEach((t, i) => {
    if (t.type !== 'WHITESPACE') {
        if (t.value === 'case' || t.value === 'esac' || 
            t.type === 'STRING' || t.value === ')' || t.value === ';;' || t.value === '*') {
            console.log(`[${i}] "${t.value}" (${t.type})`);
        }
    }
});