#!/bin/bash
# Publisher P2P dual-instance test suite
# Tests app publishing and remote app information queries
#
# Flow: Publisher on instance 1 creates apps, instance 2 queries via P2P

set -e

CURL="/home/alistair/mochi/test/claude/curl.sh"

PASSED=0
FAILED=0

pass() {
    echo "[PASS] $1"
    ((PASSED++)) || true
}

fail() {
    echo "[FAIL] $1: $2"
    ((FAILED++)) || true
}

echo "=============================================="
echo "Publisher Dual-Instance P2P Test Suite"
echo "=============================================="

# ============================================================================
# SETUP: Create a minimal test app zip
# ============================================================================

echo ""
echo "--- Setup: Create Test App Package ---"

# Create a minimal app package (files at root of zip, not in subdirectory)
TEMP_DIR=$(mktemp -d)
mkdir -p "$TEMP_DIR/labels"

cat > "$TEMP_DIR/app.json" << 'EOF'
{
    "version": "1.0.0",
    "label": "app.name",
    "paths": ["test-app"],
    "architecture": {"engine": "starlark", "version": 2},
    "execute": ["test.star"],
    "actions": {
        "": {"function": "action_index"}
    }
}
EOF

cat > "$TEMP_DIR/test.star" << 'EOF'
def action_index(a):
    return {"data": {"message": "Hello from test app"}}
EOF

cat > "$TEMP_DIR/labels/en.conf" << 'EOF'
app.name = P2P Test App
EOF

# Create zip file with files at root
(cd "$TEMP_DIR" && zip -r test-app.zip app.json test.star labels) > /dev/null 2>&1
TEST_APP_ZIP="$TEMP_DIR/test-app.zip"

if [ -f "$TEST_APP_ZIP" ]; then
    pass "Created test app package"
else
    fail "Create test app package" "Failed to create zip"
    exit 1
fi

# ============================================================================
# TEST: Create app on instance 1's publisher
# ============================================================================

echo ""
echo "--- Create App on Publisher (Instance 1) ---"

RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"name":"P2P Test App","privacy":"public"}' "/publisher/create")
APP_ID=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

if [ -n "$APP_ID" ]; then
    pass "Create app on publisher (id: $APP_ID)"
else
    fail "Create app on publisher" "$RESULT"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# ============================================================================
# TEST: Upload version to publisher
# ============================================================================

echo ""
echo "--- Upload Version to Publisher ---"

# Upload the test app version
RESULT=$("$CURL" -i 1 -a admin -X POST \
    -F "file=@$TEST_APP_ZIP" \
    -F "install=no" \
    "/publisher/$APP_ID/version/create")
VERSION=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['version'])" 2>/dev/null)

if [ -n "$VERSION" ]; then
    pass "Upload app version (version: $VERSION)"
else
    fail "Upload app version" "$RESULT"
fi

# Clean up temp files
rm -rf "$TEMP_DIR"

# ============================================================================
# TEST: View app on instance 1
# ============================================================================

echo ""
echo "--- View App on Publisher ---"

RESULT=$("$CURL" -i 1 -a admin -X GET "/publisher/view/$APP_ID")
if echo "$RESULT" | grep -q '"name":"P2P Test App"'; then
    pass "View app on publisher"
else
    fail "View app on publisher" "$RESULT"
fi

# Verify tracks are set
if echo "$RESULT" | grep -q '"track":"production"'; then
    pass "App has production track"
else
    fail "App has production track" "$RESULT"
fi

sleep 1

# ============================================================================
# TEST: Query app information from instance 2 via P2P
# ============================================================================

echo ""
echo "--- Query App Info from Instance 2 (P2P) ---"

RESULT=$("$CURL" -i 2 -a admin -X GET "/apps/information?id=$APP_ID")
if echo "$RESULT" | grep -q '"name":"P2P Test App"'; then
    pass "Query app info via P2P"
else
    fail "Query app info via P2P" "$RESULT"
fi

# Check fingerprint is returned
if echo "$RESULT" | grep -q '"fingerprint"'; then
    pass "App fingerprint returned"
else
    fail "App fingerprint returned" "$RESULT"
fi

# Check tracks are returned
if echo "$RESULT" | grep -q '"track"'; then
    pass "App tracks returned via P2P"
else
    fail "App tracks returned" "$RESULT"
fi

# ============================================================================
# TEST: List apps on instance 1's publisher
# ============================================================================

echo ""
echo "--- List Apps on Publisher ---"

RESULT=$("$CURL" -i 1 -a admin -X GET "/publisher/list")
if echo "$RESULT" | grep -q "\"id\":\"$APP_ID\""; then
    pass "App appears in publisher list"
else
    fail "App in publisher list" "$RESULT"
fi

# ============================================================================
# TEST: Create private app (should not be accessible via P2P)
# ============================================================================

echo ""
echo "--- Private App Access Control Test ---"

RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"name":"Private App","privacy":"private"}' "/publisher/create")
PRIVATE_APP_ID=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

if [ -n "$PRIVATE_APP_ID" ]; then
    pass "Create private app (id: $PRIVATE_APP_ID)"
else
    fail "Create private app" "$RESULT"
fi

sleep 1

# Try to query private app from instance 2 (should fail)
RESULT=$("$CURL" -i 2 -a admin -X GET "/apps/information?id=$PRIVATE_APP_ID")
if echo "$RESULT" | grep -q '"error"'; then
    pass "Private app not accessible via P2P"
else
    fail "Private app should not be accessible" "$RESULT"
fi

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "=============================================="
echo "Results: $PASSED passed, $FAILED failed"
echo "=============================================="

if [ $FAILED -gt 0 ]; then
    exit 1
fi
