# PolyScript Parser Performance Benchmark

Generated: 2025-09-06T00:28:06.928Z

## Environment
- Node: v23.10.0
- Platform: darwin
- Architecture: arm64

## Results

| Test | Mean (ms) | Median (ms) | P95 (ms) | Ops/sec | Chars/ms |
|------|-----------|-------------|----------|---------|----------|
| Simple Variable Declaration | 0.002 | 0.001 | 0.003 | 447146 | 4919 |
| Function Declaration | 0.006 | 0.005 | 0.008 | 181388 | 6530 |
| JSX Element | 0.007 | 0.007 | 0.009 | 135623 | 6103 |
| Complex Expression | 0.009 | 0.008 | 0.012 | 110708 | 5535 |
| Class Declaration | 0.016 | 0.013 | 0.028 | 61577 | 11761 |
| Pattern Matching | 0.011 | 0.009 | 0.016 | 91326 | 11690 |
| Async/Await | 0.015 | 0.014 | 0.018 | 67630 | 13932 |
| Channel Operations | 0.019 | 0.018 | 0.031 | 51710 | 4344 |
| Mixed Paradigms | 0.021 | 0.020 | 0.028 | 47024 | 6960 |
| Large File Simulation | 0.584 | 0.562 | 0.748 | 1713 | 5545 |

## Summary
- Total Tests: 10
- Total Operations: 37,100
- Average Throughput: 119585 ops/sec
