/**
 * Main Test Helpers Export
 * 
 * Combines all test utilities for easy import in tests
 */

export * from './ast-verifiers';
export * from './pattern-matchers';

// Re-export verifiers from ast-verifiers
export {
  verifyJSXElement,
  verifyGenericType,
  verifyBinaryOp,
  verifyComparison,
  verifyChannelSend,
  verifyChannelReceive,
  verifyAngleBrackets,
  verifyFunctionDecl
} from './ast-verifiers';

// Re-export pattern matchers
export {
  findJSXElements,
  findGenericTypes,
  findComparisons,
  findChannelOperations,
  findAllAngleBracketUsages,
  analyzeAngleBrackets,
  
  // Type guards
  isJSXElement,
  isGenericType,
  isComparison,
  isChannelSend,
  isChannelReceive,
  
  // Generic finders
  findByKind,
  findFirst
} from './pattern-matchers';

import { Lexer } from '../../src/lexer';
import { Parser } from '../../src/parser';
import * as AST from '../../src/ast';

/**
 * Helper to parse code and return AST
 */
export function parseCode(code: string): AST.Program {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Helper to parse and analyze in one step
 */
export function parseAndAnalyze(code: string) {
  const ast = parseCode(code);
  const { analyzeAngleBrackets } = require('./pattern-matchers');
  const stats = analyzeAngleBrackets(ast);
  return { ast, stats };
}