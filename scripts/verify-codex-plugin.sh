#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCOPE="project"
PROJECT_ROOT="${PWD}"
USER_HOME="${HOME}"
MARKETPLACE_NAME="llm-wiki-my"
PLUGIN_KEY="wiki@${MARKETPLACE_NAME}"

usage() {
  cat <<'EOF'
Usage: ./scripts/verify-codex-plugin.sh [options]

Verify that Codex resolves @wiki to the installed cache for this local fork.

Options:
  --scope project|user   Verify project or user install (default: project)
  --project-root <dir>   Project root for project scope (default: current dir)
  --user-home <dir>      HOME used for Codex config lookup (default: current HOME)
  -h, --help             Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scope)
      [[ $# -ge 2 ]] || { echo "Missing value for --scope" >&2; exit 1; }
      SCOPE="$2"
      shift 2
      ;;
    --project-root)
      [[ $# -ge 2 ]] || { echo "Missing value for --project-root" >&2; exit 1; }
      PROJECT_ROOT="$2"
      shift 2
      ;;
    --user-home)
      [[ $# -ge 2 ]] || { echo "Missing value for --user-home" >&2; exit 1; }
      USER_HOME="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

case "$SCOPE" in
  project|user) ;;
  *)
    echo "Invalid scope: $SCOPE (expected project or user)" >&2
    exit 1
    ;;
esac

PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)"
USER_HOME="$(cd "$USER_HOME" && pwd)"
EXPECTED_CACHE_FRAGMENT=".codex/plugins/cache/${MARKETPLACE_NAME}"
TMP_OUTPUT="$(mktemp)"
PROBE_DIR="$ROOT/.tmp/codex-runtime-probe"
USER_CONFIG="$USER_HOME/.codex/config.toml"
TARGET_CONFIG=""
normalize_path() {
  python3 - "$1" <<'PY'
import sys

path = sys.argv[1].strip()
if path.startswith("\\\\?\\"):
    path = path[4:]
path = path.replace("\\", "/")
if len(path) > 7 and path.startswith("/mnt/") and path[5].isalpha() and path[6] == "/":
    path = f"{path[5]}:/{path[7:]}"
print(path.rstrip("/").lower())
PY
}
ROOT_NORM="$(normalize_path "$ROOT")"
if [[ "$SCOPE" == "project" ]]; then
  TARGET_CONFIG="$PROJECT_ROOT/.codex/config.toml"
else
  TARGET_CONFIG="$USER_CONFIG"
fi
cleanup() {
  rm -f "$TMP_OUTPUT"
}
trap cleanup EXIT

if [[ ! -f "$USER_CONFIG" ]]; then
  echo "Missing user Codex config:" >&2
  echo "  $USER_CONFIG" >&2
  echo "Run ./scripts/bootstrap-codex-plugin.sh first." >&2
  exit 1
fi

MARKETPLACE_SOURCE="$(
  python3 - "$USER_CONFIG" "$MARKETPLACE_NAME" <<'PY'
import re
import sys
from pathlib import Path

config = Path(sys.argv[1])
marketplace = re.escape(sys.argv[2])
text = config.read_text()
match = re.search(
    rf'(?ms)^\[marketplaces\.{marketplace}\]\n.*?^source = ([\'"])(.*?)\1$',
    text,
)
source = match.group(2) if match else ""
if source.startswith("\\\\?\\"):
    source = source[4:]
source = source.replace("\\", "/")
if len(source) > 7 and source.startswith("/mnt/") and source[5].isalpha() and source[6] == "/":
    source = f"{source[5]}:/{source[7:]}"
print(source.rstrip("/").lower())
PY
)"

if [[ "$MARKETPLACE_SOURCE" != "$ROOT_NORM" ]]; then
  echo "Codex marketplace '${MARKETPLACE_NAME}' does not point at this repo." >&2
  if [[ -n "$MARKETPLACE_SOURCE" ]]; then
    echo "Configured source:" >&2
    echo "  $MARKETPLACE_SOURCE" >&2
  else
    echo "Configured source: <missing>" >&2
  fi
  echo "Expected source:" >&2
  echo "  $ROOT_NORM" >&2
  echo "Run ./scripts/bootstrap-codex-plugin.sh with a clean Codex home or remove the conflicting marketplace first." >&2
  exit 1
fi

if [[ ! -f "$TARGET_CONFIG" ]]; then
  echo "Missing Codex config for scope '$SCOPE':" >&2
  echo "  $TARGET_CONFIG" >&2
  echo "Run ./scripts/bootstrap-codex-plugin.sh --scope $SCOPE first." >&2
  exit 1
fi

if ! grep -Fq "[plugins.\"$PLUGIN_KEY\"]" "$TARGET_CONFIG"; then
  echo "Missing plugin enable block in:" >&2
  echo "  $TARGET_CONFIG" >&2
  echo "Run ./scripts/bootstrap-codex-plugin.sh --scope $SCOPE first." >&2
  exit 1
fi

mkdir -p "$PROBE_DIR"

if [[ "$SCOPE" == "project" ]]; then
  HOME="$USER_HOME" codex -C "$PROJECT_ROOT" debug prompt-input '@wiki test' >"$TMP_OUTPUT"
else
  HOME="$USER_HOME" codex -C "$PROBE_DIR" debug prompt-input '@wiki test' >"$TMP_OUTPUT"
fi

if grep -Fq 'wiki:wiki' "$TMP_OUTPUT" && grep -Fq "$EXPECTED_CACHE_FRAGMENT" "$TMP_OUTPUT"; then
  echo "OK: Codex resolves @wiki from this local fork marketplace."
  echo "Expected cache fragment:"
  echo "  $EXPECTED_CACHE_FRAGMENT"
  exit 0
fi

ACTUAL_SKILL_PATH="$(python3 - "$TMP_OUTPUT" <<'PY'
import re
import sys
from pathlib import Path

text = Path(sys.argv[1]).read_text()
match = re.search(r'(/[^\n"]*skills/wiki/SKILL\.md)', text)
print(match.group(1) if match else "")
PY
)"

if [[ -n "$ACTUAL_SKILL_PATH" ]]; then
  echo "FAIL: Codex resolved @wiki, but not from this local fork marketplace." >&2
  echo "Resolved skill path:" >&2
  echo "  $ACTUAL_SKILL_PATH" >&2
  echo "Expected cache fragment:" >&2
  echo "  $EXPECTED_CACHE_FRAGMENT" >&2
  echo "This usually means another Codex home already owns the '${MARKETPLACE_NAME}' marketplace." >&2
  exit 1
fi

echo "PENDING: Codex did not expose @wiki in this headless session." >&2
echo "The marketplace and config are present, but Codex may still require the interactive /plugins UI to materialize or enable the local plugin on first install." >&2
echo >&2
echo "Next step:" >&2
echo "  1. Start Codex with HOME set to this Codex home (if non-default)." >&2
echo "  2. Open /plugins and enable 'LLM Wiki My'." >&2
echo "  3. Restart Codex if needed, then rerun this verify script." >&2
echo >&2
echo "Expected cache fragment once active:" >&2
echo "  $EXPECTED_CACHE_FRAGMENT" >&2
echo >&2
echo "Last 40 lines of prompt-input output:" >&2
tail -40 "$TMP_OUTPUT" >&2 || true
exit 2
