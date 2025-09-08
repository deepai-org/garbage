const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

function testImport(code, description) {
  console.log(`\n${description}:`);
  console.log(`Code: ${code}`);
  
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    const importDecl = ast.body[0];
    console.log('Import kind:', importDecl.kind);
    
    if (importDecl.kind === 'ImportDecl') {
      console.log('Path:', importDecl.path);
      
      if (importDecl.defaultImport) {
        console.log('Default import:', importDecl.defaultImport.name);
      }
      
      if (importDecl.namespaceImport) {
        console.log('Namespace import:', importDecl.namespaceImport.name);
      }
      
      if (importDecl.specifiers) {
        console.log('Specifiers:');
        importDecl.specifiers.forEach(spec => {
          console.log(`  - ${spec.imported}${spec.imported !== spec.local ? ' as ' + spec.local : ''}`);
        });
      }
    } else {
      console.log('Old Import - path:', importDecl.path, 'alias:', importDecl.alias?.name);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

// Test various import types
testImport(`import { foo, bar as baz, qux } from 'module';`, 'Destructured imports');
testImport(`import * as AST from './ast';`, 'Namespace import');
testImport(`import React from 'react';`, 'Default import');
testImport(`import React, { Component, useState } from 'react';`, 'Default with destructured');
testImport(`import 'styles.css';`, 'Side-effect import');