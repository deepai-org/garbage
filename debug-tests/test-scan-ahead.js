const { Lexer } = require('../dist/lexer');

// Test the scan-ahead logic
const code = `def foo
  items.each do |item|
    puts item
  end
end`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Simulating scan-ahead logic:\n');

let blockStartCount = 0;
let foundEndAt = -1;

// Start from token after 'foo' (index 2)
for (let i = 2; i < tokens.length; i++) {
    const tok = tokens[i];
    console.log(`[${i}] "${tok.value}" (${tok.type})`);
    
    if (tok.value === "do" || tok.value === "begin" || 
        tok.value === "class" || tok.value === "module" || 
        tok.value === "def" || tok.value === "if" || 
        tok.value === "unless" || tok.value === "case" ||
        tok.value === "while" || tok.value === "until" ||
        tok.value === "for") {
        blockStartCount++;
        console.log(`   -> Block start! Count now: ${blockStartCount}`);
    } else if (tok.value === "end") {
        if (blockStartCount > 0) {
            blockStartCount--;
            console.log(`   -> Nested end. Count now: ${blockStartCount}`);
        } else {
            console.log(`   -> FUNCTION END FOUND!`);
            foundEndAt = i;
            break;
        }
    }
}

console.log(`\nFunction's 'end' found at index: ${foundEndAt}`);
console.log(`That token is: "${tokens[foundEndAt]?.value}"`);