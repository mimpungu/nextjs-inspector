#!/usr/bin/env bash
# =============================================================
# Outil d'analyse statique + sécurité - Réalisé par Deo Mimpungu
# =============================================================
set -euo pipefail

REPORT_DIR="reports"
RAW_DIR="$REPORT_DIR/raw"
HTML_DIR="$REPORT_DIR/html"

mkdir -p "$RAW_DIR" "$HTML_DIR"

echo "==> Detect package manager..."
PM="npm"
if [[ -f "pnpm-lock.yaml" ]]; then PM="pnpm"; fi
if [[ -f "yarn.lock" ]]; then PM="yarn"; fi
echo "    Using: $PM"

run_pm() {
  case "$PM" in
    npm)  npm "$@" ;;
    pnpm) pnpm "$@" ;;
    yarn) yarn "$@" ;;
  esac
}

add_dev_deps() {
  local deps=("$@")
  echo "==> Installing dev tools (if missing): ${deps[*]}"
  case "$PM" in
    npm)  npm i -D "${deps[@]}" ;;
    pnpm) pnpm add -D "${deps[@]}" ;;
    yarn) yarn add -D "${deps[@]}" ;;
  esac
}

has_pkg() {
  node -e "const p=require('./package.json'); const all={...(p.dependencies||{}),...(p.devDependencies||{})}; process.exit(all['$1']?0:1)"
}

echo "==> Sanity checks..."
[[ -f package.json ]] || { echo "ERROR: package.json not found at project root"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "ERROR: node not found"; exit 1; }

if [[ ! -d node_modules ]]; then
  echo "==> node_modules missing -> installing..."
  run_pm install
fi

# Tools we use (static)
TOOLS=(eslint prettier depcheck madge ts-prune)

NEED_INSTALL=()
for t in "${TOOLS[@]}"; do
  if ! has_pkg "$t"; then
    NEED_INSTALL+=("$t")
  fi
done
if [[ "${#NEED_INSTALL[@]}" -gt 0 ]]; then
  add_dev_deps "${NEED_INSTALL[@]}"
fi

echo "==> Detect targets..."
TARGETS=()
[[ -d "app" ]] && TARGETS+=("app")
[[ -d "pages" ]] && TARGETS+=("pages")
[[ -d "src" ]] && TARGETS+=("src")
[[ -d "components" ]] && TARGETS+=("components")
[[ "${#TARGETS[@]}" -eq 0 ]] && TARGETS+=(".")

BASE="."
[[ -d "src" ]] && BASE="src"

# 1) Typecheck
echo "==> 1) TypeScript typecheck..."
if has_pkg "typescript"; then
  set +e
  npx -y tsc --noEmit --pretty false > "$RAW_DIR/typecheck.txt" 2>&1
  echo $? > "$RAW_DIR/typecheck.exitcode"
  set -e
else
  echo "typescript not installed -> skipped" > "$RAW_DIR/typecheck.txt"
  echo 0 > "$RAW_DIR/typecheck.exitcode"
fi

# 2) ESLint JSON
echo "==> 2) ESLint (JSON)..."
set +e
npx -y eslint "${TARGETS[@]}" --ext .ts,.tsx,.js,.jsx -f json -o "$RAW_DIR/eslint.json" 2> "$RAW_DIR/eslint.stderr.txt"
echo $? > "$RAW_DIR/eslint.exitcode"
set -e

# 3) Prettier check
echo "==> 3) Prettier (check)..."
set +e
npx -y prettier . --check > "$RAW_DIR/prettier.txt" 2>&1
echo $? > "$RAW_DIR/prettier.exitcode"
set -e

# 4) depcheck JSON
echo "==> 4) depcheck (JSON)..."
node - <<'NODE' > "reports/raw/depcheck.json"
const depcheck = require('depcheck');
const options = {
  ignoreDirs: ['dist','build','out','.next','.turbo','.git','coverage','node_modules','reports'],
  detectors: depcheck.detector,
  specials: [
    depcheck.special.eslint,
    depcheck.special.jest,
    depcheck.special.webpack,
    depcheck.special.babel,
    depcheck.special.typescript
  ],
};
depcheck(process.cwd(), options, (unused) => {
  process.stdout.write(JSON.stringify(unused, null, 2));
});
NODE

# 5) ts-prune
echo "==> 5) ts-prune..."
set +e
npx -y ts-prune > "$RAW_DIR/ts-prune.txt" 2>&1
echo $? > "$RAW_DIR/ts-prune.exitcode"
set -e

