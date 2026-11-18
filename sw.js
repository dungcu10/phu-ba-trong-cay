// Generated at build time. Cache-first for every file of this version.
const CACHE = 'pbtc-0.0.1-0f7c256';
const FILES = [
 "./",
 "./assets/BeVietnamPro-500-DuGcKpJ-.woff",
 "./assets/BeVietnamPro-700-Kpf0qMx5.woff",
 "./assets/Cache-CyeqYrc9.js",
 "./assets/CanvasPool-DpfPEqCi.js",
 "./assets/Cormorant-700-BHcJyd03.woff",
 "./assets/Filter-Z2q31Rie.js",
 "./assets/GCManagedHash-DzA2oLk0.js",
 "./assets/GraphicsContext-D65hAeHI.js",
 "./assets/RenderTargetSystem-BtgxQzyZ.js",
 "./assets/browserAll-BNq0Dp-r.js",
 "./assets/canvasUtils-BK4oC-r1.js",
 "./assets/getTexelRangeRects-MS1TXtRy.js",
 "./assets/getTextureBatchBindGroup-Bp5sE8XJ.js",
 "./assets/index-C4fXMVz9.js",
 "./assets/index-DUbDr9rE.css",
 "./assets/init-DjyY91SK.js",
 "./assets/pots_catalog-D31HJfnW.webp",
 "./assets/pots_phoenix-B_08-GxF.webp",
 "./assets/pots_signature-D37CSx8T.webp",
 "./assets/scene-BfzeyjM-.png",
 "./assets/sea_clouds-rTo52zQT.webp",
 "./assets/sky-D3vDw_F2.jpg",
 "./assets/sprites-N3Uf7Ocp.png",
 "./assets/village_sky0-Bm5-4f0R.webp",
 "./assets/village_sky1-BLPww570.webp",
 "./assets/village_sky2-C_sgi2vf.webp",
 "./assets/village_sky3-p6b6ZO9y.webp",
 "./assets/village_sky4-BP-Seqmx.webp",
 "./assets/webworkerAll-hJoiFTKd.js",
 "./assets/world10_chars@1x-Cx8w3DMz.webp",
 "./assets/world10_chars@2x-BCFd23v-.webp",
 "./assets/world10_floor_t1_L@1x-BNz5NU0Z.webp",
 "./assets/world10_floor_t1_L@2x-D2z7T_S2.webp",
 "./assets/world10_floor_t1_R@1x-CaE99IMY.webp",
 "./assets/world10_floor_t1_R@2x-FE87ZuYR.webp",
 "./assets/world10_floor_t2_L@1x-YZOFw8jx.webp",
 "./assets/world10_floor_t2_L@2x-Bc-6s_75.webp",
 "./assets/world10_floor_t2_R@1x-DDe4ahFu.webp",
 "./assets/world10_floor_t2_R@2x-BwyWXlrb.webp",
 "./assets/world10_floor_t3_L@1x-on8DaO95.webp",
 "./assets/world10_floor_t3_L@2x-JyUxWTgM.webp",
 "./assets/world10_floor_t3_R@1x-BRSE2acK.webp",
 "./assets/world10_floor_t3_R@2x-DRpeDbCj.webp",
 "./assets/world10_floor_t4_L@1x-Dgy4cnnB.webp",
 "./assets/world10_floor_t4_L@2x-B8puaghB.webp",
 "./assets/world10_floor_t4_R@1x-BMHOxP-q.webp",
 "./assets/world10_floor_t4_R@2x-C1TniJXn.webp",
 "./assets/world10_houses@1x--CDxKNtH.webp",
 "./assets/world10_houses@2x-FzznyIoK.webp",
 "./assets/world10_icons@1x-CDA1PKwj.webp",
 "./assets/world10_icons@2x-LYZbf6mD.webp",
 "./assets/world10_pedestals@1x-BRZB97Nr.webp",
 "./assets/world10_pedestals@2x-Dmu-ht3x.webp",
 "./assets/world10_pets@1x-C5RTQoDM.webp",
 "./assets/world10_pets@2x-DrvaUN2I.webp",
 "./assets/world10_rings@1x-zbsMd9en.webp",
 "./assets/world10_rings@2x-CTLzDEVs.webp",
 "./assets/world10_village@1x-bhhC7WoR.webp",
 "./assets/world10_village@2x-DBM9DPsb.webp",
 "./assets/world10_vine@1x-4vQDKpP2.webp",
 "./assets/world10_vine@2x-D0j3g5U0.webp",
 "./assets/world10_vine_ends@1x-DLAgzfCl.webp",
 "./assets/world10_vine_ends@2x-lg3ZWnoV.webp",
 "./assets/world_floor_bridge-C0D5gwaC.webp",
 "./assets/world_floor_falls-BcuHPa_7.webp",
 "./assets/world_floor_house-BKOw_mfO.webp",
 "./assets/world_misc-oErSEhNx.webp",
 "./assets/world_vine-n00IbkEn.webp",
 "./icons/icon-180.png",
 "./icons/icon-192.png",
 "./icons/icon-512.png",
 "./manifest.webmanifest"
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('pbtc-') && k !== CACHE).map((k) => caches.delete(k)))));
});
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./', { cacheName: CACHE, ignoreVary: true }).then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { cacheName: CACHE, ignoreSearch: true, ignoreVary: true }).then((r) => r || fetch(req)));
});
