const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `def foo
  items.each do |item|
    puts item
  end
end`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Simulate the Ruby def body parsing loop
console.log('Simulating Ruby def body parsing...\n');

let current = 2; // After 'foo'
let functionEndPos = 15;
const statements = [];

console.log('functionEndPos =', functionEndPos);
console.log('Starting loop from current =', current);

while (current < tokens.length && current < functionEndPos) {
    if (tokens[current].type === 'VirtualSemi') {
        console.log(`[${current}] Skip virtual semi`);
        current++;
        continue;
    }
    
    // Check if we've reached the function's 'end'
    if (tokens[current].value === "end" && current >= functionEndPos) {
        console.log(`[${current}] Reached function end`);
        break;
    }
    
    console.log(`[${current}] Parsing from token: "${tokens[current].value}"`);
    
    // Simulate parseTopLevel - it will consume tokens until a statement ends
    let stmtEnd = current;
    
    // Simple simulation: advance until we hit a semicolon or 'do' or 'end'
    while (stmtEnd < tokens.length) {
        if (tokens[stmtEnd].type === 'VirtualSemi') {
            break;
        }
        if (tokens[stmtEnd].value === 'do') {
            // 'do' starts a block, need to find matching 'end'
            stmtEnd++;
            let doDepth = 1;
            while (stmtEnd < tokens.length && doDepth > 0) {
                if (tokens[stmtEnd].value === 'do') doDepth++;
                if (tokens[stmtEnd].value === 'end') doDepth--;
                stmtEnd++;
            }
            break;
        }
        stmtEnd++;
    }
    
    console.log(`  -> Statement consumes tokens ${current} to ${stmtEnd-1}`);
    statements.push(`Statement from ${current} to ${stmtEnd-1}`);
    current = stmtEnd;
}

console.log('\nFinal state:');
console.log('  current =', current);
console.log('  statements parsed =', statements.length);
console.log('  Reached end?', current >= functionEndPos);