#!/bin/bash
# Test publisher tracks functionality
# Usage: test_tracks.sh [--remote <host>] [app_id]
# If no app_id provided, uses the first app found

set -e

SCRIPT_DIR="$(dirname "$0")"
GET_TOKEN="$SCRIPT_DIR/../../../test/claude/get-token.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() { echo -e "${GREEN}PASS${NC}: $1"; }
fail() { echo -e "${RED}FAIL${NC}: $1"; exit 1; }
info() { echo -e "${YELLOW}INFO${NC}: $1"; }

# Parse arguments
REMOTE_HOST=""
SSH_HOST=""
APP_ID=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --remote)
            REMOTE_HOST="$2"
            shift 2
            ;;
        --ssh)
            SSH_HOST="$2"
            shift 2
            ;;
        *)
            APP_ID="$1"
            shift
            ;;
    esac
done

# Setup curl function based on local or remote
if [ -n "$REMOTE_HOST" ]; then
    # Default SSH host to remote host if not specified
    SSH_HOST="${SSH_HOST:-$REMOTE_HOST}"
    info "Testing against remote host: $REMOTE_HOST (SSH: $SSH_HOST)"
    TOKEN=$("$GET_TOKEN" --remote "$SSH_HOST" admin)
    do_curl() {
        curl -s -b "session=$TOKEN" "https://$REMOTE_HOST$1"
    }
    do_post() {
        local path="$1"
        shift
        curl -s -b "session=$TOKEN" -X POST -d "$@" "https://$REMOTE_HOST$path"
    }
else
    info "Testing against local server (port 8081)"
    TOKEN=$("$GET_TOKEN" admin 1)
    do_curl() {
        curl -s -b "session=$TOKEN" "http://localhost:8081$1"
    }
    do_post() {
        local path="$1"
        shift
        curl -s -b "session=$TOKEN" -X POST -d "$@" "http://localhost:8081$path"
    }
fi

# Get app ID from argument or find one
if [ -z "$APP_ID" ]; then
    info "No app ID provided, finding first app..."
    APPS_JSON=$(do_curl /publisher/list)
    # Response is wrapped in "data" object
    APP_ID=$(echo "$APPS_JSON" | jq -r '.data.apps[0].id // .apps[0].id // empty')
    if [ -z "$APP_ID" ]; then
        fail "No apps found. Create an app first."
    fi
fi

info "Testing with app: $APP_ID"

# Get initial app state
info "Getting app details..."
APP_JSON=$(do_curl "/publisher/view?app=$APP_ID")
# Response may be wrapped in "data" object
APP_NAME=$(echo "$APP_JSON" | jq -r '.data.app.name // .app.name')
DEFAULT_TRACK=$(echo "$APP_JSON" | jq -r '.data.app.default_track // .app.default_track')
TRACK_COUNT=$(echo "$APP_JSON" | jq '.data.tracks // .tracks | length')
VERSION_COUNT=$(echo "$APP_JSON" | jq '.data.versions // .versions | length')

info "App: $APP_NAME"
info "Default track: $DEFAULT_TRACK"
info "Tracks: $TRACK_COUNT"
info "Versions: $VERSION_COUNT"

if [ "$VERSION_COUNT" -eq 0 ]; then
    fail "App has no versions. Upload a version first."
fi

# Get first version for testing
FIRST_VERSION=$(echo "$APP_JSON" | jq -r '(.data.versions // .versions)[0].version')
info "Using version: $FIRST_VERSION"

# Test 1: Create a new track
TEST_TRACK="TestTrack-$$"
info "Creating track: $TEST_TRACK"
CREATE_RESULT=$(do_post "/publisher/$APP_ID/track/create" "app=$APP_ID&track=$TEST_TRACK&version=$FIRST_VERSION")

if echo "$CREATE_RESULT" | jq -e '.data.track // .track' > /dev/null 2>&1; then
    pass "Created track $TEST_TRACK"
else
    ERROR=$(echo "$CREATE_RESULT" | jq -r '.error // .data.error // "Unknown error"')
    fail "Failed to create track: $ERROR"
fi

# Verify track was created
APP_JSON=$(do_curl "/publisher/view?app=$APP_ID")
if echo "$APP_JSON" | jq -e "(.data.tracks // .tracks)[] | select(.track == \"$TEST_TRACK\")" > /dev/null 2>&1; then
    pass "Track $TEST_TRACK appears in track list"
else
    fail "Track $TEST_TRACK not found in track list"
fi

# Test 2: Try to create duplicate track (should fail)
info "Attempting to create duplicate track..."
DUP_RESULT=$(do_post "/publisher/$APP_ID/track/create" "app=$APP_ID&track=$TEST_TRACK&version=$FIRST_VERSION")
if echo "$DUP_RESULT" | jq -e '.error // .data.error' > /dev/null 2>&1; then
    pass "Duplicate track creation rejected"
