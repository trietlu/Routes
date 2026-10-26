#!/usr/bin/env bash
# Runs `maestro test` with the given arguments.
#
# If Maestro's iOS (XCUITest) driver fails to start, no flow has run: that's
# an infrastructure failure on the hosted simulator, not a test result. In
# that case only, retry once, with a visible warning. Test failures are never
# retried.
set -uo pipefail

log=$(mktemp)
maestro test "$@" 2>&1 | tee "$log"
status=${PIPESTATUS[0]}

if [ "$status" -ne 0 ] && grep -q "iOS driver not ready" "$log"; then
  echo "::warning title=Maestro driver::The iOS driver didn't start, so no flow ran. Retrying once (infrastructure failure, not a test failure)."
  maestro test "$@"
  status=$?
fi

exit "$status"
