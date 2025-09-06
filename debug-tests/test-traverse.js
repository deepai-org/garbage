const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

function traverseAST(node, visitor, path = []) {
  if (!node || typeof node !== 'object') return;
  
  visitor(node, path);
  
  for (const key in node) {
    if (key === 'span' || key === 'loc') continue;
    
    const value = node[key];
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          traverseAST(item, visitor, [...path, `${key}[${index}]`]);
        });
      } else {
        traverseAST(value, visitor, [...path, key]);
      }
    }
  }
}

const code = `match value {
  Some(x) if x > 0 => {
    case x when
      1..10) "single digit"
      11..99) "double digit"
      _) "large"
    esac
  }
  None => "empty"
  Ok(result) => match result.type {
    Pattern::Regex(r) => r.test(input)
    Pattern::Glob(g) => g.match(input)
    _ => false
  }
  Err(e) => throw e
}`;

console.log('Testing traversal of complex pattern matching...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST parsed, traversing...\n');

const comparisons = [];
traverseAST(ast, (node, path) => {
    if (node.kind === 'Binary' && ['>', '<', '>=', '<='].includes(node.op)) {
        console.log(`Found comparison at path: ${path.join('.')}`);
        console.log(`  ${node.left?.name || node.left?.kind} ${node.op} ${node.right?.value || node.right?.kind}`);
        comparisons.push(node);
    }
});

console.log('\nTotal comparisons found:', comparisons.length);