#!/bin/bash

# Pre-commit hook for test quality check
# Install by running: ln -s ../../scripts/pre-commit-quality-check.sh .git/hooks/pre-commit

echo "🔍 Running test quality check..."

# Run the quality checker
node test-quality-checker.js > /tmp/quality-check.txt 2>&1

# Extract the quality score
QUALITY_SCORE=$(grep "Average Quality Score:" /tmp/quality-check.txt | grep -oE '[0-9]+\.[0-9]+')

# Check if score meets threshold
THRESHOLD=70
if (( $(echo "$QUALITY_SCORE < $THRESHOLD" | bc -l) )); then
    echo "❌ Test quality score ($QUALITY_SCORE%) is below threshold ($THRESHOLD%)"
    echo ""
    echo "Files needing improvement:"
    grep "📄" /tmp/quality-check.txt | head -5
    echo ""
    echo "Run 'node test-quality-checker.js' for full report"
    echo "Or commit with --no-verify to skip this check"
    exit 1
else
    echo "✅ Test quality score ($QUALITY_SCORE%) meets threshold"
fi

# Check for weak patterns in staged test files
STAGED_TESTS=$(git diff --cached --name-only | grep -E "\.test\.(ts|js)$")

if [ ! -z "$STAGED_TESTS" ]; then
    echo "🔍 Checking staged test files for weak patterns..."
    
    WEAK_PATTERNS_FOUND=0
    for file in $STAGED_TESTS; do
        # Check for not.toThrow pattern
        if grep -q "expect.*not\.toThrow" "$file"; then
            echo "⚠️  $file contains weak 'not.toThrow' pattern"
            WEAK_PATTERNS_FOUND=1
        fi
        
        # Check for toBeDefined without specific checks
        if grep -q "\.kind.*toBeDefined()" "$file"; then
            echo "⚠️  $file contains weak 'kind.toBeDefined' pattern"
            WEAK_PATTERNS_FOUND=1
        fi
    done
    
    if [ $WEAK_PATTERNS_FOUND -eq 1 ]; then
        echo ""
        echo "💡 Consider using test helpers from test/helpers/ast-verifiers.ts"
        echo "   Example: verifyJSXElement(node, 'Component', { selfClosing: true })"
        echo ""
        echo "Commit with --no-verify to skip this check"
        exit 1
    fi
fi

echo "✅ All checks passed"