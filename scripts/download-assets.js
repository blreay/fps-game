const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ASSETS_DIR = path.join(__dirname, '../public/assets');

// Polyhaven CDN (no auth, direct download)
const TEXTURES = [
  { file: 'concrete_floor.jpg', url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/concrete_floor_02/concrete_floor_02_diff_1k.jpg' },
  { file: 'gravel_ground.jpg',  url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/gravel_concrete_03/gravel_concrete_03_diff_1k.jpg' },
  { file: 'sand_ground.jpg',    url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/sandy_gravel_02/sandy_gravel_02_diff_1k.jpg' },
  { file: 'metal_plate.jpg',    url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/metal_plate/metal_plate_diff_1k.jpg' },
  { file: 'brick_wall.jpg',     url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brick_wall_03/brick_wall_03_diff_1k.jpg' },
];

// Kenney weapons pack (CC0 public domain, direct zip)
const KENNEY_WEAPONS_URL = 'https://kenney.nl/content/3d-assets/weapons-pack.zip';

// OpenGameArt sound packs (CC0)
const SOUNDS = [
  { file: 'empty_click.mp3',     url: 'https://opengameart.org/sites/default/files/click.wav' },
  { file: 'explosion.mp3',       url: 'https://opengameart.org/sites/default/files/Explosion.wav' },
  { file: 'footstep_dirt.mp3',   url: 'https://opengameart.org/sites/default/files/Footstep_dirt.wav' },
  { file: 'footstep_concrete.mp3', url: 'https://opengameart.org/sites/default/files/Footstep_concrete.wav' },
  { file: 'pickup_medkit.mp3',   url: 'https://opengameart.org/sites/default/files/pickup.wav' },
  { file: 'pickup_ammo.mp3',     url: 'https://opengameart.org/sites/default/files/ammo_pickup.wav' },
  { file: 'player_hurt.mp3',     url: 'https://opengameart.org/sites/default/files/hurt.wav' },
  { file: 'enemy_alert.mp3',     url: 'https://opengameart.org/sites/default/files/alert.wav' },
  { file: 'enemy_hurt.mp3',      url: 'https://opengameart.org/sites/default/files/hit.wav' },
  { file: 'knife_slash.mp3',     url: 'https://opengameart.org/sites/default/files/swing.wav' },
  { file: 'knife_hit.mp3',       url: 'https://opengameart.org/sites/default/files/stab.wav' },
  { file: 'heartbeat.mp3',       url: 'https://opengameart.org/sites/default/files/heartbeat.wav' },
];

// Weapon fire sounds — Freesound public previews (low-quality preview, CC0)
const WEAPON_SOUNDS = [
  { file: 'ak47_fire.mp3',      url: 'https://cdn.freesound.org/previews/270/270544_5123851-lq.mp3' },
  { file: 'ak47_reload.mp3',    url: 'https://cdn.freesound.org/previews/379/379420_7236-lq.mp3' },
  { file: 'rifle_reload.mp3',   url: 'https://cdn.freesound.org/previews/512/512301_11234877-lq.mp3' },
  { file: 'm4a1_fire.mp3',      url: 'https://cdn.freesound.org/previews/200/200879_1832861-lq.mp3' },
  { file: 'sniper_fire.mp3',    url: 'https://cdn.freesound.org/previews/321/321107_5260872-lq.mp3' },
  { file: 'sniper_reload.mp3',  url: 'https://cdn.freesound.org/previews/379/379420_7236-lq.mp3' },
  { file: 'pistol_fire.mp3',    url: 'https://cdn.freesound.org/previews/131/131660_2337290-lq.mp3' },
  { file: 'pistol_reload.mp3',  url: 'https://cdn.freesound.org/previews/512/512301_11234877-lq.mp3' },
  { file: 'deagle_fire.mp3',    url: 'https://cdn.freesound.org/previews/321/321108_5260872-lq.mp3' },
  { file: 'shotgun_fire.mp3',   url: 'https://cdn.freesound.org/previews/151/151022_2398403-lq.mp3' },
  { file: 'shotgun_reload.mp3', url: 'https://cdn.freesound.org/previews/379/379420_7236-lq.mp3' },
];

// BGM — Incompetech (CC BY, free for all uses)
const MUSIC = [
  { file: 'battle_bgm.mp3', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Aftermath.mp3' },
  { file: 'win.mp3',        url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Virtutes%20Instrumenti.mp3' },
  { file: 'death.mp3',      url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Dark%20Mystery.mp3' },
];

function download(url, dest) {
  return new Promise((resolve) => {
    if (fs.existsSync(dest)) { console.log(`  ✓ exists: ${path.basename(dest)}`); resolve(); return; }
    const file = fs.createWriteStream(dest);
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, { headers: { 'User-Agent': 'fps-game-asset-downloader/1.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close(); fs.unlinkSync(dest);
        download(res.headers.location, dest).then(resolve);
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); console.log(`  ✓ downloaded: ${path.basename(dest)}`); resolve(); });
    });
    req.on('error', err => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      console.warn(`  ✗ failed: ${path.basename(dest)} — ${err.message}`);
      createSilentMp3(dest);
      resolve();
    });
    req.setTimeout(15000, () => { req.destroy(); });
  });
}

function createSilentMp3(dest) {
  const wavHeader = Buffer.from([
    0x52,0x49,0x46,0x46,0x24,0x00,0x00,0x00,0x57,0x41,0x56,0x45,
    0x66,0x6d,0x74,0x20,0x10,0x00,0x00,0x00,0x01,0x00,0x01,0x00,
    0x44,0xAC,0x00,0x00,0x88,0x58,0x01,0x00,0x02,0x00,0x10,0x00,
    0x64,0x61,0x74,0x61,0x00,0x00,0x00,0x00
  ]);
  fs.writeFileSync(dest.replace(/\.mp3$/, '.wav'), wavHeader);
  console.log(`  → fallback silence: ${path.basename(dest)}`);
}

async function main() {
  console.log('=== FPS Game Asset Downloader ===\n');
  const dirs = ['models','sounds','textures','music'].map(d => path.join(ASSETS_DIR, d));
  dirs.forEach(d => fs.mkdirSync(d, { recursive: true }));

  console.log('[1/4] Downloading textures from Polyhaven...');
  for (const t of TEXTURES) {
    await download(t.url, path.join(ASSETS_DIR, 'textures', t.file));
  }

  console.log('\n[2/4] Downloading weapon sounds from Freesound CDN...');
  for (const s of [...SOUNDS, ...WEAPON_SOUNDS]) {
    await download(s.url, path.join(ASSETS_DIR, 'sounds', s.file));
  }

  console.log('\n[3/4] Downloading background music from Incompetech...');
  for (const m of MUSIC) {
    await download(m.url, path.join(ASSETS_DIR, 'music', m.file));
  }

  console.log('\n[4/4] Downloading weapon models from Kenney.nl...');
  const kenneyZip = path.join(ASSETS_DIR, 'models', '_kenney_weapons.zip');
  await download(KENNEY_WEAPONS_URL, kenneyZip);
  if (fs.existsSync(kenneyZip) && fs.statSync(kenneyZip).size > 1000) {
    try {
      execSync(`cd "${path.join(ASSETS_DIR, 'models')}" && unzip -o _kenney_weapons.zip -d kenney_weapons 2>/dev/null || true`);
      const kenneyDir = path.join(ASSETS_DIR, 'models', 'kenney_weapons');
      const renames = [
        ['Models/OBJ format/ak47.glb', 'ak47.glb'],
        ['Models/OBJ format/m16.glb',  'm4a1.glb'],
        ['Models/OBJ format/sniper.glb','awp.glb'],
        ['Models/OBJ format/pistol.glb','usp.glb'],
        ['Models/OBJ format/revolver.glb','deagle.glb'],
        ['Models/OBJ format/shotgun.glb','shotgun.glb'],
        ['Models/OBJ format/knife.glb', 'dagger.glb'],
        ['Models/OBJ format/machete.glb','combat_knife.glb'],
      ];
      renames.forEach(([src, dst]) => {
        const srcPath = path.join(kenneyDir, src);
        const dstPath = path.join(ASSETS_DIR, 'models', dst);
        if (fs.existsSync(srcPath) && !fs.existsSync(dstPath)) {
          fs.copyFileSync(srcPath, dstPath);
          console.log(`  ✓ extracted: ${dst}`);
        }
      });
    } catch (e) {
      console.warn('  ✗ unzip failed (unzip not installed?). Run: apt-get install unzip');
    }
  }

  // Create placeholder GLB files for any missing models
  const requiredModels = ['ak47','m4a1','awp','usp','deagle','shotgun','dagger','combat_knife'];
  requiredModels.forEach(name => {
    const dst = path.join(ASSETS_DIR, 'models', `${name}.glb`);
    if (!fs.existsSync(dst)) {
      const glb = Buffer.from('glTF\x02\x00\x00\x00\x1c\x00\x00\x00\x0c\x00\x00\x00JSON{"asset":{"version":"2.0"}}', 'binary');
      fs.writeFileSync(dst, glb);
      console.log(`  → placeholder GLB: ${name}.glb`);
    }
  });

  console.log('\n✅ Asset download complete. Run: npm start');
}

main().catch(console.error);
