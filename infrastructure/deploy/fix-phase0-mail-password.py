#!/usr/bin/env python3
"""One-shot: fix Gmail app password length in phase0.env (16 chars, no spaces)."""
import pathlib
import sys

if len(sys.argv) != 2:
    print("usage: fix-phase0-mail-password.py <16-char-app-password>", file=sys.stderr)
    sys.exit(1)

password = sys.argv[1].replace(" ", "")
if len(password) != 16:
    print(f"expected 16-char app password, got {len(password)}", file=sys.stderr)
    sys.exit(1)

path = pathlib.Path("/opt/collabspace/infrastructure/deploy/phase0.env")
text = path.read_text(encoding="utf-8")
lines = []
replaced = False
for line in text.splitlines():
    if line.startswith("MAIL_PASSWORD="):
        lines.append(f"MAIL_PASSWORD={password}")
        replaced = True
    else:
        lines.append(line)
if not replaced:
    lines.append(f"MAIL_PASSWORD={password}")
path.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("MAIL_PASSWORD updated in phase0.env")
