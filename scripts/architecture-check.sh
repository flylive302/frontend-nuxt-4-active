#!/usr/bin/env bash
set -euo pipefail

echo "Running frontend architecture checks..."

violations=0

check() {
  local message="$1"
  local pattern="$2"
  local target="$3"
  if grep -R -nE "$pattern" "$target" >/tmp/arch_check_frontend.out; then
    echo "FAIL: $message"
    cat /tmp/arch_check_frontend.out
    violations=$((violations + 1))
  fi
}

check "Stores must not call API directly" 'useApi\s*\(|\$fetch\s*\(|useFetch\s*\(' app/stores
check "Stores must not trigger toasts" 'useToast\s*\(' app/stores
check "Components must not call API directly" 'useApi\s*\(|\$fetch\s*\(|useFetch\s*\(' app/components
check "Pages must not call API directly" 'useApi\s*\(|\$fetch\s*\(' app/pages
check "Components must not emit sockets directly" 'socket\s*\.\s*emit\s*\(' app/components
check "Pages must not emit sockets directly" 'socket\s*\.\s*emit\s*\(' app/pages

if [[ $violations -gt 0 ]]; then
  echo "Frontend architecture checks failed with $violations violation group(s)."
  exit 1
fi

echo "Frontend architecture checks passed."
