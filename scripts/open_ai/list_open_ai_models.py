"""
Print model IDs available to your account via the Models API.
No filtering. No selection. Just list.
Prereq: pip install openai
Env:   OPENAI_API_KEY
"""

import json
import argparse
from openai import OpenAI

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true", help="Output as JSON array")
    args = ap.parse_args()

    client = OpenAI()
    models = client.models.list().data
    ids = [m.id for m in models]

    if args.json:
        print(json.dumps(ids, ensure_ascii=False, indent=2))
    else:
        for mid in ids:
            print(mid)

if __name__ == "__main__":
    main()
