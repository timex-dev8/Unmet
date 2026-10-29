#!/bin/bash
# Saves your API keys into .env.local without opening an editor.
# Input is hidden while you paste. Keys never leave your Mac.
# Run: bash scripts/set-keys.sh
set -e
cd "$(dirname "$0")/.."
[ -f .env.local ] || cp .env.example .env.local

read -rsp "Paste your GEMINI_API_KEY (hidden), then press Enter: " GEMINI; echo
read -rsp "Paste your EXA_API_KEY (hidden), then press Enter: " EXA; echo

GEMINI="$GEMINI" EXA="$EXA" node -e '
const fs = require("fs");
const set = { GEMINI_API_KEY: process.env.GEMINI.trim(), EXA_API_KEY: process.env.EXA.trim(), LLM_MODEL: "gemini-3.8-flash", LLM_PROVIDER: "gemini" };
let text = fs.readFileSync(".env.local", "utf8");
for (const [k, v] of Object.entries(set)) {
  if (!v) continue;
  const line = `${k}=${v}`;
  text = new RegExp(`^${k}=.*$`, "m").test(text) ? text.replace(new RegExp(`^${k}=.*$`, "m"), line) : `${text.trimEnd()}\n${line}\n`;
}
fs.writeFileSync(".env.local", text);
for (const k of Object.keys(set)) console.log(`${k}: ${new RegExp(`^${k}=.+`, "m").test(text) ? "saved" : "EMPTY"}`);
'
echo "Done. You can close this tab."
