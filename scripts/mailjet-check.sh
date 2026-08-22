#!/usr/bin/env bash
# Ask Mailjet's API why jamwerk.app ownership validation stays "Pending".
# Usage:  bash scripts/mailjet-check.sh APIKEY SECRETKEY
# (keys from Mailjet → API → API Key Management; nothing is stored or printed)
set -euo pipefail
if [ $# -ne 2 ]; then echo "usage: $0 APIKEY SECRETKEY" >&2; exit 1; fi
MJ="$1:$2"
API=https://api.mailjet.com/v3/REST

echo "== 1. Senders (ID / email / status)"
SENDERS=$(curl -s --user "$MJ" "$API/sender")
echo "$SENDERS" | python3 -c 'import sys,json
for d in json.load(sys.stdin)["Data"]:
    print(f'"'"'  {d["ID"]}  {d["Email"]:<24} {d["Status"]:<10} dns={d.get("DNSID")}'"'"')'

ID=$(echo "$SENDERS" | python3 -c 'import sys,json
for d in json.load(sys.stdin)["Data"]:
    if d["Email"].endswith("@jamwerk.app"): print(d["ID"]); break')
if [ -z "${ID:-}" ]; then echo "no *@jamwerk.app sender found"; exit 1; fi

echo; echo "== 2. Trigger validation for sender $ID (*@jamwerk.app)"
curl -s -X POST --user "$MJ" "$API/sender/$ID/validate"; echo

echo; echo "== 3. Mailjet's view of jamwerk.app DNS"
curl -s --user "$MJ" "$API/dns/jamwerk.app" | python3 -m json.tool

echo; echo "== 4. Force a DNS re-check"
curl -s -X POST --user "$MJ" "$API/dns/jamwerk.app/check" | python3 -m json.tool

echo; echo "== 5. Senders again (did the status change?)"
curl -s --user "$MJ" "$API/sender" | python3 -c 'import sys,json
for d in json.load(sys.stdin)["Data"]:
    print(f'"'"'  {d["ID"]}  {d["Email"]:<24} {d["Status"]}'"'"')'
