const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
function test() {
  begin
    processed := data
      |> validate
      |> transform
      |> enrich
    
    match processed {
      {status: "success", value} => results.push(value),
      {status: "error", reason} => errors.push(reason),
      _ => console.warn("Unknown")
    }
  rescue ProcessingError => e
    errors.push(e.message)
    retry if retries < 3
  end
}`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Key token positions:');
for (let i = 0; i < tokens.length; i++) {
  const t = tokens[i];
  if (t.value === 'function' || t.value === '{' || t.value === 'begin' || 
      t.value === 'end' || t.value === '}' || t.value === 'match' || t.value === 'rescue') {
    console.log(`  [${i}] ${t.value}`);
  }
}

const parser = new Parser(tokens);

// Track where we get stuck
let callNum = 0;
let lastPos = -1;
let stuckCount = 0;

const originalParse = parser.parse.bind(parser);
parser.parse = function() {
  const originalParseTopLevel = this.parseTopLevel.bind(this);
  this.parseTopLevel = function() {
    callNum++;
    const pos = this.current;
    const token = this.peek()?.value;
    
    if (pos === lastPos) {
      stuckCount++;
      if (stuckCount === 5) {
        console.log(`\nStuck at position ${pos}, token: ${token}`);
        console.log(`braceDepth: ${this.braceDepth}`);
        console.log(`Call stack might be:`, new Error().stack.split('\n').slice(2, 5).map(s => s.trim()).join(' -> '));
        process.exit(1);
      }
    } else {
      lastPos = pos;
      stuckCount = 0;
    }
    
    if (callNum <= 10 || callNum % 10 === 0) {
      console.log(`[${callNum}] pos=${pos}, token=${token}`);
    }
    
    if (callNum > 100) {
      console.log('Too many calls!');
      process.exit(1);
    }
    
    return originalParseTopLevel();
  };
  
  return originalParse();
};

const ast = parser.parse();
console.log('Success!');