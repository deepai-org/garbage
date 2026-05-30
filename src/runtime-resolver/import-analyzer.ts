import { OmniRuntime, RuntimeAffinity, AffinityEvidence } from './types';

/**
 * Known module → runtime mappings for common imports.
 */
const PYTHON_MODULES = new Set([
  "os", "sys", "math", "json", "re", "datetime", "collections", "itertools",
  "functools", "pathlib", "typing", "dataclasses", "abc", "enum", "io",
  "logging", "unittest", "pytest", "asyncio", "aiohttp", "requests",
  "flask", "django", "fastapi", "numpy", "pandas", "scipy", "matplotlib",
  "tensorflow", "torch", "sklearn", "sqlalchemy", "celery", "pydantic",
  "beautifulsoup4", "bs4", "jinja2", "httpx", "markdown",
  "selenium", "scrapy", "PIL", "cv2", "pickle",
  "subprocess", "threading", "multiprocessing", "socket", "http",
  "urllib", "email", "csv", "xml", "html", "hashlib", "hmac",
  "secrets", "random", "statistics", "decimal", "fractions",
  "copy", "pprint", "textwrap", "difflib", "struct", "codecs",
  "unicodedata", "locale", "gettext", "argparse", "configparser",
  "contextlib", "inspect", "traceback", "warnings", "atexit",
  "signal", "time", "calendar", "sched", "queue", "heapq", "bisect",
  "array", "weakref", "types", "importlib", "pkgutil", "zipimport",
  "compileall", "dis", "ast", "symtable", "token", "keyword",
  "linecache", "tokenize", "tabnanny", "pyclbr",
]);

const GO_MODULES = new Set([
  "fmt", "os", "io", "net", "http", "strings", "strconv", "math",
  "sort", "sync", "context", "time", "encoding", "encoding/json",
  "encoding/xml", "encoding/csv", "encoding/base64", "encoding/binary",
  "database/sql", "crypto", "crypto/hmac", "crypto/sha256", "crypto/md5", "crypto/rand",
  "encoding/hex",
  "path", "path/filepath", "regexp", "log", "errors", "reflect",
  "unsafe", "runtime", "testing", "flag", "bufio", "bytes",
  "container/list", "container/heap", "container/ring",
  "html/template", "text/template", "text/scanner",
  "net/http", "net/url", "net/rpc", "net/smtp",
  "os/exec", "os/signal", "os/user",
  "io/ioutil", "io/fs",
  "sync/atomic",
  "image", "image/png", "image/jpeg",
  "archive/tar", "archive/zip",
  "compress/gzip", "compress/zlib",
  "go/ast", "go/parser", "go/token",
  "github.com",  // Go module paths often start with domain
]);

const JS_MODULES = new Set([
  "react", "react-dom", "vue", "angular", "svelte", "next", "nuxt",
  "express", "koa", "fastify", "hapi", "nest", "nestjs",
  "lodash", "underscore", "ramda", "rxjs", "immutable",
  "zod", "cheerio", "marked", "d3-shape",
  "axios", "node-fetch", "got", "superagent",
  "moment", "dayjs", "date-fns", "luxon",
  "webpack", "rollup", "vite", "parcel", "esbuild",
  "babel", "typescript", "ts-node",
  "jest", "mocha", "chai", "jasmine", "vitest",
  "mongoose", "sequelize", "typeorm", "prisma", "knex",
  "socket.io", "ws", "redis", "bull", "amqplib",
  "passport", "jsonwebtoken", "bcrypt", "helmet",
  "chalk", "commander", "inquirer", "yargs", "ora",
  "fs", "path", "http", "https", "crypto", "stream", "events",
  "child_process", "cluster", "os", "url", "querystring",
  "util", "assert", "buffer", "zlib", "tls", "net", "dns",
  "readline", "repl", "vm", "worker_threads", "perf_hooks",
  "styled-components", "emotion", "tailwindcss",
  "graphql", "apollo", "relay",
  "three", "d3", "chart.js", "pixi.js",
  "electron", "puppeteer", "playwright",
]);

const RUBY_MODULES = new Set([
  "rails", "sinatra", "rack", "puma", "unicorn", "thin",
  "activerecord", "activesupport", "actionpack", "actionview",
  "nokogiri", "httparty", "faraday", "rest-client",
  "rspec", "minitest", "capybara", "factory_bot",
  "devise", "cancancan", "pundit", "omniauth",
  "sidekiq", "resque", "delayed_job", "good_job",
  "rubocop", "bundler", "rake", "thor",
  "json", "yaml", "csv", "erb", "haml", "slim",
  "redis", "pg", "mysql2", "sqlite3", "mongoid",
  "aws-sdk", "fog", "carrierwave", "paperclip",
  "kaminari", "will_paginate", "ransack",
  "stripe", "braintree", "twilio-ruby",
  "cocoapods", "fastlane",
]);

