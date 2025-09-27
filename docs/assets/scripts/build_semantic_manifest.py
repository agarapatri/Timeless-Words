#!/usr/bin/env python3
import argparse, hashlib, json, os, time

def sha256(path, chunk=1024*1024):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        while True:
            b = f.read(chunk)
            if not b: break
            h.update(b)
    return h.hexdigest()

def main():
    ap = argparse.ArgumentParser(description="Build semantic/manifest.json")
    ap.add_argument("--dir", default="semantic", help="Directory to scan")
    ap.add_argument("--out", default="semantic/manifest.json", help="Output manifest path")
    ap.add_argument("--version", default=time.strftime("%Y-%m-%d-%H%M%S"), help="Manifest version string")
    ap.add_argument("--include", nargs="*", default=None, help="Only include these filenames (space-separated)")
    ap.add_argument("--exclude", nargs="*", default=["manifest.json", ".DS_Store"], help="Exclude these names")
    args = ap.parse_args()

    base = args.dir.rstrip("/")

    files = []
    total = 0
    for name in sorted(os.listdir(base)):
        if args.include and name not in args.include: continue
        if name in args.exclude: continue
        path = os.path.join(base, name)
        if not os.path.isfile(path): continue
        size = os.path.getsize(path)
        h = sha256(path)
        files.append({"path": name, "size": size, "sha256": h})
        total += size

    manifest = {
        "version": args.version,
        "total_size": total,
        "files": files
    }

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"Wrote {args.out}  (files={len(files)}, total={total} bytes)")
    for f in files:
        print(f"  - {f['path']:>28}  {f['size']:>10}  {f['sha256'][:12]}…")

if __name__ == "__main__":
    main()