else
    fail "Duplicate track creation should have failed"
fi

# Test 3: Set track to different version (if multiple versions exist)
if [ "$VERSION_COUNT" -gt 1 ]; then
    SECOND_VERSION=$(echo "$APP_JSON" | jq -r '(.data.versions // .versions)[1].version')
    info "Setting track $TEST_TRACK to version $SECOND_VERSION"
    SET_RESULT=$(do_post "/publisher/$APP_ID/track/set" "app=$APP_ID&track=$TEST_TRACK&version=$SECOND_VERSION")

    if echo "$SET_RESULT" | jq -e '.data.version // .version' > /dev/null 2>&1; then
        pass "Set track version"
    else
        ERROR=$(echo "$SET_RESULT" | jq -r '.error // .data.error // "Unknown error"')
        fail "Failed to set track version: $ERROR"
    fi

    # Verify version changed
    APP_JSON=$(do_curl "/publisher/view?app=$APP_ID")
    TRACK_VERSION=$(echo "$APP_JSON" | jq -r "(.data.tracks // .tracks)[] | select(.track == \"$TEST_TRACK\") | .version")
    if [ "$TRACK_VERSION" == "$SECOND_VERSION" ]; then
        pass "Track version updated correctly"
    else
        fail "Track version not updated (expected $SECOND_VERSION, got $TRACK_VERSION)"
    fi
else
    info "Skipping version change test (only one version exists)"
fi

# Test 4: Set test track as default
info "Setting $TEST_TRACK as default track..."
DEFAULT_RESULT=$(do_post "/publisher/$APP_ID/default-track/set" "app=$APP_ID&track=$TEST_TRACK")

if echo "$DEFAULT_RESULT" | jq -e '.data.default_track // .default_track' > /dev/null 2>&1; then
    pass "Set default track"
else
    ERROR=$(echo "$DEFAULT_RESULT" | jq -r '.error // .data.error // "Unknown error"')
    fail "Failed to set default track: $ERROR"
fi

# Verify default track changed
APP_JSON=$(do_curl "/publisher/view?app=$APP_ID")
NEW_DEFAULT=$(echo "$APP_JSON" | jq -r '.data.app.default_track // .app.default_track')
if [ "$NEW_DEFAULT" == "$TEST_TRACK" ]; then
    pass "Default track updated correctly"
else
    fail "Default track not updated (expected $TEST_TRACK, got $NEW_DEFAULT)"
fi

# Test 5: Try to delete default track (should fail)
info "Attempting to delete default track (should fail)..."
DEL_DEFAULT_RESULT=$(do_post "/publisher/$APP_ID/track/delete" "app=$APP_ID&track=$TEST_TRACK")
if echo "$DEL_DEFAULT_RESULT" | jq -e '.error // .data.error' > /dev/null 2>&1; then
    pass "Cannot delete default track"
else
    fail "Deleting default track should have failed"
fi

# Test 6: Restore original default track
info "Restoring original default track: $DEFAULT_TRACK"
RESTORE_RESULT=$(do_post "/publisher/$APP_ID/default-track/set" "app=$APP_ID&track=$DEFAULT_TRACK")

if echo "$RESTORE_RESULT" | jq -e '.data.default_track // .default_track' > /dev/null 2>&1; then
    pass "Restored original default track"
else
    ERROR=$(echo "$RESTORE_RESULT" | jq -r '.error // .data.error // "Unknown error"')
    fail "Failed to restore default track: $ERROR"
fi

# Test 7: Delete test track
info "Deleting test track: $TEST_TRACK"
DEL_RESULT=$(do_post "/publisher/$APP_ID/track/delete" "app=$APP_ID&track=$TEST_TRACK")

if echo "$DEL_RESULT" | jq -e '.data.deleted // .deleted' > /dev/null 2>&1; then
    pass "Deleted track $TEST_TRACK"
else
    ERROR=$(echo "$DEL_RESULT" | jq -r '.error // .data.error // "Unknown error"')
    fail "Failed to delete track: $ERROR"
fi

# Verify track was deleted
APP_JSON=$(do_curl "/publisher/view?app=$APP_ID")
if echo "$APP_JSON" | jq -e "(.data.tracks // .tracks)[] | select(.track == \"$TEST_TRACK\")" > /dev/null 2>&1; then
    fail "Track $TEST_TRACK still exists after deletion"
else
    pass "Track $TEST_TRACK removed from track list"
fi

# Test 8: Try to delete non-existent track
info "Attempting to delete non-existent track..."
DEL_NONEXIST=$(do_post "/publisher/$APP_ID/track/delete" "app=$APP_ID&track=NonExistentTrack")
# This might succeed silently or return an error - either is acceptable
info "Non-existent track deletion returned: $(echo "$DEL_NONEXIST" | jq -c '.')"

echo ""
echo -e "${GREEN}All tests passed!${NC}"
