const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `def foo
  items.each do |item|
    puts item
  end
end`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Starting state:');
console.log('Token[0]:', tokens[0].value, '(def)');
console.log('Token[1]:', tokens[1].value, '(foo)');
console.log('Token[2]:', tokens[2].value, '(virtual semi)');
console.log('Parser should start looking from index 2\n');

// Simulate the scan from current position (after 'foo')
let startPos = 2; // After 'def foo'
let functionEndPos = -1;
let blockStartCount = 0;

console.log('Scanning from position', startPos, '...');
for (let i = startPos; i < tokens.length; i++) {
    const tok = tokens[i];
    
    if (tok.value === "do" || tok.value === "begin" || 
        tok.value === "class" || tok.value === "module" || 
        tok.value === "def" || tok.value === "if" || 
        tok.value === "unless" || tok.value === "case" ||
        tok.value === "while" || tok.value === "until" ||
        tok.value === "for") {
        blockStartCount++;
        console.log(`[${i}] "${tok.value}" -> blockStartCount = ${blockStartCount}`);
    } else if (tok.value === "end") {
        if (blockStartCount > 0) {
            blockStartCount--;
            console.log(`[${i}] "end" -> blockStartCount = ${blockStartCount} (nested end)`);
        } else {
            console.log(`[${i}] "end" -> FUNCTION END FOUND`);
            functionEndPos = i;
            break;
        }
    }
}

console.log('\nResult: functionEndPos =', functionEndPos);
console.log('Expected: 15');

// Now actually parse
console.log('\n--- Actual parsing ---');
const parser = new Parser(tokens);
try {
    const ast = parser.parse();
    console.log('Parse succeeded');
    console.log('AST body:', ast.body);
} catch (e) {
    console.log('Parse error:', e.message);
}