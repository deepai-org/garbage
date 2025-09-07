const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code1 = `<string>value`;
const code2 = `<Component>content</Component>`;
const code3 = `<T>() => {}`;

console.log('Testing type assertion vs JSX disambiguation...\n');

console.log('Test 1: <string>value (should be type assertion)');
let lexer = new Lexer(code1);
let tokens = lexer.tokenize();
tokens.forEach((t, i) => {
    if (t.type !== 'WHITESPACE' && t.type !== 'EOF') {
        console.log(`  [${i}] "${t.value}" (${t.type})`);
    }
});

console.log('\nTest 2: <Component>content</Component> (should be JSX)');
lexer = new Lexer(code2);
tokens = lexer.tokenize();
tokens.forEach((t, i) => {
    if (t.type !== 'WHITESPACE' && t.type !== 'EOF') {
        console.log(`  [${i}] "${t.value}" (${t.type})`);
    }
});

console.log('\nTest 3: <T>() => {} (generic arrow function)');
lexer = new Lexer(code3);
tokens = lexer.tokenize();
tokens.forEach((t, i) => {
    if (t.type !== 'WHITESPACE' && t.type !== 'EOF') {
        console.log(`  [${i}] "${t.value}" (${t.type})`);
    }
});