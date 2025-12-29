#!/bin/bash
# Publisher track management test suite
# Tests track CRUD operations and default track behavior
#
# Requires: Single instance running with admin access

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
echo "Publisher Track Management Test Suite"
echo "=============================================="

# ============================================================================
# SETUP: Create test app with multiple versions
# ============================================================================

echo ""
echo "--- Setup: Create Test App ---"

# Create app
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"name":"Track Test App","privacy":"public"}' "/publisher/create")
APP_ID=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

if [ -n "$APP_ID" ]; then
    pass "Create test app (id: $APP_ID)"
else
    fail "Create test app" "$RESULT"
    exit 1
fi

# Create temp directory for test app packages
TEMP_DIR=$(mktemp -d)

create_app_zip() {
    local version="$1"
    local zip_path="$TEMP_DIR/app-$version.zip"

    mkdir -p "$TEMP_DIR/v$version/labels"

    cat > "$TEMP_DIR/v$version/app.json" << EOF
{
    "version": "$version",
    "label": "app_name",
    "paths": ["track-test"],
    "architecture": {"engine": "starlark", "version": 2},
    "execute": ["test.star"],
    "actions": {
        "": {"function": "action_index"}
    }
}
EOF

    cat > "$TEMP_DIR/v$version/test.star" << 'EOF'
def action_index(a):
    return {"data": {"message": "Hello"}}
EOF

    cat > "$TEMP_DIR/v$version/labels/en.conf" << 'EOF'
app_name = Track Test App
EOF

    (cd "$TEMP_DIR/v$version" && zip -r "$zip_path" app.json test.star labels) > /dev/null 2>&1
    echo "$zip_path"
}

# Upload version 1.0
ZIP_1=$(create_app_zip "1.0")
RESULT=$("$CURL" -i 1 -a admin -X POST -F "file=@$ZIP_1" -F "install=no" "/publisher/$APP_ID/version/create")
if echo "$RESULT" | grep -q '"version":"1.0"'; then
    pass "Upload version 1.0"
else
    fail "Upload version 1.0" "$RESULT"
fi

# Upload version 1.1
ZIP_2=$(create_app_zip "1.1")
RESULT=$("$CURL" -i 1 -a admin -X POST -F "file=@$ZIP_2" -F "install=no" "/publisher/$APP_ID/version/create")
if echo "$RESULT" | grep -q '"version":"1.1"'; then
    pass "Upload version 1.1"
else
    fail "Upload version 1.1" "$RESULT"
fi

# Upload version 2.0.0
ZIP_3=$(create_app_zip "2.0.0")
RESULT=$("$CURL" -i 1 -a admin -X POST -F "file=@$ZIP_3" -F "install=no" "/publisher/$APP_ID/version/create")
if echo "$RESULT" | grep -q '"version":"2.0.0"'; then
    pass "Upload version 2.0.0"
else
    fail "Upload version 2.0.0" "$RESULT"
fi

# Clean up temp files
rm -rf "$TEMP_DIR"

# ============================================================================
# TEST: Verify production track exists (auto-created on upload)
# ============================================================================

echo ""
echo "--- Verify Initial Track State ---"

RESULT=$("$CURL" -i 1 -a admin -X GET "/publisher/view?app=$APP_ID")
if echo "$RESULT" | grep -q '"track":"production"'; then
    pass "Production track exists"
else
    fail "Production track exists" "$RESULT"
fi

# Production track should point to latest version (2.0.0)
if echo "$RESULT" | grep -q '"production".*"2.0.0"\|"track":"production","version":"2.0.0"'; then
    pass "Production track points to latest version"
else
    # Check with different JSON format
    TRACK_VERSION=$(echo "$RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for t in data['data']['tracks']:
    if t['track'] == 'production':
        print(t['version'])
" 2>/dev/null)
    if [ "$TRACK_VERSION" = "2.0.0" ]; then
        pass "Production track points to latest version"
    else
        fail "Production track points to latest" "Got: $TRACK_VERSION"
    fi
fi

# Verify default_track is production
if echo "$RESULT" | grep -q '"default_track":"production"'; then
    pass "Default track is production"
else
    fail "Default track is production" "$RESULT"
fi

# ============================================================================
# TEST: Create new track
# ============================================================================

echo ""
echo "--- Create Track Tests ---"

# Create stable track pointing to 1.1
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d "{\"app\":\"$APP_ID\",\"track\":\"stable\",\"version\":\"1.1\"}" "/publisher/$APP_ID/track/create")
if echo "$RESULT" | grep -q '"track":"stable"'; then
    pass "Create stable track"
