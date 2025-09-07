const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Patch the Parser to log current position
const originalParse = Parser.prototype.parse;
let logPoints = [];

Parser.prototype.parse = function() {
    // Hook into parseFuncDecl to log position
    const origParseFuncDecl = this.parseFuncDecl;
    this.parseFuncDecl = function(...args) {
        const startCurrent = this.current;
        logPoints.push({ phase: 'parseFuncDecl start', current: startCurrent, token: this.tokens[startCurrent]?.value });
        
        // After parsing name
        const origParseIdentifier = this.parseIdentifier;
        this.parseIdentifier = function() {
            const result = origParseIdentifier.call(this);
            logPoints.push({ phase: 'after parseIdentifier', current: this.current, token: this.tokens[this.current]?.value });
            this.parseIdentifier = origParseIdentifier; // Restore
            return result;
        };
        
        return origParseFuncDecl.call(this, ...args);
    };
    
    return originalParse.call(this);
};

const code = `def foo
  items.each do |item|
    puts item
  end
end`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Token positions:');
tokens.forEach((t, i) => {
    if (i < 7 || t.value === 'do' || t.value === 'end') {
        console.log(`[${i}] "${t.value}"`);
    }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nParser position tracking:');
logPoints.forEach(lp => {
    console.log(`${lp.phase}: current=${lp.current}, token="${lp.token}"`);
});

console.log('\nResult: AST body length =', ast.body.length);