/**
 * Imports Parselet — Extracted from Parser (Chunk 5).
 *
 * Import statement parsing: ES6, CommonJS, Go grouped, Python from-import.
 * Depends on a narrow ImportHost interface — no direct Parser import.
 */

import { Token, TokenType } from '../lexer';
import * as AST from '../ast';

export interface ImportHost {
  tokens: Token[];
  current: number;

  peek(): Token;
  peekNext(): Token | undefined;
  advance(): Token;
  check(value: string): boolean;
  match(...values: string[]): boolean;
  consume(expected: TokenType | string, message: string): Token;
  isAtEnd(): boolean;
  previous(): Token | undefined;
  error(token: Token, message: string): Error;
  createSpan(start: number, end: number): AST.Span;
  createSpanFrom(node: { span: AST.Span } | Token): AST.Span;
  consumeSemicolon(): void;

  parseIdentifier(): AST.Identifier;
}

export function parseImport(host: ImportHost): AST.Import | AST.ImportDecl {
  const start = host.current - 1;

  let alias: AST.Identifier | undefined;
  let path: string;

  // Destructured imports: import { Token, TokenType } from './lexer'
  if (host.check("{")) {
    host.advance();

    const specifiers: AST.ImportSpecifier[] = [];

    if (!host.check("}")) {
      do {
        const imported = host.parseIdentifier().name;
        let local = imported;
        if (host.match("as")) {
          local = host.parseIdentifier().name;
        }
        specifiers.push({ imported, local });
      } while (host.match(",") && !host.check("}"));
    }

    host.consume("}", "Expected '}' after import specifiers");

    if (host.match("from")) {
      if (host.peek().type === TokenType.StringLiteral) {
        const token = host.advance();
        path = token.value.slice(1, -1);
      } else {
        throw host.error(host.peek(), "Expected import path after 'from'");
      }
    } else {
      throw host.error(host.peek(), "Expected 'from' after import specifiers");
    }

    host.consumeSemicolon();

    return {
      kind: "ImportDecl",
      specifiers,
      path,
      span: host.createSpan(start, host.current - 1)
    };
  }
  // Namespace import: import * as AST from './ast'
  else if (host.check("*")) {
    host.advance();
    let namespaceImport: AST.Identifier | undefined;
    if (host.match("as")) {
      namespaceImport = host.parseIdentifier();
    }

    if (host.match("from")) {
      if (host.peek().type === TokenType.StringLiteral) {
        const token = host.advance();
        path = token.value.slice(1, -1);
      } else {
        throw host.error(host.peek(), "Expected import path after 'from'");
      }
    } else {
      throw host.error(host.peek(), "Expected 'from' after namespace import");
    }

    host.consumeSemicolon();

    return {
      kind: "ImportDecl",
      namespaceImport,
      path,
      span: host.createSpan(start, host.current - 1)
    };
  }
  // Default import with destructured: import React, { Component } from 'react'
  else if (host.peek().type === TokenType.Identifier) {
    const nextToken = host.peekNext();

    if (nextToken && nextToken.value === ",") {
      const defaultImport = host.parseIdentifier();
      host.consume(",", "Expected ','");

      const specifiers: AST.ImportSpecifier[] = [];
      if (host.check("{")) {
        host.advance();

        if (!host.check("}")) {
          do {
            const imported = host.parseIdentifier().name;
            let local = imported;
            if (host.match("as")) {
              local = host.parseIdentifier().name;
            }
            specifiers.push({ imported, local });
          } while (host.match(",") && !host.check("}"));
        }

        host.consume("}", "Expected '}' after import specifiers");
      }

      if (host.match("from")) {
        if (host.peek().type === TokenType.StringLiteral) {
          const token = host.advance();
          path = token.value.slice(1, -1);
        } else {
          throw host.error(host.peek(), "Expected import path after 'from'");
        }
      } else {
        throw host.error(host.peek(), "Expected 'from' after import specifiers");
      }

      host.consumeSemicolon();

      return {
        kind: "ImportDecl",
        defaultImport,
        specifiers: specifiers.length > 0 ? specifiers : undefined,
        path,
        span: host.createSpan(start, host.current - 1)
      };
    }
    // Default import: import Parser from './parser'
    else if (nextToken && nextToken.value === "from") {
      const defaultImport = host.parseIdentifier();
      host.consume("from", "Expected 'from'");

      if (host.peek().type === TokenType.StringLiteral) {
        const token = host.advance();
        path = token.value.slice(1, -1);
      } else {
        throw host.error(host.peek(), "Expected import path after 'from'");
      }

      host.consumeSemicolon();

      return {
        kind: "ImportDecl",
        defaultImport,
        path,
        span: host.createSpan(start, host.current - 1)
      };
    }
    // Old-style simple import (dotted or :: separated)
    else {
      let pathParts = [host.advance().value];
      while (host.match(".") || host.match("::")) {
        const sep = host.previous()!.value;
        if (host.peek().type === TokenType.Identifier || host.peek().type === TokenType.Keyword) {
          pathParts.push(sep === "::" ? "::" : ".");
          pathParts.push(host.advance().value);
        } else if (host.match("*")) {
          pathParts.push(sep === "::" ? "::" : ".");
          pathParts.push("*");
        } else break;
      }
      path = pathParts.join("");
      if (host.match("as")) {
        alias = host.parseIdentifier();
      }
    }
  }
  // String literal import: import './styles.css'
  else if (host.peek().type === TokenType.StringLiteral) {
    const token = host.advance();
    path = token.value.slice(1, -1);

    if (host.match("as")) {
      alias = host.parseIdentifier();
    }
  }
  // Go grouped imports: import ( "fmt" "os" )
  else if (host.check("(")) {
    host.advance(); // consume '('
    const imports: (AST.Import | AST.ImportDecl)[] = [];
    while (!host.check(")") && !host.isAtEnd()) {
      while (host.peek().virtualSemi) host.advance();
      if (host.check(")")) break;
      if (host.peek().type === TokenType.StringLiteral) {
        const token = host.advance();
        const importPath = token.value.slice(1, -1);
        let importAlias: AST.Identifier | undefined;
        if (host.match("as")) {
          importAlias = host.parseIdentifier();
        }
        imports.push({
          kind: "Import",
          path: importPath,
          alias: importAlias,
          span: host.createSpanFrom(token)
        });
      } else if (host.peek().type === TokenType.Identifier) {
        const importAlias = host.parseIdentifier();
        if (host.peek().type === TokenType.StringLiteral) {
          const token = host.advance();
          const importPath = token.value.slice(1, -1);
          imports.push({
            kind: "Import",
            path: importPath,
            alias: importAlias,
            span: host.createSpanFrom(token)
          });
        }
      } else {
        host.advance();
      }
      while (host.peek().virtualSemi) host.advance();
    }
    host.consume(")", "Expected ')' after grouped imports");
    host.consumeSemicolon();

    if (imports.length === 0) {
      return { kind: "Import", path: "", span: host.createSpan(start, host.current - 1) };
    }
    return imports[0];
  } else {
    throw host.error(host.peek(), "Expected import path");
  }

  host.consumeSemicolon();

  return {
    kind: "Import",
    path: path!,
    alias,
    span: host.createSpan(start, host.current - 1)
  };
}

export function parseFromImport(host: ImportHost): AST.ImportDecl {
  const start = host.current;
  host.advance(); // consume 'from'

  let path: string;
  if (host.peek().type === TokenType.StringLiteral) {
    const token = host.advance();
    path = token.value.slice(1, -1);
  } else {
    let pathParts = [host.advance().value];
    while (host.match(".")) {
      pathParts.push(host.advance().value);
    }
    path = pathParts.join(".");
  }

  host.consume("import", "Expected 'import' after module path");

  const specifiers: AST.ImportSpecifier[] = [];
  do {
    const imported = host.parseIdentifier().name;
    let local = imported;
    if (host.match("as")) {
      local = host.parseIdentifier().name;
    }
    specifiers.push({ imported, local });
  } while (host.match(","));

  host.consumeSemicolon();

  return {
    kind: "ImportDecl",
    specifiers,
    path,
    span: host.createSpan(start, host.current - 1)
  };
}
