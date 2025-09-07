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
 * Throws an error if parsing produces any errors (ensures tests only pass with clean parses)
 */
export function parseCode(code: string): AST.Program {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  // Check for any parsing errors
  const errors = (parser as any).errors || [];
  if (errors.length > 0) {
    const errorMessages = errors.map((e: any) => 
      `${e.message} at ${e.token?.line || 'unknown'}:${e.token?.column || 'unknown'}`
    ).join('\n  ');
    throw new Error(`Parser produced ${errors.length} error(s):\n  ${errorMessages}`);
  }
  
  return ast;
}

/**
 * Helper to parse code allowing errors (for error testing)
 */
export function parseCodeWithErrors(code: string): { ast: AST.Program; errors: any[] } {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const errors = (parser as any).errors || [];
  return { ast, errors };
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