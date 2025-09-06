const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const util = require('util');

function debug(code, description) {
    console.log('\n' + '='.repeat(60));
    console.log(description);
    console.log('Code:', code);
    console.log('-'.repeat(60));
    
    try {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        
        console.log('Tokens:');
        tokens.forEach((t, i) => {
            if (t.type !== 'EOF') {
                console.log(`  [${i}] ${t.type}: "${t.value}"`);
            }
        });
        
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        console.log('\nAST:', util.inspect(ast, { depth: 4, colors: true }));
        
        // Check what was parsed
        const astStr = JSON.stringify(ast);
        if (astStr.includes('JSX')) {
            console.log('✅ Detected as JSX');
        } else if (astStr.includes('GenericType')) {
            console.log('✅ Detected as Generic');
        } else if (astStr.includes('"op":"<')) {
            console.log('✅ Detected as Comparison');
        } else {
            console.log('⚠️  Detection unclear');
        }
        
    } catch (e) {
        console.log('❌ Error:', e.message);
    }
}

// Debug failing cases
debug('x <= 5', 'Less than or equal');
debug('x >= 5', 'Greater than or equal'); 
debug('x >>> 2', 'Unsigned right shift');
debug('<Button>', 'Incomplete JSX element');
debug('Array<T>', 'Generic type without context');
debug('chan<string>', 'Channel type');
debug('<Type>expr', 'Type assertion');