#!/usr/bin/env bash
# Sourced by .github/workflows/db-backup.yml, and by tests/backup-retry.spec.ts,
# which is why it lives here and not inline in the workflow.
#
# retry <label> <command> [args...]
#   Runs the command; if it fails, waits and runs it again (default: up to 5
#   tries, 15s, 30s, 60s and 120s apart). Returns 0 as soon as one try works, 1
#   once it gives up. The command's stdout passes through untouched; its stderr
#   is shown as it comes and kept to decide whether another try can help.
#
#   Only for commands that are safe to run again (here: reads of production that
#   rewrite their own output file). The label is what gets printed, never the
#   arguments: they include the database URL and its password.
#
#   RETRY_MAX_TRIES (5) and RETRY_FIRST_DELAY_SECONDS (15) can be overridden,
#   for the tests.
#
# Why some failures are not retried: retrying a wrong password or user only risks
# the pooler banning the runner's address (ECIRCUITBREAKER), and it cannot work.
# "Tenant or user not found" is the pooler's answer to a wrong user, but it can
# also give it for a few seconds while it reloads, so it gets a few tries (3),
# not five and not none.

retry() {
  local label="$1"; shift
  local max_tries="${RETRY_MAX_TRIES:-5}" delay="${RETRY_FIRST_DELAY_SECONDS:-15}"
  local attempt=1 rc err limit
  err="$(mktemp)"
  while true; do
    rc=0
    # The subshell sets pipefail itself, so the pipeline fails with the command's
    # status whatever options the caller has; `|| rc=$?` keeps `set -e` out of it.
    ( set -o pipefail; { "$@" 2>&1 1>&3 3>&- | tee "$err" >&2; } 3>&1 ) || rc=$?
    if [ "$rc" -eq 0 ]; then
      rm -f "$err"
      return 0
    fi
    if grep -qiE 'password authentication failed|no pg_hba.conf entry|ECIRCUITBREAKER|permission denied|does not exist|syntax error at or near' "$err"; then
      echo "::error::Backup ${label}: failed in a way waiting can't fix (its error is above)."
      rm -f "$err"
      return 1
    fi
    limit="$max_tries"
    if grep -qi 'Tenant or user not found' "$err" && [ "$limit" -gt 3 ]; then
      limit=3
    fi
    if [ "$attempt" -ge "$limit" ]; then
      echo "::error::Backup ${label}: failed $attempt times in a row (the last error is above)."
      rm -f "$err"
      return 1
    fi
    echo "::warning::Backup ${label}: attempt $attempt failed; trying again in ${delay}s."
    sleep "$delay"
    attempt=$((attempt + 1))
    delay=$((delay * 2))
  done
}