const JAVA_MODULES = new Set([
  "java.lang", "java.util", "java.io", "java.nio", "java.net",
  "java.math", "java.time", "java.text", "java.sql", "java.security",
  "java.util.concurrent", "java.util.stream", "java.util.function",
  "java.util.regex", "java.util.logging",
  "javax.servlet", "javax.persistence", "javax.annotation",
  "javax.inject", "javax.validation", "javax.ws.rs",
  "org.springframework", "org.hibernate", "org.junit",
  "org.apache", "org.slf4j", "org.mockito",
  "com.google", "com.fasterxml.jackson", "com.squareup",
  "okhttp3",
  "io.netty", "io.grpc", "io.reactivex",
  "jakarta.servlet", "jakarta.persistence",
  "lombok",
]);

/**
 * Analyze an import path and infer the runtime affinity.
 */
export function analyzeImportPath(path: string): RuntimeAffinity | undefined {
  const evidence: AffinityEvidence = { type: "import", detail: `import "${path}"` };

  // Go module paths: quoted strings with / and often domain-like prefixes
  if (path.startsWith("github.com/") || path.startsWith("golang.org/") ||
      path.startsWith("google.golang.org/")) {
    return { runtime: OmniRuntime.Go, confidence: "definite", evidence: [evidence] };
  }

  // Java package paths: dotted with java/javax/org/com prefix
  if (/^(java|javax|org|com|io|jakarta)\.[a-z]/.test(path)) {
    return { runtime: OmniRuntime.Java, confidence: "definite", evidence: [evidence] };
  }
  if (JAVA_MODULES.has(path)) {
    return { runtime: OmniRuntime.Java, confidence: "definite", evidence: [evidence] };
  }

  // Go standard library: short unquoted names that match known Go packages
  if (GO_MODULES.has(path)) {
    return { runtime: OmniRuntime.Go, confidence: "inferred", evidence: [evidence] };
  }

  // Python modules
  if (PYTHON_MODULES.has(path)) {
    return { runtime: OmniRuntime.Python, confidence: "inferred", evidence: [evidence] };
  }
  if ([...PYTHON_MODULES].some(mod => path.startsWith(`${mod}.`))) {
    return { runtime: OmniRuntime.Python, confidence: "inferred", evidence: [evidence] };
  }

  // JS modules (npm-style)
  if (JS_MODULES.has(path)) {
    return { runtime: OmniRuntime.JavaScript, confidence: "inferred", evidence: [evidence] };
  }
  // Relative imports with .js/.ts/.jsx/.tsx extension
  if (/\.(js|ts|jsx|tsx|mjs|cjs)$/.test(path) || path.startsWith("./") || path.startsWith("../")) {
    return { runtime: OmniRuntime.JavaScript, confidence: "inferred", evidence: [evidence] };
  }
  // Scoped npm packages
  if (path.startsWith("@") && path.includes("/")) {
    return { runtime: OmniRuntime.JavaScript, confidence: "inferred", evidence: [evidence] };
  }

  // Ruby gems (require with dash/underscore naming)
  if (RUBY_MODULES.has(path)) {
    return { runtime: OmniRuntime.Ruby, confidence: "inferred", evidence: [evidence] };
  }

  return undefined;
}

/**
 * Analyze a bare import name (without quotes) for runtime affinity.
 * Python uses `import os`, Go uses `import "fmt"`.
 */
export function analyzeBareImport(name: string): RuntimeAffinity | undefined {
  const evidence: AffinityEvidence = { type: "import", detail: `import ${name}` };

  if (PYTHON_MODULES.has(name)) {
    return { runtime: OmniRuntime.Python, confidence: "inferred", evidence: [evidence] };
  }

  if (GO_MODULES.has(name)) {
    return { runtime: OmniRuntime.Go, confidence: "inferred", evidence: [evidence] };
  }

  if (JS_MODULES.has(name)) {
    return { runtime: OmniRuntime.JavaScript, confidence: "inferred", evidence: [evidence] };
  }

  if (RUBY_MODULES.has(name)) {
    return { runtime: OmniRuntime.Ruby, confidence: "inferred", evidence: [evidence] };
  }

  if (JAVA_MODULES.has(name)) {
    return { runtime: OmniRuntime.Java, confidence: "inferred", evidence: [evidence] };
  }

  return undefined;
}