# 6) madge cycles
echo "==> 6) madge circular..."
MADGE_ARGS=( "$BASE" --extensions ts,tsx,js,jsx )
[[ -f "tsconfig.json" ]] && MADGE_ARGS+=( --ts-config tsconfig.json )

set +e
npx -y madge "${MADGE_ARGS[@]}" --circular > "$RAW_DIR/madge-circular.txt" 2>&1
echo $? > "$RAW_DIR/madge.exitcode"
set -e

# 7) Next build (optional)
echo "==> 7) next build (optional)..."
if has_pkg "next"; then
  set +e
  run_pm run build > "$RAW_DIR/next-build.txt" 2>&1
  echo $? > "$RAW_DIR/next-build.exitcode"
  set -e
else
  echo "next not installed -> skipped" > "$RAW_DIR/next-build.txt"
  echo 0 > "$RAW_DIR/next-build.exitcode"
fi

# 8) Dependency audit (package manager)
echo "==> 8) Dependency audit..."
set +e
case "$PM" in
  npm)
    npm audit --json > "$RAW_DIR/npm-audit.json" 2> "$RAW_DIR/npm-audit.stderr.txt"
    echo $? > "$RAW_DIR/npm-audit.exitcode"
    ;;
  pnpm)
    pnpm audit --json > "$RAW_DIR/pnpm-audit.json" 2> "$RAW_DIR/pnpm-audit.stderr.txt"
    echo $? > "$RAW_DIR/pnpm-audit.exitcode"
    ;;
  yarn)
    # yarn classic vs berry: output can be NDJSON; we keep raw output.
    yarn audit --json > "$RAW_DIR/yarn-audit.json" 2> "$RAW_DIR/yarn-audit.stderr.txt"
    echo $? > "$RAW_DIR/yarn-audit.exitcode"
    ;;
esac
set -e

# 9) OSV-Scanner (dependencies vulnerability scan)
echo "==> 9) OSV-Scanner..."
if command -v osv-scanner >/dev/null 2>&1; then
  set +e
  osv-scanner scan --format json --output "$RAW_DIR/osv.json" . 2> "$RAW_DIR/osv.stderr.txt"
  echo $? > "$RAW_DIR/osv.exitcode"
  set -e
else
  echo "osv-scanner not installed -> skipped (install: https://google.github.io/osv-scanner/)" > "$RAW_DIR/osv.txt"
  echo 0 > "$RAW_DIR/osv.exitcode"
fi

# 10) Semgrep (SAST)
echo "==> 10) Semgrep..."
if command -v semgrep >/dev/null 2>&1; then
  set +e
  semgrep scan --config p/ci --json --output "$RAW_DIR/semgrep.json" . 2> "$RAW_DIR/semgrep.stderr.txt"
  echo $? > "$RAW_DIR/semgrep.exitcode"
  set -e
else
  echo "semgrep not installed -> skipped (install: https://semgrep.dev/docs/)" > "$RAW_DIR/semgrep.txt"
  echo 0 > "$RAW_DIR/semgrep.exitcode"
fi

# 11) Gitleaks (secrets)
echo "==> 11) Gitleaks..."
if command -v gitleaks >/dev/null 2>&1; then
  set +e
  gitleaks detect --source . --report-format json --report-path "$RAW_DIR/gitleaks.json" > "$RAW_DIR/gitleaks.txt" 2>&1
  echo $? > "$RAW_DIR/gitleaks.exitcode"
  set -e
else
  echo "gitleaks not installed -> skipped (install: https://github.com/gitleaks/gitleaks)" > "$RAW_DIR/gitleaks.txt"
  echo 0 > "$RAW_DIR/gitleaks.exitcode"
fi

# Generate HTML reports
# Generate HTML reports
echo "==> Generating HTML reports..."
GEN_SCRIPT="./scripts/generate-html-reports.mjs"

if [[ ! -f "$GEN_SCRIPT" ]]; then
  # We are likely running from curl | bash, so we need to fetch the helper script
  echo "    -> Helper script not found locally, downloading from GitHub (master)..."
  curl -fsSL "https://raw.githubusercontent.com/mimpungu/nextjs-inspector/master/scripts/generate-html-reports.mjs" -o "$REPORT_DIR/generate-html-reports.mjs"
  GEN_SCRIPT="$REPORT_DIR/generate-html-reports.mjs"
fi

node "$GEN_SCRIPT"

echo ""
echo "✅ Done!"
echo "Open: reports/html/index.html"