else
    fail "Create stable track" "$RESULT"
fi

# Create beta track pointing to 2.0.0
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d "{\"app\":\"$APP_ID\",\"track\":\"beta\",\"version\":\"2.0.0\"}" "/publisher/$APP_ID/track/create")
if echo "$RESULT" | grep -q '"track":"beta"'; then
    pass "Create beta track"
else
    fail "Create beta track" "$RESULT"
fi

# Try to create duplicate track (should fail)
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d "{\"app\":\"$APP_ID\",\"track\":\"stable\",\"version\":\"1.0\"}" "/publisher/$APP_ID/track/create")
if echo "$RESULT" | grep -q '"error"'; then
    pass "Duplicate track rejected"
else
    fail "Duplicate track should be rejected" "$RESULT"
fi

# Try to create track with non-existent version (should fail)
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d "{\"app\":\"$APP_ID\",\"track\":\"nightly\",\"version\":\"9.9.9\"}" "/publisher/$APP_ID/track/create")
if echo "$RESULT" | grep -q '"error"'; then
    pass "Track with invalid version rejected"
else
    fail "Track with invalid version should be rejected" "$RESULT"
fi

# Try to create track with invalid name (should fail)
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d "{\"app\":\"$APP_ID\",\"track\":\"invalid name!\",\"version\":\"1.0\"}" "/publisher/$APP_ID/track/create")
if echo "$RESULT" | grep -q '"error"'; then
    pass "Track with invalid name rejected"
else
    fail "Track with invalid name should be rejected" "$RESULT"
fi

# ============================================================================
# TEST: Set track version
# ============================================================================

echo ""
echo "--- Set Track Version Tests ---"

# Update stable track to point to 1.0
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d "{\"app\":\"$APP_ID\",\"track\":\"stable\",\"version\":\"1.0\"}" "/publisher/$APP_ID/track/set")
if echo "$RESULT" | grep -q '"version":"1.0"'; then
    pass "Set stable track to 1.0"
else
    fail "Set stable track to 1.0" "$RESULT"
fi

# Try to set non-existent track (should fail)
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d "{\"app\":\"$APP_ID\",\"track\":\"nonexistent\",\"version\":\"1.0\"}" "/publisher/$APP_ID/track/set")
if echo "$RESULT" | grep -q '"error"'; then
    pass "Set non-existent track rejected"
else
    fail "Set non-existent track should be rejected" "$RESULT"
fi

# Try to set track to non-existent version (should fail)
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d "{\"app\":\"$APP_ID\",\"track\":\"stable\",\"version\":\"9.9.9\"}" "/publisher/$APP_ID/track/set")
if echo "$RESULT" | grep -q '"error"'; then
    pass "Set track to invalid version rejected"
else
    fail "Set track to invalid version should be rejected" "$RESULT"
fi

# ============================================================================
# TEST: Set default track
# ============================================================================

echo ""
echo "--- Set Default Track Tests ---"

# Set default track to stable
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d "{\"app\":\"$APP_ID\",\"track\":\"stable\"}" "/publisher/$APP_ID/default-track/set")
if echo "$RESULT" | grep -q '"default_track":"stable"'; then
    pass "Set default track to stable"
else
    fail "Set default track to stable" "$RESULT"
fi

# Verify default track changed
RESULT=$("$CURL" -i 1 -a admin -X GET "/publisher/view?app=$APP_ID")
if echo "$RESULT" | grep -q '"default_track":"stable"'; then
    pass "Default track is now stable"
else
    fail "Default track should be stable" "$RESULT"
fi

# Try to set default to non-existent track (should fail)
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d "{\"app\":\"$APP_ID\",\"track\":\"nonexistent\"}" "/publisher/$APP_ID/default-track/set")
if echo "$RESULT" | grep -q '"error"'; then
    pass "Set default to non-existent track rejected"
else
    fail "Set default to non-existent track should be rejected" "$RESULT"
