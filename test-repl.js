#!/usr/bin/env node

const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test cases to demonstrate the REPL capabilities
const testCases = [
  {
    name: "Simple function",
    code: "function greet(name: string): string { return `Hello, ${name}!` }"
  },
  {
    name: "Arrow function with JSX",
    code: "const Button = ({ label }) => <button>{label}</button>"
  },
  {
    name: "Class with generics",
    code: "class Box<T> { value: T; getValue(): T { return this.value } }"
  },
  {
    name: "Async function",
    code: "async function fetchData(url: string) { return await fetch(url) }"
  },
  {
    name: "Python-style list comprehension",
    code: "[x * 2 for x in range(10) if x % 2 == 0]"
  },
  {
    name: "Go-style channel operation",
    code: "ch := make(chan int, 100)"
  },
  {
    name: "Pattern matching",
    code: "match value { case 1 => 'one', case 2 => 'two', default => 'other' }"
  },
  {
    name: "JSX with expression",
    code: "<div>{items.map(item => <li>{item}</li>)}</div>"
  },
  {
    name: "Interface declaration",
    code: "interface User { name: string; age: number; isActive(): boolean }"
  },
  {
    name: "Type alias",
    code: "type Result<T> = { success: boolean; data: T }"
  }
];

console.log("PolyScript REPL Test Cases\n");
console.log("=" .repeat(60));

testCases.forEach(({ name, code }) => {
  console.log(`\n### ${name}`);
  console.log(`Code: ${code}`);
  
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log("✓ Successfully parsed");
    console.log(`  AST nodes: ${ast.body.length}`);
    if (ast.body[0]) {
      console.log(`  Root type: ${ast.body[0].kind}`);
    }
  } catch (error) {
    console.log(`✗ Parse error: ${error.message}`);
  }
});

console.log("\n" + "=".repeat(60));
console.log("\nTo use the interactive REPL, run: node repl.js");
console.log("\nREPL Commands:");
console.log("  .ast    - Show only AST output");
console.log("  .ts     - Show only TypeScript output");
console.log("  .both   - Show both AST and TypeScript (default)");
console.log("  .clear  - Clear the screen");
console.log("  .exit   - Exit the REPL");