#!/usr/bin/env zsh
# SPDX-License-Identifier: MIT
#
# Copyright (c) 2026 Codemonki
#
# verify-manifest.zsh
#
# Verifies a simple contract manifest:
#   FILE <relative-path>
#   ID   <dom-id>
#
# Defaults:
#   manifest: docs/manifest.txt
#   html:     docs/index.html
#
# Usage:
#   tools/verify-manifest.zsh
#   tools/verify-manifest.zsh -m docs/manifest.txt -r .
#   tools/verify-manifest.zsh -h

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: verify-manifest.zsh [options]

Verifies required files and DOM IDs listed in a contract manifest file.

Manifest format:
  FILE <relative-path>
  ID   <dom-id>

Options:
  -m <path>   Path to manifest file (default: docs/manifest.txt)
  -r <path>   Repo root / base directory (default: .)
  -i <path>   HTML file to search for IDs (default: docs/index.html)
  -q          Quiet (only prints errors; still exits non-zero on failure)
  -h          Show this help

Exit codes:
  0  success
  2  missing/invalid manifest entries detected

Examples:
  tools/verify-manifest.zsh
  tools/verify-manifest.zsh -m docs/manifest.txt -i docs/index.html -r .

EOF
}

MANIFEST="docs/manifest.txt"
ROOT="."
HTML="docs/index.html"
QUIET=0

while getopts ":m:r:i:qh" opt; do
  case "$opt" in
    m) MANIFEST="$OPTARG" ;;
    r) ROOT="$OPTARG" ;;
    i) HTML="$OPTARG" ;;
    q) QUIET=1 ;;
    h) usage; exit 0 ;;
    \?) echo "ERROR: Unknown option: -$OPTARG" >&2; usage; exit 2 ;;
    :)  echo "ERROR: Option -$OPTARG requires an argument" >&2; usage; exit 2 ;;
  esac
done

# Normalize base paths
MANIFEST_PATH="${ROOT}/${MANIFEST}"
HTML_PATH="${ROOT}/${HTML}"

if [[ ! -f "$MANIFEST_PATH" ]]; then
  echo "ERROR: Manifest not found: $MANIFEST_PATH" >&2
  exit 2
fi

if [[ ! -f "$HTML_PATH" ]]; then
  echo "ERROR: HTML file not found: $HTML_PATH" >&2
  exit 2
fi

typeset -a req_files req_ids
req_files=()
req_ids=()

# Parse manifest
# Accepts:
#  - blank lines
#  - lines starting with #
#  - 'FILE <path>' and 'ID <id>'
while IFS= read -r line; do
  line="${line//$'\r'/}"          # strip CR if present
  [[ -z "${line//[[:space:]]/}" ]] && continue
  [[ "$line" == \#* ]] && continue

  # Normalize internal whitespace
  local key rest
  key="${line%%[[:space:]]*}"
  rest="${line#"$key"}"
  rest="${rest#"${rest%%[![:space:]]*}"}" # ltrim

  if [[ "$key" == "FILE" ]]; then
    [[ -z "$rest" ]] && { echo "ERROR: Malformed FILE line: $line" >&2; exit 2; }
    req_files+=("$rest")
  elif [[ "$key" == "ID" ]]; then
    [[ -z "$rest" ]] && { echo "ERROR: Malformed ID line: $line" >&2; exit 2; }
    req_ids+=("$rest")
  else
    echo "ERROR: Unknown manifest directive: $key (line: $line)" >&2
    exit 2
  fi
done < "$MANIFEST_PATH"

if (( ${#req_files} == 0 )); then
  echo "ERROR: No FILE entries found in manifest: $MANIFEST_PATH" >&2
  exit 2
fi

if (( ${#req_ids} == 0 )); then
  echo "ERROR: No ID entries found in manifest: $MANIFEST_PATH" >&2
  exit 2
fi

typeset -a missing_files missing_ids
missing_files=()
missing_ids=()

# Check files exist
for f in "${req_files[@]}"; do
  if [[ ! -e "${ROOT}/${f}" ]]; then
    missing_files+=("$f")
  fi
done

# Check DOM IDs exist in HTML
# We check for id="X" and id='X' patterns.
for id in "${req_ids[@]}"; do
  if ! rg -q --fixed-strings "id=\"$id\"" "$HTML_PATH" && ! rg -q --fixed-strings "id='$id'" "$HTML_PATH"; then
    missing_ids+=("$id")
  fi
done

# Report
if (( QUIET == 0 )); then
  echo "Manifest: $MANIFEST_PATH"
  echo "HTML:     $HTML_PATH"
  echo ""

  echo "Checked FILE entries: ${#req_files}"
  echo "Checked ID entries:   ${#req_ids}"
  echo ""
fi

fail=0

if (( ${#missing_files} > 0 )); then
  fail=1
  echo "Missing required FILE(s):" >&2
  for f in "${missing_files[@]}"; do
    echo "  - $f" >&2
  done
  echo "" >&2
fi

if (( ${#missing_ids} > 0 )); then
  fail=1
  echo "Missing required DOM ID(s) in ${HTML}:" >&2
  for id in "${missing_ids[@]}"; do
    echo "  - $id" >&2
  done
  echo "" >&2
fi

if (( fail == 1 )); then
  echo "FAIL: Manifest verification failed." >&2
  exit 2
fi

if (( QUIET == 0 )); then
  echo "OK: Manifest verification passed."
fi

exit 0