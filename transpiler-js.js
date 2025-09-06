// Simple JavaScript transpiler that removes all type annotations
const fs = require('fs');
const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

class SimpleJSTranspiler {
  constructor() {
    this.output = '';
    this.indentLevel = 0;
  }
  
  emit(text) {
    this.output += text;
  }
  
  emitLine(text = '') {
    this.output += text + '\n';
  }
  
  indent() {
    this.indentLevel++;
  }
  
  dedent() {
    this.indentLevel--;
  }
  
  emitIndent() {
    this.output += '  '.repeat(this.indentLevel);
  }
  
  transpile(ast) {
    this.visitProgram(ast);
    return this.output;
  }
  
  visitProgram(node) {
    for (const item of node.body) {
      this.visitNode(item);
    }
  }
  
  visitNode(node) {
    if (!node) return;
    
    switch (node.kind) {
      case 'Import':
        this.emitIndent();
        this.emit(`// import from '${node.path}'`);
        this.emitLine();
        break;
        
      case 'ClassDecl':
        this.emitIndent();
        this.emit('class ' + node.name.name);
        if (node.extends) {
          this.emit(' extends ' + node.extends.id.name);
        }
        this.emitLine(' {');
        this.indent();
        
        for (const member of node.members || []) {
          this.emitIndent();
          if (member.kind === 'Constructor') {
            this.emit('constructor(');
            // Skip parameter types
            if (member.params) {
              const paramNames = member.params.map(p => p.name.name).join(', ');
              this.emit(paramNames);
            }
            this.emit(') ');
            this.emitLine('{');
            this.indent();
            if (member.body?.statements) {
              for (const stmt of member.body.statements) {
                this.visitNode(stmt);
              }
            }
            this.dedent();
            this.emitIndent();
            this.emitLine('}');
          } else if (member.kind === 'Method') {
            if (member.static) this.emit('static ');
            this.emit(member.name.name + '(');
            if (member.params) {
              const paramNames = member.params.map(p => p.name.name).join(', ');
              this.emit(paramNames);
            }
            this.emit(') ');
            this.emitLine('{');
            this.indent();
            if (member.body?.statements) {
              for (const stmt of member.body.statements) {
                this.visitNode(stmt);
              }
            }
            this.dedent();
            this.emitIndent();
            this.emitLine('}');
          } else if (member.kind === 'Field') {
            // Skip field declarations in JavaScript
            this.emit('// ' + member.name.name);
            this.emitLine();
          }
        }
        
        this.dedent();
        this.emitIndent();
        this.emitLine('}');
        break;
        
      case 'ExprStmt':
        this.emitIndent();
        this.emit(this.expressionToString(node.expr));
        this.emitLine(';');
        break;
        
      case 'Return':
        this.emitIndent();
        this.emit('return');
        if (node.values && node.values.length > 0) {
          this.emit(' ');
          this.emit(this.expressionToString(node.values[0]));
        }
        this.emitLine(';');
        break;
        
      case 'If':
        this.emitIndent();
        this.emit('if (');
        this.emit(this.expressionToString(node.arms[0].test));
        this.emitLine(') {');
        this.indent();
        for (const stmt of node.arms[0].body.statements || []) {
          this.visitNode(stmt);
        }
        this.dedent();
        this.emitIndent();
        this.emitLine('}');
        break;
        
      case 'VarDecl':
      case 'ConstDecl':
        this.emitIndent();
        const keyword = node.kind === 'ConstDecl' ? 'const' : 'let';
        this.emit(keyword + ' ');
        this.emit(node.names.map(n => n.name).join(', '));
        if (node.values && node.values.length > 0) {
          this.emit(' = ');
          this.emit(this.expressionToString(node.values[0]));
        }
        this.emitLine(';');
        break;
        
      default:
        this.emitIndent();
        this.emitLine(`// TODO: ${node.kind}`);
    }
  }
  
  expressionToString(expr) {
    if (!expr) return 'undefined';
    
    switch (expr.kind) {
      case 'Identifier':
        return expr.name;
      case 'NumericLiteral':
        return expr.raw;
      case 'StringLiteral':
        return expr.raw || `'${expr.value}'`;
      case 'BooleanLiteral':
        return expr.value ? 'true' : 'false';
      case 'Member':
        return this.expressionToString(expr.object) + '.' + expr.property.name;
      case 'Call':
        return this.expressionToString(expr.callee) + '(' +
          expr.args.map(a => this.expressionToString(a)).join(', ') + ')';
      case 'Binary':
        return this.expressionToString(expr.left) + ' ' + expr.op + ' ' +
          this.expressionToString(expr.right);
      case 'Assign':
        return this.expressionToString(expr.left) + ' = ' +
          this.expressionToString(expr.right);
      case 'Unary':
        if (expr.prefix) {
          return expr.op + this.expressionToString(expr.argument);
        } else {
          return this.expressionToString(expr.argument) + expr.op;
        }
      default:
        return `/* ${expr.kind} */`;
    }
  }
}

// Test on a small portion of parser.ts
const source = fs.readFileSync('./src/parser.ts', 'utf-8');
const firstClass = source.substring(0, 2000); // Just first part

console.log('Testing simple JS transpiler on parser.ts excerpt');
console.log('='.repeat(50));

const lexer = new Lexer(firstClass);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

if (parser.errors.length === 0) {
  const transpiler = new SimpleJSTranspiler();
  const output = transpiler.transpile(ast);
  
  console.log('Output:');
  console.log(output);
  
  // Try to validate syntax
  try {
    new Function(output);
    console.log('\n✅ Valid JavaScript syntax!');
  } catch (e) {
    console.log('\n❌ Syntax error:', e.message);
  }
}