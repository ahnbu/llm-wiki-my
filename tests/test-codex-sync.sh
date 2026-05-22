#!/usr/bin/env bash
# Local-CI: read-only check that the Codex plugin mirror (plugins/llm-wiki/)
# stays in sync with the Claude source of truth
# (claude-plugin/skills/wiki-manager/).
#
# This test does not modify plugins/llm-wiki/. It generates the expected Codex
# plugin tree in a temporary directory and compares that output with the current
# working tree mirror.
#
# Why this exists: only LLMs work on this codebase, so drift between the
# two packaging targets must be caught inside the agent's edit→test loop
# rather than after a push to CI. See README "Claude-First, Codex-Compatible".
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TMP_BASE="${TMPDIR:-/tmp}"
if [ ! -d "$TMP_BASE" ]; then
  TMP_BASE="/tmp"
fi

TMP_ROOT="$(mktemp -d "$TMP_BASE/llm-wiki-codex-sync.XXXXXX")"
EXPECTED_PLUGIN="$TMP_ROOT/llm-wiki"
DIFF_FILE="$TMP_ROOT/codex-sync.diff"

cleanup() {
  case "${TMP_ROOT:-}" in
    "$TMP_BASE"/llm-wiki-codex-sync.*)
      rm -rf "$TMP_ROOT"
      ;;
  esac
}
trap cleanup EXIT

CODEX_PLUGIN_OUT="$EXPECTED_PLUGIN" ./scripts/sync-codex-plugin.sh >/dev/null

if ! diff -ru --strip-trailing-cr "$EXPECTED_PLUGIN" "$ROOT/plugins/llm-wiki" >"$DIFF_FILE"; then
  cat >&2 <<'MSG'
SYNC NEEDED: Codex plugin mirror is not up to date with claude-plugin/skills/wiki-manager/.

This test is read-only. It generated the expected Codex plugin in a temporary
directory and compared it with plugins/llm-wiki/.

Diff preview:
MSG
  head -200 "$DIFF_FILE" >&2
  cat >&2 <<'MSG'

To fix:
  1. ./scripts/sync-codex-plugin.sh
  2. git diff -- plugins/llm-wiki/
  3. stage plugins/llm-wiki/ with the related Claude-side change
  4. ./tests/test-codex-sync.sh

This guards against the Codex copy drifting from the Claude source.
MSG
  exit 1
fi

echo "OK: Codex plugin mirror is in sync."