fi

# ============================================================================
# TEST: Delete track
# ============================================================================

echo ""
echo "--- Delete Track Tests ---"

# Try to delete default track (should fail)
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d "{\"app\":\"$APP_ID\",\"track\":\"stable\"}" "/publisher/$APP_ID/track/delete")
if echo "$RESULT" | grep -q '"error"'; then
    pass "Delete default track rejected"
else
    fail "Delete default track should be rejected" "$RESULT"
fi

# Delete beta track (not default, should succeed)
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d "{\"app\":\"$APP_ID\",\"track\":\"beta\"}" "/publisher/$APP_ID/track/delete")
if echo "$RESULT" | grep -q '"deleted":"beta"'; then
    pass "Delete beta track"
else
    fail "Delete beta track" "$RESULT"
fi

# Verify beta track is gone
RESULT=$("$CURL" -i 1 -a admin -X GET "/publisher/view?app=$APP_ID")
if echo "$RESULT" | grep -q '"track":"beta"'; then
    fail "Beta track should be deleted" "$RESULT"
else
    pass "Beta track no longer exists"
fi

# ============================================================================
# TEST: P2P event_version with default track
# ============================================================================

echo ""
echo "--- P2P Event Version Tests ---"

# Query version without specifying track (should use default track = stable = 1.0)
RESULT=$("$CURL" -i 1 -a admin -X GET "/apps/version?id=$APP_ID")
VERSION=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('version', ''))" 2>/dev/null)
TRACK=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('track', ''))" 2>/dev/null)
DEFAULT=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('default_track', ''))" 2>/dev/null)

if [ "$VERSION" = "1.0" ]; then
    pass "Version query returns default track version (1.0)"
else
    fail "Version query should return 1.0" "Got: $VERSION"
fi

if [ "$TRACK" = "stable" ]; then
    pass "Version query returns track name (stable)"
else
    fail "Version query should return track stable" "Got: $TRACK"
fi

if [ "$DEFAULT" = "stable" ]; then
    pass "Version query returns default_track (stable)"
else
    fail "Version query should return default_track stable" "Got: $DEFAULT"
fi

# Query specific track (production)
RESULT=$("$CURL" -i 1 -a admin -X GET "/apps/version?id=$APP_ID&track=production")
VERSION=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('version', ''))" 2>/dev/null)

if [ "$VERSION" = "2.0.0" ]; then
    pass "Version query with track=production returns 2.0.0"
else
    fail "Version query with track=production should return 2.0.0" "Got: $VERSION"
fi

# ============================================================================
# TEST: P2P event_information includes default_track
# ============================================================================

echo ""
echo "--- P2P Event Information Tests ---"

RESULT=$("$CURL" -i 1 -a admin -X GET "/apps/information?id=$APP_ID")
if echo "$RESULT" | grep -q '"default_track":"stable"'; then
    pass "Event information includes default_track"
else
    fail "Event information should include default_track" "$RESULT"
fi

# ============================================================================
# TEST: Track names with special characters
# ============================================================================

echo ""
echo "--- Track Name Validation Tests ---"

# Valid: alphanumeric with hyphens and underscores
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d "{\"app\":\"$APP_ID\",\"track\":\"release-candidate_1\",\"version\":\"1.1\"}" "/publisher/$APP_ID/track/create")
if echo "$RESULT" | grep -q '"track":"release-candidate_1"'; then
    pass "Track name with hyphens and underscores accepted"
else
    fail "Track name with hyphens and underscores should be accepted" "$RESULT"
fi

# Invalid: spaces
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d "{\"app\":\"$APP_ID\",\"track\":\"my track\",\"version\":\"1.0\"}" "/publisher/$APP_ID/track/create")
if echo "$RESULT" | grep -q '"error"'; then
    pass "Track name with spaces rejected"
else
    fail "Track name with spaces should be rejected" "$RESULT"
fi

# Invalid: special characters
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d "{\"app\":\"$APP_ID\",\"track\":\"track@1\",\"version\":\"1.0\"}" "/publisher/$APP_ID/track/create")
if echo "$RESULT" | grep -q '"error"'; then
    pass "Track name with @ rejected"
else
    fail "Track name with @ should be rejected" "$RESULT"
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
