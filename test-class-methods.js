const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test a class with a method containing local variables
const code = `
export class Parser {
  private parseTemplateLiteral(): AST.StringLiteral {
    const token = this.advance();
    const content = token.value.slice(1, -1);
    const parts: AST.StringPart[] = [];
    
    let current = "";
    let i = 0;
    
    while (i < content.length) {
      if (content[i] === '$' && content[i + 1] === '{') {
        if (current) {
          parts.push({ kind: "Text", value: current });
          current = "";
        }
        
        let depth = 1;
        let end = i + 2;
        
        while (end < content.length && depth > 0) {
          if (content[end] === '{') depth++;
          else if (content[end] === '}') depth--;
          end++;
        }
        
        if (depth === 0) {
          const exprText = content.substring(i + 2, end - 1);
          i = end;
        } else {
          current += content[i];
          i++;
        }
      } else if (content[i] === '\\\\') {
        i++;
        if (i < content.length) {
          switch (content[i]) {
            case 'n': current += '\\n'; break;
            case 't': current += '\\t'; break;
            case 'r': current += '\\r'; break;
            case '\\\\': current += '\\\\'; break;
            default: current += content[i];
          }
          i++;
        }
      } else {
        current += content[i];
        i++;
      }
    }
    
    if (current) {
      parts.push({ kind: "Text", value: current });
    }
    
    return {
      kind: "StringLiteral",
      value: token.value,
      parts,
      span: this.createSpanFrom(token)
    };
  }
  
  private parseRegexLiteral(): AST.RegexLiteral {
    const token = this.advance();
    return {
      kind: "RegexLiteral",
      pattern: "",
      flags: "",
      span: this.createSpanFrom(token)
    };
  }
}
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

let classNode = ast.body[0];
if (classNode?.kind === 'ExportDecl') {
  classNode = classNode.declaration;
}

console.log(`Members parsed: ${classNode.members?.length || 0}`);

// Show which members were parsed
if (classNode.members) {
  classNode.members.forEach((m, idx) => {
    const name = m.name?.name || m.kind || 'Unknown';
    console.log(`  ${idx}: ${name} (${m.kind})`);
  });
}

console.log(`\\nParse errors: ${parser.errors.length}`);

// Show errors
if (parser.errors.length > 0) {
  console.log('\\nErrors:');
  parser.errors.forEach(e => {
    console.log(`  - ${e.message} at token '${e.token?.value}'`);
  });
}