#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
set -euo pipefail
workspace="${GITHUB_WORKSPACE:?GITHUB_WORKSPACE is required}"
case "$workspace" in
  /*) ;;
  *) echo 'The job workspace must be absolute.' >&2; exit 1 ;;
esac
test "$workspace" != /
test "$(realpath -e -- "$workspace")" = "$workspace"
test -d "$workspace/.git"
test ! -L "$workspace/.git"
job_owner="$(id -u):$(id -g)"
printf 'workspace_owner_before=%s job_owner=%s\n' "$(stat -c '%u:%g' "$workspace")" "$job_owner"
# Only this disposable checkout changes owner; never follow repository symlinks.
chown -hR -- "$job_owner" "$workspace"
printf 'workspace_owner_after=%s\n' "$(stat -c '%u:%g' "$workspace")"
git -C "$workspace" rev-parse --is-inside-work-tree
