# ESCO-UAV — Landing Page

Savaşan İHA takımı ESCO-UAV'ın tanıtım sayfası. **Platform B** hava aracının
interaktif 3D modelini, ölçekli teknik çizimini ve mühendislik durumunu sunar.

## İçerik

- `index.html` — tek sayfa; ölçekli üst görünüş SVG'si gerçek CAD kotlarından üretildi
- `assets/js/viewer.js` — three.js tabanlı 3D görüntüleyici (döndür/yakınlaştır,
  dış hat / iç yapı / görev bölgeleri katmanları)
- `assets/models/esco-uav.glb` — Platform B candidate_003 baseline modeli
- `assets/js/`, `assets/utils/` — three.js r160 (yerel, CDN bağımlılığı yok)

## Geliştirme

```bash
python3 -m http.server 8080
# http://localhost:8080
```

## Dağıtım

Docker + nginx. Coolify `dockerfile` build pack ile 80 portundan yayınlanır.

```bash
docker build -t esco-uav-landing .
docker run -p 8080:80 esco-uav-landing
```

## Veri kaynağı

Sayfadaki tüm ölçüler `savasan-iha/uav-platform` mühendislik deposundaki Fusion
dijital ikizinden ölçülen gerçek değerlerdir. Tahmin edilen kot yoktur.
