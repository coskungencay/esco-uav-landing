#!/usr/bin/env python3
"""Varlık URL'lerine içerik hash'i ekler (cache-busting).

nginx /assets/ için 30 gün `immutable` cache veriyor; dosya adları sabit
kaldığı için tarayıcılar eski JS/model'i kullanmaya devam ediyordu.
Bu script index.html'deki her varlık referansına ?v=<hash> ekler; içerik
değişince hash değişir, tarayıcı yeni dosyayı çeker.

Kullanım: python3 version-assets.py
"""
import hashlib, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HTML = ROOT / "index.html"

def h(rel: str) -> str:
    p = ROOT / rel
    return hashlib.md5(p.read_bytes()).hexdigest()[:10] if p.is_file() else ""

t = HTML.read_text()
# önce mevcut ?v=... eklerini temizle
t = re.sub(r'(assets/[A-Za-z0-9_\-./]+?\.(?:js|css|glb|png))\?v=[0-9a-f]+', r'\1', t)

n = 0
for rel in sorted({m.group(1) for m in
                   re.finditer(r'(assets/[A-Za-z0-9_\-./]+?\.(?:js|css|glb|png))', t)}):
    v = h(rel)
    if not v:
        print(f"  UYARI: bulunamadı -> {rel}")
        continue
    t = re.sub(re.escape(rel) + r'(?![A-Za-z0-9_\-./])', f'{rel}?v={v}', t)
    n += 1
HTML.write_text(t)
print(f"[version] {n} varlık sürümlendi")
