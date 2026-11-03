/* ==== src/core/Config.js ==== */
/* Core constants. Everything lives under the global namespace E. */
window.E = window.E || {};

E.W = 1280;               // reference resolution (landscape-first)
E.H = 720;
E.FONT = 'Cinzel, "Trajan Pro", Georgia, "Times New Roman", serif';
E.VERSION = '0.1.0';
E.SAVE_SLOTS = 6;
E.MAX_PARTY = 5;
E.MAX_LEVEL = 30;

/* Art-direction palette: dark blue / black / antique gold / purple magic */
E.C = {
  ink: 0x07070f, navy0: 0x0b0d1e, navy1: 0x141a38, navy2: 0x1f2850, navy3: 0x2c3870,
  gold: 0xd4a84a, goldLight: 0xf2d98a, goldDark: 0x8a6a2a,
  purple: 0x8a4be8, purpleLight: 0xc49bff, purpleDark: 0x3b1d73,
  red: 0xc0392b, redLight: 0xff6b5a, green: 0x4caf50, greenLight: 0x8be07a,
  blue: 0x3b82f6, blueLight: 0x8cc4ff, white: 0xf4efe0, grey: 0x7a7f94
};
E.CS = { // css strings
  text: '#e8dcc0', gold: '#d4a84a', goldLight: '#f2d98a', dim: '#8d8aa0', red: '#ff6b5a',
  green: '#8be07a', blue: '#8cc4ff', purple: '#c49bff', white: '#ffffff'
};

E.RARITY = [
  { name: 'Common',    color: 0xcfd2dc, css: '#cfd2dc' },
  { name: 'Uncommon',  color: 0x6ee06a, css: '#6ee06a' },
  { name: 'Rare',      color: 0x5aa8ff, css: '#5aa8ff' },
  { name: 'Epic',      color: 0xb36bff, css: '#b36bff' },
  { name: 'Legendary', color: 0xffc247, css: '#ffc247' }
];

E.MATS = {
  iron:    { name: 'Iron Ore',        icon: 'm_iron' },
  wood:    { name: 'Blackwood Plank', icon: 'm_wood' },
  bone:    { name: 'Bone Shard',      icon: 'm_bone' },
  crystal: { name: 'Frost Crystal',   icon: 'm_crystal' },
  essence: { name: 'Ember Essence',   icon: 'm_essence' }
};

/* ==== src/core/Util.js ==== */
E.U = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  fmt: n => Math.floor(n).toLocaleString('en-US'),
  uid: (() => { let n = Date.now() % 1e6; return () => 'u' + (n++).toString(36) + Math.floor(Math.random() * 1e3).toString(36); })(),
  clone: o => JSON.parse(JSON.stringify(o)),
  // deterministic PRNG for procedural art
  rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
  hex: n => '#' + n.toString(16).padStart(6, '0'),
  mix(a, b, t) { // blend two 0xRRGGBB ints
    const ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255, br = b >> 16 & 255, bg = b >> 8 & 255, bb = b & 255;
    return ((ar + (br - ar) * t) << 16) | ((ag + (bg - ag) * t) << 8) | (ab + (bb - ab) * t) | 0;
  },
  clockStr(min) { const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); }
};

/* ==== src/core/Settings.js ==== */
/* User settings (not game progress). Stored in localStorage; progress is manual-save only (IndexedDB). */
E.Settings = {
  KEY: 'eldoria.settings.v1',
  d: { music: 0.4, sfx: 0.7, damageNumbers: true, screenShake: true, tipsShown: false },
  load() {
    try { const r = localStorage.getItem(this.KEY); if (r) Object.assign(this.d, JSON.parse(r)); } catch (e) { /* storage unavailable */ }
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.d)); } catch (e) { } },
  set(k, v) { this.d[k] = v; this.save(); if (k === 'music' && E.Music) E.Music.setVolume(v); }
};
E.Settings.load();

/* ==== src/core/Audio.js ==== */
/* Tiny WebAudio synth: SFX + ambient dark pad. No audio files needed. */
E.Sfx = {
  ctx: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
  },
  tone(freq, dur, type = 'square', vol = 0.15, slide = 0, delay = 0) {
    if (!this.ctx) return;
    const v = vol * E.Settings.d.sfx; if (v <= 0.001) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.ctx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  },
  play(n) {
    if (!this.ctx) return;
    switch (n) {
      case 'hover': this.tone(660, 0.04, 'triangle', 0.05); break;
      case 'click': this.tone(440, 0.08, 'square', 0.12, 220); break;
      case 'confirm': this.tone(523, 0.08, 'square', 0.12); this.tone(784, 0.12, 'square', 0.12, 0, 0.07); break;
      case 'error': this.tone(180, 0.18, 'sawtooth', 0.14, -60); break;
      case 'coin': this.tone(988, 0.07, 'square', 0.1); this.tone(1319, 0.14, 'square', 0.1, 0, 0.06); break;
      case 'hit': this.tone(140, 0.09, 'sawtooth', 0.12, -60); break;
      case 'crit': this.tone(220, 0.14, 'sawtooth', 0.16, -100); this.tone(900, 0.06, 'square', 0.08); break;
      case 'shoot': this.tone(900, 0.08, 'triangle', 0.08, -500); break;
      case 'magic': this.tone(300, 0.3, 'sine', 0.14, 500); break;
      case 'heal': this.tone(600, 0.1, 'sine', 0.12); this.tone(900, 0.2, 'sine', 0.12, 0, 0.08); break;
      case 'ult': this.tone(110, 0.5, 'sawtooth', 0.18, 300); this.tone(440, 0.4, 'square', 0.1, 400, 0.1); break;
      case 'warn': this.tone(300, 0.12, 'square', 0.1); this.tone(300, 0.12, 'square', 0.1, 0, 0.18); break;
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'square', 0.12, 0, i * 0.1)); break;
      case 'victory': [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.16, 0, i * 0.12)); break;
      case 'defeat': [330, 262, 196, 130].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.12, 0, i * 0.2)); break;
      case 'anvil': this.tone(1200, 0.06, 'square', 0.12); this.tone(800, 0.2, 'triangle', 0.1, 0, 0.04); break;
    }
  }
};

E.Music = {
  on: false, nodes: [],
  start() {
    if (this.on || !E.Sfx.ctx) return;
    const ctx = E.Sfx.ctx; this.on = true;
    this.master = ctx.createGain(); this.master.gain.value = E.Settings.d.music * 0.12; this.master.connect(ctx.destination);
    // slow minor drone: A1 + E2 + C3 with LFO breathing
    [55, 82.4, 130.8, 164.8].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
      o.type = i % 2 ? 'sine' : 'triangle'; o.frequency.value = f; g.gain.value = 0.25;
      l.frequency.value = 0.05 + i * 0.03; lg.gain.value = 0.18; l.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(this.master); o.start(); l.start(); this.nodes.push(o, l);
    });
  },
  setVolume(v) { if (this.master) this.master.gain.value = v * 0.12; }
};

/* ==== src/data/Classes.js ==== */
/* The five hero classes. Growth values are fractions of the base stat gained per level. */
E.CLASSES = {
  guardian: {
    name: 'Guardian', role: 'Tank', tex: 'hero_guardian', melee: true, color: 0x4aa3a0,
    base: { hp: 700, atk: 28, def: 38, spd: 72, range: 52, cd: 1.4, crit: 0.03 },
    grow: { hp: 0.10, atk: 0.06, def: 0.06 },
    titles: ['Guardian', 'Bulwark Knight', 'Citadel Lord'],
    skill: { id: 'roar', names: ['Bulwark Roar', 'Iron Roar', 'Citadel Roar'], cd: 12, desc: 'Taunts nearby enemies and cuts damage taken by 45% for 5s.' },
    ult: { id: 'aegis', names: ['Bastion Aegis', 'Bastion Aegis', 'Aegis Eternal'], unlock: 5, desc: 'Shields the whole party for 8s (absorbs 28% of each ally\'s max HP).' },
    blurb: 'Stands at the front and holds the line.'
  },
  warrior: {
    name: 'Warrior', role: 'Melee DPS', tex: 'hero_warrior', melee: true, color: 0xc0392b,
    base: { hp: 520, atk: 44, def: 24, spd: 92, range: 54, cd: 1.0, crit: 0.1 },
    grow: { hp: 0.09, atk: 0.07, def: 0.05 },
    titles: ['Warrior', 'Blademaster', 'Dread Champion'],
    skill: { id: 'cleave', names: ['Crescent Cleave', 'Crescent Cleave', 'Eclipse Cleave'], cd: 8, desc: 'A sweeping arc hitting every nearby enemy for 170% ATK.' },
    ult: { id: 'tempest', names: ['Blade Tempest', 'Blade Tempest', 'Tempest of Ruin'], unlock: 5, desc: 'Whirls through enemies: 6 strikes of 95% ATK in a wide area.' },
    blurb: 'A swift blade that cuts through packs.'
  },
  mage: {
    name: 'Mage', role: 'Ranged Magic', tex: 'hero_mage', melee: false, color: 0x8a4be8,
    base: { hp: 380, atk: 58, def: 12, spd: 70, range: 235, cd: 1.5, crit: 0.08 },
    grow: { hp: 0.08, atk: 0.08, def: 0.04 },
    titles: ['Mage', 'Arcanist', 'Void Sage'],
    skill: { id: 'voidbolt', names: ['Void Bolt', 'Void Burst', 'Void Cataclysm'], cd: 8, desc: 'Hurls a void orb that explodes for 210% ATK in an area.' },
    ult: { id: 'abyssrain', names: ['Abyssal Rain', 'Abyssal Rain', 'Rain of Ruin'], unlock: 5, desc: 'Calls 8 meteors onto the battlefield (140% ATK each, area).' },
    blurb: 'Devastating area spells from afar.'
  },
  archer: {
    name: 'Archer', role: 'Ranged DPS', tex: 'hero_archer', melee: false, color: 0x4caf50,
    base: { hp: 420, atk: 41, def: 16, spd: 86, range: 275, cd: 0.95, crit: 0.18 },
    grow: { hp: 0.08, atk: 0.07, def: 0.04 },
    titles: ['Archer', 'Ranger', 'Shadow Hunter'],
    skill: { id: 'pierce', names: ['Piercing Shot', 'Piercing Shot', 'Gale Piercer'], cd: 7, desc: 'A shot that pierces every enemy in a line for 185% ATK.' },
    ult: { id: 'arrowstorm', names: ['Arrow Storm', 'Arrow Storm', 'Storm of a Thousand'], unlock: 5, desc: 'A volley that hits every enemy on the field for 160% ATK.' },
    blurb: 'Fast, accurate and deadly at range.'
  },
  cleric: {
    name: 'Cleric', role: 'Healer', tex: 'hero_cleric', melee: false, color: 0xe8d38a,
    base: { hp: 450, atk: 32, def: 18, spd: 74, range: 215, cd: 1.5, crit: 0.04 },
    grow: { hp: 0.09, atk: 0.07, def: 0.05 },
    titles: ['Cleric', 'Priest', 'Saint of Dawn'],
    skill: { id: 'mend', names: ['Mending Light', 'Radiant Mend', 'Dawnbringer Mend'], cd: 7, desc: 'Heals the most wounded ally for 260% ATK (and nearby allies for half).' },
    ult: { id: 'sanctuary', names: ['Sanctuary', 'Sanctuary', 'Last Dawn'], unlock: 5, desc: 'Heals the whole party for 45% max HP and raises one fallen hero.' },
    blurb: 'Keeps the party alive in long fights.'
  }
};
E.CLASS_ORDER = ['guardian', 'warrior', 'mage', 'archer', 'cleric'];

E.TIER_MULT = [1, 1.3, 1.7];
E.PROMO = [
  null,
  { level: 10, gold: 600,  mats: { bone: 12, iron: 10 } },     // Tier 1 -> 2
  { level: 20, gold: 2500, mats: { essence: 15, crystal: 10 } } // Tier 2 -> 3
];

E.NAMES = {
  guardian: ['Brenna', 'Dorian', 'Hild', 'Torvald', 'Maren', 'Osric'],
  warrior: ['Aldric', 'Selene', 'Roderick', 'Kaelin', 'Ysolde', 'Garrick'],
  mage: ['Lyra', 'Evander', 'Mirelle', 'Zephyr', 'Isolde', 'Corvin'],
  archer: ['Fenwick', 'Rowan', 'Thalia', 'Wren', 'Lucan', 'Sable'],
  cleric: ['Elowen', 'Cassian', 'Ambrose', 'Seraphine', 'Odette', 'Bram']
};

/* ==== src/data/Items.js ==== */
/* Equipment is generated from (type x tier). An owned item is {uid, key:'sword_0', lvl:0}. */
E.TIERS = [
  { name: 'Iron',        rarity: 0, mult: 1.0, mats: { iron: 6, wood: 3 },                gold: 60 },
  { name: 'Steel',       rarity: 1, mult: 1.8, mats: { iron: 10, bone: 8 },               gold: 240 },
  { name: 'Frostsilver', rarity: 2, mult: 3.0, mats: { crystal: 10, iron: 10 },           gold: 700 },
  { name: 'Emberforged', rarity: 3, mult: 4.6, mats: { essence: 10, crystal: 6, iron: 12 }, gold: 1800 },
  { name: 'Abyssal',     rarity: 4, mult: 6.8, mats: { essence: 14, crystal: 12 },        gold: 4500 }
];

E.EQUIP = {
  sword:  { name: 'Sword',  slot: 'weapon',    cls: 'warrior',  icon: 'i_sword',  base: { atk: 16 } },
  shield: { name: 'Aegis',  slot: 'weapon',    cls: 'guardian', icon: 'i_shield', base: { def: 12, atk: 6, hp: 30 } },
  staff:  { name: 'Staff',  slot: 'weapon',    cls: 'mage',     icon: 'i_staff',  base: { atk: 20 } },
  bow:    { name: 'Bow',    slot: 'weapon',    cls: 'archer',   icon: 'i_bow',    base: { atk: 17 } },
  mace:   { name: 'Mace',   slot: 'weapon',    cls: 'cleric',   icon: 'i_mace',   base: { atk: 14, hp: 30 } },
  armor:  { name: 'Armor',  slot: 'armor',     cls: null,       icon: 'i_armor',  base: { def: 10, hp: 60 } },
  ring:   { name: 'Ring',   slot: 'accessory', cls: null,       icon: 'i_ring',   base: { atk: 8 } },
  amulet: { name: 'Amulet', slot: 'accessory', cls: null,       icon: 'i_amulet', base: { hp: 90 } },
  charm:  { name: 'Charm',  slot: 'accessory', cls: null,       icon: 'i_charm',  base: { def: 7 } }
};
E.SLOTS = ['weapon', 'armor', 'accessory'];
E.SLOT_NAMES = { weapon: 'Weapon', armor: 'Armor', accessory: 'Accessory' };
E.MAX_UPGRADE = 5;

E.Items = {
  key: (type, tier) => type + '_' + tier,
  parse(key) { const [type, tier] = key.split('_'); return { type, tier: +tier, def: E.EQUIP[type], t: E.TIERS[+tier] }; },
  name(g) { const p = this.parse(g.key); return p.t.name + ' ' + p.def.name + (g.lvl ? ' +' + g.lvl : ''); },
  icon(g) { return this.parse(g.key).def.icon; },
  rarity(g) { return E.RARITY[this.parse(g.key).t.rarity]; },
  slot(g) { return this.parse(g.key).def.slot; },
  stats(g) { // {atk,def,hp}
    const p = this.parse(g.key), out = { atk: 0, def: 0, hp: 0 };
    const m = p.t.mult * (1 + 0.12 * (g.lvl || 0));
    for (const k in p.def.base) out[k] = Math.round(p.def.base[k] * m);
    return out;
  },
  statLine(st) {
    const parts = [];
    if (st.atk) parts.push('ATK +' + st.atk); if (st.def) parts.push('DEF +' + st.def); if (st.hp) parts.push('HP +' + st.hp);
    return parts.join('  ');
  },
  sellPrice(g) { const p = this.parse(g.key); return Math.round((p.t.gold * 0.35 + 10) * (1 + 0.4 * (g.lvl || 0)) * (p.def.slot === 'accessory' ? 0.8 : 1)); },
  recipe(key) {
    const p = this.parse(key), f = p.def.slot === 'armor' ? 1.25 : p.def.slot === 'accessory' ? 0.7 : 1;
    const mats = {}; for (const m in p.t.mats) mats[m] = Math.max(1, Math.round(p.t.mats[m] * f));
    return { gold: Math.round(p.t.gold * f), mats };
  },
  upgradeCost(g) {
    const p = this.parse(g.key), n = (g.lvl || 0) + 1;
    return { gold: Math.round(80 * n * (p.tier + 1) * (1 + p.tier * 0.4)), mats: { iron: 3 * n + p.tier * 3 } };
  },
  allKeys() { const k = []; for (let t = 0; t < E.TIERS.length; t++) for (const ty in E.EQUIP) k.push(this.key(ty, t)); return k; },
  random(tier, slotFilter) {
    const types = Object.keys(E.EQUIP).filter(t => !slotFilter || E.EQUIP[t].slot === slotFilter);
    return this.key(E.U.pick(types), tier);
  }
};

/* ==== src/data/Enemies.js ==== */
/* Base enemy archetypes at power 1. Dungeons scale them and re-skin with a palette. */
E.ENEMIES = {
  wolf:   { shape: 'wolf',   hp: 120, atk: 18, def: 4,  spd: 135, range: 42,  cd: 0.9, scale: 2.7, ranged: false },
  thorn:  { shape: 'thorn',  hp: 190, atk: 15, def: 8,  spd: 66,  range: 48,  cd: 1.3, scale: 2.9, ranged: false },
  skel:   { shape: 'skel',   hp: 100, atk: 23, def: 3,  spd: 76,  range: 250, cd: 1.5, scale: 3.0, ranged: true, proj: 'arrow' },
  knight: { shape: 'knight', hp: 560, atk: 34, def: 24, spd: 66,  range: 52,  cd: 1.4, scale: 3.4, ranged: false, elite: true },
  shaman: { shape: 'shaman', hp: 400, atk: 30, def: 10, spd: 62,  range: 230, cd: 1.8, scale: 3.1, ranged: true, proj: 'orb', healer: true, elite: true }
};

/* Boss template; every dungeon names / scales its own. Attacks are telegraphed. */
E.BOSS_BASE = { shape: 'boss', hp: 3400, atk: 42, def: 26, spd: 46, range: 92, cd: 1.9, scale: 3.4, radius: 70 };

/* ==== src/data/Dungeons.js ==== */
/* Dungeons: 4 stages each (monsters -> mixed -> elite -> boss). Stages are repeatable. No stamina. */
E.DUNGEONS = [
  {
    id: 'forest', name: 'The Cursed Forest', region: 'Blackwood Forest', pal: 'forest', power: 1.0, recLv: 1,
    gearTier: 0, gold: [45, 80], xp: 70, unlock: null, mapPos: [0.30, 0.64],
    mats: { wood: [2, 5], bone: [1, 3], iron: [1, 3] },
    names: { wolf: 'Blighted Wolf', thorn: 'Thornling', skel: 'Bone Archer', knight: 'Cursed Knight', shaman: 'Hollow Shaman' },
    boss: { name: 'The Blighted Guardian', atk: ['Root Slam', 'Thorn Lance', 'Grasping Roots'] },
    desc: 'The first wound of the Abyss. Ancient guardians of Blackwood have rotted from within.',
    stages: [
      { name: 'Forest Outskirts', waves: [['wolf', 3], ['thorn', 1]] },
      { name: 'The Hollow Path', waves: [['wolf', 2], ['skel', 2], ['thorn', 2]] },
      { name: 'Elder Grove', waves: [['knight', 1], ['wolf', 3], ['skel', 2]] },
      { name: 'Heart of the Curse', boss: true, waves: [['wolf', 2], ['skel', 1]] }
    ]
  },
  {
    id: 'frost', name: 'Frostgate Pass', region: 'Northern Frontier', pal: 'frost', power: 2.7, recLv: 10,
    gearTier: 2, gold: [160, 260], xp: 260, unlock: 'forest', mapPos: [0.62, 0.17],
    mats: { crystal: [2, 5], iron: [3, 6], bone: [1, 3] },
    names: { wolf: 'Rime Wolf', thorn: 'Frozen Husk', skel: 'Frostbound Archer', knight: 'Winter Knight', shaman: 'Hoarfrost Shaman' },
    boss: { name: 'The Frostbound Warden', atk: ['Glacial Slam', 'Ice Lance', 'Shatterfield'] },
    desc: 'The northern gate has frozen shut, sealing a legion of the fallen behind ice.',
    stages: [
      { name: 'Frozen Road', waves: [['wolf', 4], ['skel', 2]] },
      { name: 'Broken Watchtower', waves: [['thorn', 3], ['skel', 3], ['wolf', 2]] },
      { name: 'Ice Barracks', waves: [['knight', 2], ['shaman', 1], ['wolf', 3]] },
      { name: 'The Warden\'s Gate', boss: true, waves: [['wolf', 2], ['shaman', 1]] }
    ]
  },
  {
    id: 'ash', name: 'Cinder Wastes', region: 'Ashen Mountains', pal: 'ash', power: 5.2, recLv: 18,
    gearTier: 3, gold: [380, 560], xp: 650, unlock: 'frost', mapPos: [0.80, 0.55],
    mats: { essence: [2, 5], iron: [4, 8], crystal: [1, 3] },
    names: { wolf: 'Cinder Hound', thorn: 'Magma Husk', skel: 'Ashen Archer', knight: 'Slag Knight', shaman: 'Emberpriest' },
    boss: { name: 'The Cinder Colossus', atk: ['Magma Slam', 'Lava Lance', 'Eruption'] },
    desc: 'The mountains burn with Abyssal fire. Something huge sleeps in the caldera.',
    stages: [
      { name: 'Smoldering Trail', waves: [['wolf', 4], ['skel', 3]] },
      { name: 'Slag Quarry', waves: [['thorn', 4], ['skel', 3], ['wolf', 2]] },
      { name: 'Forge of Cinders', waves: [['knight', 2], ['shaman', 2], ['wolf', 3]] },
      { name: 'The Caldera', boss: true, waves: [['wolf', 3], ['shaman', 1]] }
    ]
  },
  {
    id: 'abyss', name: 'The Rift of Ruin', region: 'The Abyss', pal: 'abyss', power: 8.5, recLv: 24,
    gearTier: 4, gold: [800, 1200], xp: 1300, unlock: 'ash', mapPos: [0.86, 0.84],
    mats: { essence: [4, 8], crystal: [3, 7], iron: [5, 9] },
    names: { wolf: 'Void Stalker', thorn: 'Rift Tendril', skel: 'Hollow Archer', knight: 'Abyss Knight', shaman: 'Void Cultist' },
    boss: { name: 'Vael, the Abyssal Sovereign', atk: ['Void Slam', 'Rift Lance', 'Collapse'] },
    desc: 'The wound in the world itself. Whatever crowns itself here must be destroyed.',
    stages: [
      { name: 'Edge of the Rift', waves: [['wolf', 5], ['skel', 3]] },
      { name: 'Crawling Dark', waves: [['thorn', 4], ['skel', 4], ['wolf', 3]] },
      { name: 'Cultist Sanctum', waves: [['knight', 3], ['shaman', 2], ['wolf', 3]] },
      { name: 'The Sovereign\'s Throne', boss: true, waves: [['wolf', 3], ['shaman', 2]] }
    ]
  },
  {
    id: 'capital', name: 'The Fallen Throne', region: 'Royal Capital', pal: 'capital', power: 11, recLv: 28,
    gearTier: 4, gold: [1400, 2000], xp: 2400, unlock: 'abyss', mapPos: [0.45, 0.36],
    mats: { essence: [6, 10], crystal: [5, 9], iron: [6, 10] },
    names: { wolf: 'Gilded Hound', thorn: 'Thronebound Husk', skel: 'Royal Revenant', knight: 'Hollow Guard', shaman: 'Chancellor Shade' },
    boss: { name: 'The Hollow King', atk: ['Crown Slam', 'Scepter Lance', 'Court of Ashes'] },
    desc: 'Your father\'s throne room. Reclaim the crown, and end the Abyss for good.',
    stages: [
      { name: 'Ruined Gates', waves: [['wolf', 5], ['skel', 4]] },
      { name: 'Gallery of Kings', waves: [['thorn', 4], ['skel', 4], ['knight', 1]] },
      { name: 'Court of Ashes', waves: [['knight', 3], ['shaman', 3], ['wolf', 3]] },
      { name: 'The Fallen Throne', boss: true, waves: [['knight', 2], ['shaman', 2]] }
    ]
  }
];

E.Dungeons = {
  get(id) { return E.DUNGEONS.find(d => d.id === id); },
  stageMult: [1, 1.2, 1.5, 2.4],
  isUnlocked(d, s) { return !d.unlock || !!(s.cleared[d.unlock] && s.cleared[d.unlock].boss); },
  stageUnlocked(d, idx, s) { const c = s.cleared[d.id]; return this.isUnlocked(d, s) && (idx === 0 || (c && c.stages >= idx)); },
  /* A Blood-Moon raid on the Bastion, built as a temporary dungeon/stage. */
  raid(day) {
    const p = Math.max(1, 0.8 + day * 0.18);
    return {
      id: 'raid', name: 'Defend the Bastion', region: 'The Last Bastion', pal: 'forest', power: p, recLv: 1, gearTier: 0,
      gold: [60 + day * 12, 100 + day * 20], xp: 60 + day * 8, unlock: null, mats: { iron: [2, 4], bone: [1, 3] },
      names: { wolf: 'Abyss Hound', thorn: 'Rift Husk', skel: 'Void Archer', knight: 'Abyss Marauder', shaman: 'Void Cultist' },
      boss: { name: '', atk: [] }, desc: '',
      stages: [{ name: 'Blood Moon Raid', waves: [['wolf', 3 + Math.min(4, Math.floor(day / 4))], ['skel', 2], ['thorn', 1], ...(day > 6 ? [['knight', 1]] : [])] }]
    };
  }
};

/* ==== src/data/Events.js ==== */
/* Random town events. Each choice's do(s) returns {text, battle?}. */
E.EVENTS = [
  { id: 'merchant', title: 'Wandering Merchant', weight: 3,
    text: 'A cloaked trader rolls a creaking cart up to the gate. "Fine ore for a fine price, Your Highness."',
    choices: [
      { label: 'Buy iron bundle (120g)', cond: s => s.gold >= 120, do: s => { E.Inv.spendGold(120); E.Inv.addMat('iron', 12); return { text: 'You acquire 12 Iron Ore.' }; } },
      { label: 'Buy bone & wood (90g)', cond: s => s.gold >= 90, do: s => { E.Inv.spendGold(90); E.Inv.addMat('bone', 6); E.Inv.addMat('wood', 6); return { text: 'You acquire 6 Bone Shards and 6 Blackwood Planks.' }; } },
      { label: 'Send him away', do: () => ({ text: 'The merchant tips his hood and trundles on.' }) }
    ] },
  { id: 'refugees', title: 'Refugees at the Gate', weight: 3,
    text: 'A column of hollow-eyed survivors begs shelter behind the Bastion walls.',
    choices: [
      { label: 'Take them in (-60g)', cond: s => s.gold >= 60, do: s => { E.Inv.spendGold(60); const g = E.U.randInt(120, 260); E.Inv.addGold(g); E.Inv.addMat('wood', 4); return { text: 'They repay your kindness with labour: +' + g + ' gold and 4 planks.' }; } },
      { label: 'Turn them away', do: () => ({ text: 'The gates stay shut. The column drifts into the dark.' }) }
    ] },
  { id: 'smith', title: 'The Smith\'s Discovery', weight: 2,
    text: 'The old smith found a seam of ore beneath the forge floor, and asks for a few hands to dig it out.',
    choices: [
      { label: 'Dig it out', do: s => { const n = E.U.randInt(6, 12); E.Inv.addMat('iron', n); return { text: 'The team hauls up ' + n + ' Iron Ore.' }; } }
    ] },
  { id: 'bard', title: 'Traveling Bard', weight: 2,
    text: 'A bard sings of the old kings and the dawn to come. Morale in the barracks lifts.',
    choices: [
      { label: 'Tip her (-40g)', cond: s => s.gold >= 40, do: s => { E.Inv.spendGold(40); s.heroes.forEach(h => E.Hero.addXp(h, 25 + h.level * 4, true)); return { text: 'Inspired, every hero gains experience.' }; } },
      { label: 'Listen quietly', do: () => ({ text: 'A pleasant evening. Nothing more.' }) }
    ] },
  { id: 'relic', title: 'A Cursed Relic', weight: 2,
    text: 'Scouts drag in a pulsing, purple-veined relic found near the treeline. It hums at you.',
    choices: [
      { label: 'Study it (risky)', do: s => { if (Math.random() < 0.5) { const g = E.U.randInt(250, 500); E.Inv.addGold(g); E.Inv.addMat('essence', 3); return { text: 'It shatters into coin and 3 Ember Essence. +' + g + 'g.' }; } const l = Math.min(s.gold, 100); E.Inv.spendGold(l); return { text: 'It lashes out and scorches the vault. -' + l + ' gold.' }; } },
      { label: 'Bury it', do: () => ({ text: 'You have it sealed beneath the flagstones.' }) }
    ] },
  { id: 'raid', title: 'Blood Moon Raid!', weight: 0, special: true,
    text: 'The moon turns red. Creatures of the Abyss pour toward the walls!',
    choices: [
      { label: 'Defend the walls!', do: () => ({ text: 'To arms!', battle: true }) },
      { label: 'Pay them off (-250g)', cond: s => s.gold >= 250, do: s => { E.Inv.spendGold(250); return { text: 'The tribute is taken. The horde withdraws... for now.' }; } },
      { label: 'Hide and wait', do: s => { const l = Math.min(s.gold, 150); E.Inv.spendGold(l); return { text: 'The raiders loot the storehouse. -' + l + ' gold.' }; } }
    ] }
];

/* ==== src/data/Quests.js ==== */
/* Main story quests. Checked against live state; reward is claimed in the Command Hall. */
E.QUESTS = [
  { id: 'q1', title: 'Rally the Guard', desc: 'Recruit heroes until you command 3 fighters. Visit the Recruitment Hall.',
    check: s => s.heroes.length >= 3, prog: s => Math.min(3, s.heroes.length) + ' / 3', reward: { gold: 250 } },
  { id: 'q2', title: 'A Full Banner', desc: 'Field a party of 5 heroes.',
    check: s => s.party.length >= 5, prog: s => s.party.length + ' / 5', reward: { gold: 300, mats: { iron: 6 } } },
  { id: 'q3', title: 'Forge the First Blade', desc: 'Craft any piece of equipment at the Blacksmith.',
    check: s => s.stats.crafted >= 1, prog: s => Math.min(1, s.stats.crafted) + ' / 1', reward: { gold: 200, mats: { wood: 6 } } },
  { id: 'q4', title: 'Into the Cursed Forest', desc: 'Win a battle in an expedition (Expedition Gate).',
    check: s => s.stats.battlesWon >= 1, prog: s => Math.min(1, s.stats.battlesWon) + ' / 1', reward: { gold: 300 } },
  { id: 'q5', title: 'Slay the Blighted Guardian', desc: 'Defeat the boss of The Cursed Forest.',
    check: s => !!(s.cleared.forest && s.cleared.forest.boss), prog: s => (s.cleared.forest && s.cleared.forest.boss) ? '1 / 1' : '0 / 1', reward: { gold: 800, mats: { bone: 10 } } },
  { id: 'q6', title: 'Rise Through the Ranks', desc: 'Promote a hero to a higher tier at the Barracks.',
    check: s => s.stats.promoted >= 1, prog: s => Math.min(1, s.stats.promoted) + ' / 1', reward: { gold: 700, mats: { crystal: 6 } } },
  { id: 'q7', title: 'Break the Northern Seal', desc: 'Defeat the Frostbound Warden in the Northern Frontier.',
    check: s => !!(s.cleared.frost && s.cleared.frost.boss), prog: s => (s.cleared.frost && s.cleared.frost.boss) ? '1 / 1' : '0 / 1', reward: { gold: 2000, mats: { crystal: 10 } } },
  { id: 'q8', title: 'Quench the Caldera', desc: 'Defeat the Cinder Colossus in the Ashen Mountains.',
    check: s => !!(s.cleared.ash && s.cleared.ash.boss), prog: s => (s.cleared.ash && s.cleared.ash.boss) ? '1 / 1' : '0 / 1', reward: { gold: 4000, mats: { essence: 12 } } },
  { id: 'q9', title: 'Close the Rift', desc: 'Destroy Vael, the Abyssal Sovereign.',
    check: s => !!(s.cleared.abyss && s.cleared.abyss.boss), prog: s => (s.cleared.abyss && s.cleared.abyss.boss) ? '1 / 1' : '0 / 1', reward: { gold: 8000, mats: { essence: 20, crystal: 15 } } },
  { id: 'q10', title: 'Reclaim the Crown', desc: 'Defeat the Hollow King and retake the Royal Capital.',
    check: s => !!(s.cleared.capital && s.cleared.capital.boss), prog: s => (s.cleared.capital && s.cleared.capital.boss) ? '1 / 1' : '0 / 1', reward: { gold: 20000 } }
];

/* ==== src/core/GameState.js ==== */
/* Single source of truth for progress. E.G.s is the live state object; it only reaches disk via manual save. */
E.G = {
  s: null,
  fresh() {
    return {
      version: 1, time: 8 * 60, gold: 700,
      mats: { iron: 8, wood: 8, bone: 0, crystal: 0, essence: 0 },
      gear: [], heroes: [], party: [],
      formation: { pos: {}, presets: [null, null, null] },
      fortress: { level: 1, taxPending: 0 },
      training: [], recruits: { day: 0, list: [] },
      cleared: {}, claimed: [],
      stats: { crafted: 0, promoted: 0, battlesWon: 0, raids: 0, upgrades: 0 },
      events: { next: 14 * 60 + 8 * 60, lastRaidDay: 0, seen: 0 },
      hintsSeen: {}
    };
  },
  newGame() {
    this.s = this.fresh(); const s = this.s;
    const prince = E.Hero.create('warrior', 'Kael', 1); prince.prince = true;
    const guard = E.Hero.create('guardian', 'Brenna', 1);
    s.heroes.push(prince, guard); s.party = [prince.id, guard.id];
    E.Inv.addGear('sword_0'); E.Inv.addGear('shield_0');
    E.Inv.equip(prince, s.gear[0].uid); E.Inv.equip(guard, s.gear[1].uid);
    E.Form.autoArrange(s.party.map(id => this.hero(id)), s.formation.pos);
    E.Town.refreshRecruits(true);
    s.events.next = s.time + 6 * 60; // first visitor arrives in-game ~6h in
    return s;
  },
  load(obj) {
    const base = this.fresh(); this.s = Object.assign(base, obj);
    this.s.stats = Object.assign(base.stats, obj.stats || {});
    this.s.events = Object.assign(base.events, obj.events || {});
    this.s.fortress = Object.assign(base.fortress, obj.fortress || {});
    return this.s;
  },
  serialize() { return JSON.parse(JSON.stringify(this.s)); },
  hero(id) { return this.s.heroes.find(h => h.id === id); },
  day() { return Math.floor(this.s.time / 1440) + 1; }
};

/* ==== src/characters/Hero.js ==== */
E.Hero = {
  create(cls, name, level = 1) {
    return { id: E.U.uid(), name: name || E.U.pick(E.NAMES[cls]), cls, level, xp: 0, tier: 0, equip: { weapon: null, armor: null, accessory: null } };
  },
  xpNeed: lv => Math.floor(60 + lv * lv * 14),
  title(h) { return E.CLASSES[h.cls].titles[h.tier]; },
  /* Final combat stats including tier multiplier and equipment. */
  stats(h) {
    const c = E.CLASSES[h.cls], L = h.level - 1, tm = E.TIER_MULT[h.tier];
    const st = {
      hp: c.base.hp * (1 + c.grow.hp * L) * tm, atk: c.base.atk * (1 + c.grow.atk * L) * tm, def: c.base.def * (1 + c.grow.def * L) * tm,
      spd: c.base.spd, range: c.base.range, cd: c.base.cd, crit: c.base.crit
    };
    for (const slot of E.SLOTS) {
      const uid = h.equip[slot]; if (!uid) continue;
      const g = E.Inv.gearByUid(uid); if (!g) continue;
      const b = E.Items.stats(g); st.hp += b.hp; st.atk += b.atk; st.def += b.def;
    }
    st.hp = Math.round(st.hp); st.atk = Math.round(st.atk); st.def = Math.round(st.def);
    return st;
  },
  power(h) { const s = this.stats(h); return Math.round(s.hp / 10 + s.atk * 4 + s.def * 3); },
  /* Returns number of levels gained. */
  addXp(h, amount, silent) {
    if (h.level >= E.MAX_LEVEL) return 0;
    h.xp += Math.round(amount); let gained = 0;
    while (h.level < E.MAX_LEVEL && h.xp >= this.xpNeed(h.level)) { h.xp -= this.xpNeed(h.level); h.level++; gained++; }
    if (h.level >= E.MAX_LEVEL) h.xp = 0;
    return gained;
  },
  promoReq(h) { return h.tier < 2 ? E.PROMO[h.tier + 1] : null; },
  canPromote(h) {
    const r = this.promoReq(h); if (!r) return { ok: false, why: 'Max tier reached' };
    if (h.level < r.level) return { ok: false, why: 'Requires level ' + r.level };
    if (E.G.s.gold < r.gold) return { ok: false, why: 'Not enough gold' };
    if (!E.Inv.hasMats(r.mats)) return { ok: false, why: 'Missing materials' };
    return { ok: true };
  },
  promote(h) {
    const c = this.canPromote(h); if (!c.ok) return false;
    const r = this.promoReq(h); E.Inv.spendGold(r.gold); E.Inv.spendMats(r.mats);
    h.tier++; E.G.s.stats.promoted++; return true;
  },
  skillName(h, kind) { const c = E.CLASSES[h.cls][kind === 'ult' ? 'ult' : 'skill']; return c.names[h.tier]; },
  skillPower: h => 1 + 0.25 * h.tier,
  ultUnlocked: h => h.level >= E.CLASSES[h.cls].ult.unlock
};

/* ==== src/inventory/Inventory.js ==== */
E.Inv = {
  get s() { return E.G.s; },
  addGold(n) { this.s.gold += Math.round(n); },
  spendGold(n) { if (this.s.gold < n) return false; this.s.gold -= Math.round(n); return true; },
  addMat(k, n) { this.s.mats[k] = (this.s.mats[k] || 0) + n; },
  hasMats(m) { for (const k in m) if ((this.s.mats[k] || 0) < m[k]) return false; return true; },
  spendMats(m) { if (!this.hasMats(m)) return false; for (const k in m) this.s.mats[k] -= m[k]; return true; },
  addGear(key, lvl = 0) { const g = { uid: E.U.uid(), key, lvl }; this.s.gear.push(g); return g; },
  gearByUid(uid) { return this.s.gear.find(g => g.uid === uid); },
  equippedBy(uid) { return this.s.heroes.find(h => E.SLOTS.some(sl => h.equip[sl] === uid)); },
  canEquip(h, g) {
    const p = E.Items.parse(g.key); return !p.def.cls || p.def.cls === h.cls;
  },
  equip(h, uid) {
    const g = this.gearByUid(uid); if (!g || !this.canEquip(h, g)) return false;
    const slot = E.Items.slot(g), other = this.equippedBy(uid);
    if (other) other.equip[slot] = null;
    h.equip[slot] = uid; return true;
  },
  unequip(h, slot) { h.equip[slot] = null; },
  sell(uid) {
    const g = this.gearByUid(uid); if (!g || this.equippedBy(uid)) return 0;
    const p = E.Items.sellPrice(g); this.s.gear = this.s.gear.filter(x => x.uid !== uid); this.addGold(p); return p;
  },
  used() { return this.s.gear.length + Object.values(this.s.mats).filter(v => v > 0).length; },
  capacity() { return 60 + this.s.fortress.level * 20; }
};

/* ==== src/equipment/Crafting.js ==== */
/* Blacksmith: craft (gold + materials) and upgrade equipment up to +5. */
E.Craft = {
  canCraft(key) {
    const r = E.Items.recipe(key), s = E.G.s;
    if (s.gear.length >= E.Inv.capacity()) return { ok: false, why: 'Inventory full' };
    if (s.gold < r.gold) return { ok: false, why: 'Not enough gold' };
    if (!E.Inv.hasMats(r.mats)) return { ok: false, why: 'Missing materials' };
    return { ok: true };
  },
  craft(key) {
    const c = this.canCraft(key); if (!c.ok) return null;
    const r = E.Items.recipe(key); E.Inv.spendGold(r.gold); E.Inv.spendMats(r.mats);
    E.G.s.stats.crafted++; return E.Inv.addGear(key);
  },
  canUpgrade(g) {
    if ((g.lvl || 0) >= E.MAX_UPGRADE) return { ok: false, why: 'Max +' + E.MAX_UPGRADE };
    const c = E.Items.upgradeCost(g);
    if (E.G.s.gold < c.gold) return { ok: false, why: 'Not enough gold' };
    if (!E.Inv.hasMats(c.mats)) return { ok: false, why: 'Missing materials' };
    return { ok: true };
  },
  upgrade(g) {
    if (!this.canUpgrade(g).ok) return false;
    const c = E.Items.upgradeCost(g); E.Inv.spendGold(c.gold); E.Inv.spendMats(c.mats);
    g.lvl = (g.lvl || 0) + 1; E.G.s.stats.upgrades++; return true;
  }
};

/* ==== src/formation/Formation.js ==== */
/* Formation logic: free placement inside the deploy zone, no overlaps, auto-arrange, presets. */
E.Form = {
  zone: { x0: 70, x1: 560, y0: 130, y1: 560 },
  minDist: 78,
  clampPos(p) { return { x: E.U.clamp(p.x, this.zone.x0, this.zone.x1), y: E.U.clamp(p.y, this.zone.y0, this.zone.y1) }; },
  overlaps(p, others) { return others.some(o => Math.hypot(o.x - p.x, o.y - p.y) < this.minDist); },
  /* Nearest free spot to p (spiral search) that doesn't overlap `others`. */
  freeSpot(p, others) {
    p = this.clampPos(p);
    if (!this.overlaps(p, others)) return p;
    for (let r = 8; r < 600; r += 8) {
      const steps = Math.max(8, Math.floor(r / 6));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const q = this.clampPos({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r });
        if (!this.overlaps(q, others)) return q;
      }
    }
    return p;
  },
  /* Role-based layout: tanks forward, healers/mages back. Writes into posMap. */
  autoArrange(heroes, posMap) {
    const rowX = { guardian: 470, warrior: 400, archer: 250, mage: 175, cleric: 130 };
    const byRow = {};
    heroes.forEach(h => { (byRow[h.cls] = byRow[h.cls] || []).push(h); });
    const order = ['guardian', 'warrior', 'archer', 'mage', 'cleric'];
    const n = heroes.length, zH = this.zone.y1 - this.zone.y0;
    // spread all heroes vertically, sorted by their class column
    const sorted = heroes.slice().sort((a, b) => order.indexOf(a.cls) - order.indexOf(b.cls));
    const used = [];
    sorted.forEach((h, i) => {
      const y = this.zone.y0 + zH * ((i + 0.5) / n) * 0.9 + zH * 0.05;
      // interleave: alternate order vertically so columns stay clear
      const idx = (i * 2) % n + (i * 2 >= n ? 1 : 0);
      const yy = this.zone.y0 + 20 + (zH - 40) * (n === 1 ? 0.5 : idx / (n - 1));
      const spot = this.freeSpot({ x: rowX[h.cls] || 300, y: yy }, used);
      used.push(spot); posMap[h.id] = spot;
    });
    return posMap;
  },
  /* Make sure every party hero has a valid, non-overlapping position. */
  sanitize(s) {
    const used = [];
    s.party.forEach(id => {
      let p = s.formation.pos[id] || { x: 200, y: 340 };
      p = this.freeSpot(p, used); used.push(p); s.formation.pos[id] = { x: Math.round(p.x), y: Math.round(p.y) };
    });
  },
  savePreset(s, i) {
    const pos = {}; s.party.forEach(id => { pos[id] = Object.assign({}, s.formation.pos[id]); });
    s.formation.presets[i] = { party: s.party.slice(), pos };
  },
  loadPreset(s, i) {
    const p = s.formation.presets[i]; if (!p) return false;
    const ids = p.party.filter(id => s.heroes.some(h => h.id === id)).slice(0, E.MAX_PARTY);
    s.party = ids; ids.forEach(id => { s.formation.pos[id] = Object.assign({}, p.pos[id]); });
    this.sanitize(s); return true;
  }
};

/* ==== src/town/Clock.js ==== */
/* In-game clock. 1 real second in town = 6 game minutes (a day lasts ~4 real minutes). */
E.Clock = {
  RATE: 6,
  listeners: [],
  advance(min) {
    const s = E.G.s, d0 = Math.floor(s.time / 1440);
    s.time += min;
    const d1 = Math.floor(s.time / 1440);
    for (let d = d0 + 1; d <= d1; d++) E.Town.onNewDay(d + 1);
  },
  hour() { return (E.G.s.time % 1440) / 60; },
  /* 0 (day) .. 1 (deep night) */
  darkness() {
    const h = this.hour();
    if (h >= 7 && h < 18) return 0;
    if (h >= 18 && h < 21) return (h - 18) / 3;
    if (h >= 21 || h < 4) return 1;
    if (h >= 4 && h < 7) return 1 - (h - 4) / 3;
    return 0;
  },
  label() { const s = E.G.s; return 'Day ' + (Math.floor(s.time / 1440) + 1) + '  ' + E.U.clockStr(s.time); }
};

/* ==== src/town/TownLogic.js ==== */
/* Town simulation: daily taxes, recruits, training, random & timed events, quests. */
E.Town = {
  taxPerDay() { const s = E.G.s; return 40 + s.fortress.level * 35 + s.heroes.length * 6; },
  maxRoster() { return 6 + E.G.s.fortress.level * 2; },
  trainSlots() { return Math.min(3, 1 + Math.floor(E.G.s.fortress.level / 2)); },
  onNewDay(day) {
    const s = E.G.s;
    s.fortress.taxPending = Math.min(this.taxPerDay() * 7, s.fortress.taxPending + this.taxPerDay());
    this.refreshRecruits();
    E.bus && E.bus.emit('newday', day);
  },
  collectTax() { const s = E.G.s, n = s.fortress.taxPending; s.fortress.taxPending = 0; E.Inv.addGold(n); return n; },
  /* Candidates change every day. The first batch is guaranteed to include the missing classes. */
  refreshRecruits(first) {
    const s = E.G.s, day = E.G.day();
    if (!first && s.recruits.day === day) return;
    const avg = s.heroes.length ? Math.round(s.heroes.reduce((a, h) => a + h.level, 0) / s.heroes.length) : 1;
    const list = [];
    const owned = new Set(s.heroes.map(h => h.cls));
    const missing = E.CLASS_ORDER.filter(c => !owned.has(c));
    const pickCls = i => (first ? ['mage', 'archer', 'cleric'][i] : (missing[i] || E.U.pick(E.CLASS_ORDER)));
    for (let i = 0; i < 3; i++) {
      const cls = pickCls(i), level = first ? 1 : Math.max(1, avg + E.U.randInt(-2, 1));
      list.push({ id: E.U.uid(), cls, name: E.U.pick(E.NAMES[cls]), level, cost: Math.round(100 + level * level * 6 + level * 25) });
    }
    s.recruits = { day, list };
  },
  recruit(c) {
    const s = E.G.s;
    if (s.heroes.length >= this.maxRoster()) return { ok: false, why: 'Barracks full — upgrade the Bastion' };
    if (s.gold < c.cost) return { ok: false, why: 'Not enough gold' };
    E.Inv.spendGold(c.cost);
    const h = E.Hero.create(c.cls, c.name, c.level); s.heroes.push(h);
    s.recruits.list = s.recruits.list.filter(x => x.id !== c.id);
    if (s.party.length < E.MAX_PARTY) { s.party.push(h.id); }
    E.Form.sanitize(s);
    return { ok: true, hero: h };
  },
  /* Training Ground */
  trainRate(h) { return 10 + h.level * 4; }, // xp per game hour
  trainCost(h) { return 25 * h.level; },
  startTraining(h) {
    const s = E.G.s;
    if (s.training.length >= this.trainSlots()) return { ok: false, why: 'All training slots busy' };
    if (s.training.some(t => t.heroId === h.id)) return { ok: false, why: 'Already training' };
    if (h.level >= E.MAX_LEVEL) return { ok: false, why: 'Max level' };
    if (!E.Inv.spendGold(this.trainCost(h))) return { ok: false, why: 'Not enough gold' };
    s.training.push({ heroId: h.id, start: s.time }); return { ok: true };
  },
  trainingXp(t) { const h = E.G.hero(t.heroId); const hrs = Math.min(24, (E.G.s.time - t.start) / 60); return h ? Math.floor(hrs * this.trainRate(h)) : 0; },
  collectTraining(t) {
    const s = E.G.s, h = E.G.hero(t.heroId), xp = this.trainingXp(t);
    s.training = s.training.filter(x => x !== t);
    const lv = h ? E.Hero.addXp(h, xp) : 0; return { hero: h, xp, levels: lv };
  },
  trainingReady() { return E.G.s.training.some(t => this.trainingXp(t) >= 40); },
  /* Fortress upgrade (Command Hall) */
  upgradeCost() { const l = E.G.s.fortress.level; return { gold: 500 * l * l, mats: { iron: 10 * l, wood: 8 * l } }; },
  upgradeFortress() {
    const s = E.G.s, c = this.upgradeCost();
    if (s.fortress.level >= 5) return { ok: false, why: 'Bastion fully restored' };
    if (s.gold < c.gold) return { ok: false, why: 'Not enough gold' };
    if (!E.Inv.hasMats(c.mats)) return { ok: false, why: 'Missing materials' };
    E.Inv.spendGold(c.gold); E.Inv.spendMats(c.mats); s.fortress.level++; return { ok: true };
  },
  /* Events: called each town tick. Returns an event def when one should fire. */
  pollEvent() {
    const s = E.G.s, day = E.G.day(), h = E.Clock.hour();
    // timed: Blood Moon every 5th night at 21:00
    if (day % 5 === 0 && h >= 21 && s.events.lastRaidDay !== day) {
      s.events.lastRaidDay = day; return E.EVENTS.find(e => e.id === 'raid');
    }
    if (s.time >= s.events.next) {
      s.events.next = s.time + E.U.randInt(18, 36) * 60;
      const pool = E.EVENTS.filter(e => !e.special), tot = pool.reduce((a, e) => a + e.weight, 0);
      let r = Math.random() * tot; for (const e of pool) { r -= e.weight; if (r <= 0) return e; }
      return pool[0];
    }
    return null;
  },
  /* Quests */
  questState(q) { const s = E.G.s; return s.claimed.includes(q.id) ? 'claimed' : q.check(s) ? 'ready' : 'active'; },
  claimQuest(q) {
    const s = E.G.s; if (this.questState(q) !== 'ready') return false;
    s.claimed.push(q.id);
    if (q.reward.gold) E.Inv.addGold(q.reward.gold);
    for (const m in (q.reward.mats || {})) E.Inv.addMat(m, q.reward.mats[m]);
    return true;
  },
  currentQuest() { return E.QUESTS.find(q => this.questState(q) !== 'claimed'); },
  readyQuests() { return E.QUESTS.filter(q => this.questState(q) === 'ready').length; }
};

/* ==== src/dungeon/DungeonRun.js ==== */
/* Builds enemy line-ups and resolves rewards for a dungeon stage. */
E.Run = {
  scale(base, power, stageIdx) {
    const m = 1 + stageIdx * 0.08;
    return { hp: Math.round(base.hp * Math.pow(power, 0.98) * 2.6 * m * (base.shape === 'boss' ? 1.5 : 1)), atk: Math.round(base.atk * Math.pow(power, 1.0) * 2.6 * m), def: Math.round(base.def * Math.pow(power, 0.8)), spd: base.spd, range: base.range, cd: base.cd, crit: 0.05 };
  },
  buildEnemies(d, idx) {
    const st = d.stages[idx], out = [];
    for (const [k, n] of st.waves) {
      const b = E.ENEMIES[k];
      for (let i = 0; i < n; i++) out.push({ kind: k, name: d.names[k], shape: b.shape, pal: d.pal, scale: b.scale, elite: !!b.elite, ranged: b.ranged, proj: b.proj, healer: b.healer, radius: 20 * (b.scale / 3) + 6, stats: this.scale(b, d.power, idx) });
    }
    if (st.boss) {
      const b = E.BOSS_BASE;
      out.unshift({ kind: 'boss', boss: true, name: d.boss.name, bossAtk: d.boss.atk, shape: 'boss', pal: d.pal, scale: b.scale, elite: true, ranged: false, radius: b.radius, stats: this.scale(b, d.power, 0) });
    }
    return out;
  },
  /* Roll rewards for a victory; also applies them to state. Returns a summary. */
  victory(d, idx) {
    const s = E.G.s, mult = E.Dungeons.stageMult[idx] || 1, isBoss = !!d.stages[idx].boss;
    const out = { gold: 0, xp: 0, mats: {}, gear: [], levelUps: [], firstClear: false, bossFirst: false };
    out.gold = Math.round(E.U.rand(d.gold[0], d.gold[1]) * mult);
    out.xp = Math.round(d.xp * mult);
    for (const m in d.mats) { const n = Math.round(E.U.randInt(d.mats[m][0], d.mats[m][1]) * (0.7 + mult * 0.4)); if (n > 0) out.mats[m] = n; }
    E.Inv.addGold(out.gold); for (const m in out.mats) E.Inv.addMat(m, out.mats[m]);
    // gear drops: bosses always, elite stage 40%, others 10%
    const chance = isBoss ? 1 : idx === 2 ? 0.4 : 0.1;
    if (d.id !== 'raid' && Math.random() < chance && s.gear.length < E.Inv.capacity()) {
      const tier = Math.min(E.TIERS.length - 1, d.gearTier + (isBoss && Math.random() < 0.3 ? 1 : 0));
      out.gear.push(E.Inv.addGear(E.Items.random(tier)));
    }
    if (d.id !== 'raid') {
      const c = s.cleared[d.id] = s.cleared[d.id] || { stages: 0, boss: false, clears: 0 };
      if (idx + 1 > c.stages) { c.stages = idx + 1; out.firstClear = true; }
      c.clears++; if (isBoss && !c.boss) { c.boss = true; out.bossFirst = true; }
      s.stats.battlesWon++;
    } else s.stats.raids++;
    return out;
  }
};

/* ==== src/save/SaveSystem.js ==== */
/* Manual saves only (IndexedDB). No autosave anywhere in the code base. */
E.Save = {
  DB: 'eldoria-saves', STORE: 'slots', _db: null, mem: {}, // mem = fallback if IndexedDB is unavailable
  open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((res, rej) => {
      try {
        const rq = indexedDB.open(this.DB, 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore(this.STORE);
        rq.onsuccess = () => { this._db = rq.result; res(this._db); };
        rq.onerror = () => rej(rq.error);
      } catch (e) { rej(e); }
    });
  },
  _tx(mode, fn) {
    return this.open().then(db => new Promise((res, rej) => {
      const tx = db.transaction(this.STORE, mode), st = tx.objectStore(this.STORE), rq = fn(st);
      tx.oncomplete = () => res(rq && rq.result); tx.onerror = () => rej(tx.error);
    })).catch(() => fn === null ? null : this._fallback(mode, fn));
  },
  _fallback() { return Promise.resolve(null); },
  async list() {
    const out = [];
    for (let i = 0; i < E.SAVE_SLOTS; i++) out.push(await this.get(i));
    return out;
  },
  async get(i) {
    try { const r = await this._tx('readonly', st => st.get('slot' + i)); return r || this.mem['slot' + i] || null; }
    catch (e) { return this.mem['slot' + i] || null; }
  },
  meta(s) {
    const lead = s.party.map(id => s.heroes.find(h => h.id === id)).filter(Boolean);
    return {
      savedAt: Date.now(), day: Math.floor(s.time / 1440) + 1, gold: s.gold, heroes: s.heroes.length,
      maxLevel: Math.max(...s.heroes.map(h => h.level)), party: lead.map(h => h.cls),
      progress: Object.values(s.cleared).filter(c => c.boss).length
    };
  },
  async write(i) {
    const rec = { meta: this.meta(E.G.s), data: E.G.serialize() };
    this.mem['slot' + i] = rec;
    try { await this._tx('readwrite', st => st.put(rec, 'slot' + i)); } catch (e) { }
    return rec;
  },
  async load(i) { const r = await this.get(i); if (!r) return false; E.G.load(r.data); return true; },
  async remove(i) { delete this.mem['slot' + i]; try { await this._tx('readwrite', st => st.delete('slot' + i)); } catch (e) { } },
  async latest() {
    const l = await this.list(); let best = -1, t = 0;
    l.forEach((r, i) => { if (r && r.meta.savedAt > t) { t = r.meta.savedAt; best = i; } });
    return best;
  }
};

/* ==== src/assets/PixelGen.js ==== */
/* Procedural pixel-art toolkit. All art in /assets is PLACEHOLDER art generated in code,
   structured as frame sheets so real art can replace it (see README). */
E.FRAMES = ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'atk0', 'atk1', 'atk2', 'hurt', 'dead'];

E.PG = {
  canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; },
  css(n) { return typeof n === 'string' ? n : '#' + n.toString(16).padStart(6, '0'); },
  /* Brighten (f>1) or darken (f<1) a css/int colour. */
  sh(col, f) {
    const n = typeof col === 'string' ? parseInt(col.slice(1), 16) : col;
    const r = Math.min(255, (n >> 16 & 255) * f), g = Math.min(255, (n >> 8 & 255) * f), b = Math.min(255, (n & 255) * f);
    return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  },
  /* Returns a rect-draw function bound to ctx with optional x/y offset. */
  pen(ctx, ox = 0, oy = 0) {
    return (x, y, w, h, c) => { ctx.fillStyle = this.css(c); ctx.fillRect(Math.round(x + ox), Math.round(y + oy), w, h); };
  },
  /* Pixel line with square brush. */
  line(P, x0, y0, x1, y1, w, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy;
    for (let i = 0; i < 200; i++) {
      P(x0, y0, w, w, c); if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; }
    }
  },
  /* 1px dark outline around opaque pixels inside a rectangle of the canvas. */
  outline(ctx, x, y, w, h, col = '#0a0a18') {
    const id = ctx.getImageData(x, y, w, h), d = id.data, out = new Uint8ClampedArray(d);
    const n = parseInt(col.slice(1), 16), R = n >> 16 & 255, G = n >> 8 & 255, B = n & 255;
    const a = (i, j) => (i < 0 || j < 0 || i >= w || j >= h) ? 0 : d[(j * w + i) * 4 + 3];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (a(i, j) > 20) continue;
      if (a(i - 1, j) > 20 || a(i + 1, j) > 20 || a(i, j - 1) > 20 || a(i, j + 1) > 20) { const k = (j * w + i) * 4; out[k] = R; out[k + 1] = G; out[k + 2] = B; out[k + 3] = 255; }
    }
    id.data.set(out); ctx.putImageData(id, x, y);
  },
  /* Register a canvas as a texture with NEAREST filtering. frames: array of names laid out in a row. */
  register(scene, key, canvas, frames, fw, fh) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const tex = scene.textures.addCanvas(key, canvas);
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    if (frames) frames.forEach((n, i) => tex.add(n, 0, i * fw, 0, fw, fh));
    return tex;
  },
  /* Build an 11-frame character sheet. draw(P, state) paints one frame on a fw x fh cell. */
  sheet(scene, key, fw, fh, draw) {
    const [c, ctx] = this.canvas(fw * E.FRAMES.length, fh);
    const states = {
      idle0: { b: 0, ph: -1, atk: -1 }, idle1: { b: 1, ph: -1, atk: -1 },
      walk0: { b: 0, ph: 0, atk: -1 }, walk1: { b: 1, ph: 1, atk: -1 }, walk2: { b: 0, ph: 2, atk: -1 }, walk3: { b: 1, ph: 3, atk: -1 },
      atk0: { b: 0, ph: -1, atk: 0 }, atk1: { b: 0, ph: -1, atk: 1 }, atk2: { b: 0, ph: -1, atk: 2 }, hurt: { b: 0, ph: -1, atk: -1, hurt: true }
    };
    const cells = {};
    E.FRAMES.forEach((name, i) => {
      if (name === 'dead') return;
      draw(this.pen(ctx, i * fw, 0), states[name], fw, fh);
      this.outline(ctx, i * fw, 0, fw, fh);
      cells[name] = i;
    });
    // dead: idle frame rotated to lie on the ground, darkened
    const di = E.FRAMES.indexOf('dead'), [tc, tx] = this.canvas(fw, fh);
    tx.drawImage(c, 0, 0, fw, fh, 0, 0, fw, fh);
    ctx.save(); ctx.translate(di * fw + fw / 2, fh - fw / 2 + 2); ctx.rotate(Math.PI / 2); ctx.globalAlpha = 0.85;
    ctx.drawImage(tc, -fw / 2, -fh / 2 - 2); ctx.restore();
    ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(10,8,20,0.45)'; ctx.fillRect(di * fw, 0, fw, fh); ctx.globalCompositeOperation = 'source-over';
    return this.register(scene, key, c, E.FRAMES, fw, fh);
  },
  /* radial glow texture */
  glow(scene, key, size, rgb) {
    const [c, x] = this.canvas(size, size), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, `rgba(${rgb},0.95)`); g.addColorStop(0.35, `rgba(${rgb},0.4)`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, c);
  }
};

/* ==== src/assets/HeroSprites.js ==== */
/* Placeholder hero sprites: 32x32 cells, 11 frames each, drawn procedurally. Faces right. */
E.HeroSprites = {
  build(scene) {
    const PG = E.PG;
    for (const cls of E.CLASS_ORDER) {
      PG.sheet(scene, 'hero_' + cls, 32, 32, (P, st) => this['draw_' + cls](P, st));
      // portrait: head crop of idle0 scaled 4x
      const src = scene.textures.get('hero_' + cls).getSourceImage();
      const [pc, px] = PG.canvas(64, 64); px.drawImage(src, 6, 0, 20, 20, 0, 0, 64, 64);
      // draw crop slightly larger by scaling 20->64 (nearest)
      PG.register(scene, 'port_' + cls, pc);
    }
  },
  /* ---- shared body parts ---- */
  base(P, st, o) {
    const b = st.b, hurt = st.hurt, ox = hurt ? -2 : 0;
    const Q = (x, y, w, h, c) => P(x + ox, y, w, h, c);
    // legs
    const lx = [0, 1, 0, -1][Math.max(0, st.ph)] , lift = [0, 1, 0, 0][Math.max(0, st.ph)], rl = [0, 0, 0, 1][Math.max(0, st.ph)];
    if (!o.robe) {
      Q(12 - lx * (st.ph >= 0 ? 1 : 0), 23 - lift, 3, 6 + lift, o.pants); Q(17 + lx * (st.ph >= 0 ? 1 : 0), 23 - rl, 3, 6 + rl, E.PG.sh(o.pants, 0.8));
      Q(11 - lx * (st.ph >= 0 ? 1 : 0), 28 - lift, 5, 2, o.boots); Q(17 + lx * (st.ph >= 0 ? 1 : 0), 28 - rl, 5, 2, E.PG.sh(o.boots, 0.85));
    } else {
      Q(11, 26 + (st.ph === 1 || st.ph === 3 ? -1 : 0), 4, 3, o.boots); Q(17, 26 + (st.ph === 0 || st.ph === 2 ? -1 : 0), 4, 3, o.boots);
    }
    return { Q, b };
  },
  torso(Q, b, o, wide) {
    const x = wide ? 10 : 11, w = wide ? 12 : 10, S = E.PG.sh;
    const bot = o.robe ? 26 : 23;
    Q(x, 14 + b, w, bot - 14 - b + (o.robe ? 0 : 0), o.tunic);
    Q(x, 14 + b, w, 2, S(o.tunic, 1.25));              // shoulder light
    Q(x + w - 2, 16 + b, 2, bot - 16 - b, S(o.tunic, 0.7)); // shade side
    if (!o.robe) Q(x, 21 + b, w, 2, o.belt);
    if (o.robe) { Q(x - 1, 22, w + 2, 5, o.tunic); Q(x - 1, 25, w + 2, 2, S(o.tunic, 0.75)); Q(x + 4, 16 + b, 2, 10, o.trim || S(o.tunic, 1.3)); }
  },
  head(Q, b, o) {
    const S = E.PG.sh;
    Q(12, 5 + b, 8, 8, o.skin); Q(12, 11 + b, 8, 2, S(o.skin, 0.85));
    Q(16, 9 + b, 1, 2, '#0b0b14'); Q(19, 9 + b, 1, 2, '#0b0b14');
    if (o.hurt) { Q(16, 9 + b, 1, 1, o.skin); Q(19, 9 + b, 1, 1, o.skin); Q(16, 10 + b, 1, 1, '#0b0b14'); }
  },
  arm(Q, b, o, front, ex) {
    const S = E.PG.sh; const x = front ? 20 : 9;
    Q(x + (ex || 0), 15 + b, 3, 6, front ? o.tunic : S(o.tunic, 0.8)); Q(x + (ex || 0), 21 + b, 3, 2, o.skin);
  },
  /* ---------- WARRIOR (the prince) ---------- */
  draw_warrior(P, st) {
    const o = { skin: '#e8b890', pants: '#2a2f45', boots: '#3a2a22', tunic: '#454c66', belt: '#8a6a2a', hair: '#2a1a14', hurt: st.hurt };
    const { Q, b } = this.base(P, st, o), S = E.PG.sh, fl = st.ph >= 0 ? (st.ph % 2) : 0;
    // cape (behind)
    Q(8 - fl, 14 + b, 4, 12 + fl, '#a02a2a'); Q(7 - fl, 18 + b, 2, 9 + fl, '#7a1d1d'); Q(9, 14 + b, 2, 3, '#c0392b');
    this.torso(Q, b, o); Q(11, 14 + b, 10, 2, '#c0392b'); // red scarf
    this.arm(Q, b, o, false); this.head(Q, b, o);
    Q(11, 4 + b, 9, 3, o.hair); Q(10, 6 + b, 3, 6, o.hair); Q(14, 2 + b, 2, 3, o.hair); Q(17, 3 + b, 2, 2, o.hair); // spiky hair
    Q(20, 14 + b, 4, 3, '#9aa3b8'); Q(20, 14 + b, 4, 1, '#d5dbe8'); // pauldron
    // front arm + sword
    const a = st.atk, hx = 22, hy = 21 + b;
    if (a === 0) { this.arm(Q, b, o, true, -1); E.PG.line(Q, 21, 19, 15, 6, 2, '#cfd5e6'); Q(19, 18, 4, 2, '#d4a84a'); }
    else if (a === 1) { this.arm(Q, b, o, true, 3); E.PG.line(Q, 25, 20, 31, 20, 2, '#e8edf8'); Q(24, 18, 2, 5, '#d4a84a'); Q(26, 19, 5, 1, '#fff'); }
    else if (a === 2) { this.arm(Q, b, o, true, 2); E.PG.line(Q, 24, 22, 29, 28, 2, '#cfd5e6'); Q(23, 21, 4, 2, '#d4a84a'); }
    else { this.arm(Q, b, o, true); Q(hx, hy - 12, 2, 12, '#cfd5e6'); Q(hx, hy - 12, 1, 12, '#fff'); Q(hx - 2, hy - 1, 6, 2, '#d4a84a'); Q(hx, hy + 1, 2, 2, '#5a3a22'); }
  },
  /* ---------- GUARDIAN ---------- */
  draw_guardian(P, st) {
    const o = { skin: '#d9a47e', pants: '#2b3a45', boots: '#262c34', tunic: '#7c8aa0', belt: '#5a4a2a', hurt: st.hurt };
    const { Q, b } = this.base(P, st, o), S = E.PG.sh, a = st.atk;
    this.torso(Q, b, o, true); Q(13, 15 + b, 6, 8, '#2f7f7b'); Q(15, 16 + b, 2, 6, '#d4a84a'); // teal tabard
    this.arm(Q, b, o, false);
    // full helm
    Q(11, 4 + b, 10, 9, '#9aa6bc'); Q(11, 4 + b, 10, 2, '#d3dbea'); Q(11, 11 + b, 10, 2, '#6e7a90');
    Q(15, 8 + b, 6, 2, '#0b0b14'); Q(14, 8 + b, 1, 2, '#6e7a90'); // visor slit
    Q(15, 1 + b, 3, 4, '#2f9f9a'); Q(14, 2 + b, 2, 3, '#1f6f6b'); // plume
    Q(20, 13 + b, 4, 4, '#b4bfd2'); // pauldron
    const sx = a === 1 ? 4 : a === 0 ? -1 : a === 2 ? 2 : 0;
    // kite shield
    const X = 21 + sx;
    Q(X, 13 + b, 8, 12, '#2f7f7b'); Q(X, 13 + b, 8, 2, '#4fc1bb'); Q(X + 1, 24 + b, 6, 2, '#2f7f7b'); Q(X + 2, 26 + b, 4, 1, '#1f5f5b');
    Q(X, 13 + b, 1, 12, '#d4a84a'); Q(X + 7, 13 + b, 1, 12, '#d4a84a'); Q(X + 3, 17 + b, 2, 4, '#d4a84a'); Q(X + 2, 18 + b, 4, 2, '#f2d98a');
  },
  /* ---------- MAGE ---------- */
  draw_mage(P, st) {
    const o = { skin: '#e4b896', pants: '#2a2050', boots: '#2a1d40', tunic: '#5a2db0', trim: '#d4a84a', robe: true, hurt: st.hurt };
    const { Q, b } = this.base(P, st, o), a = st.atk;
    Q(10, 12 + b, 4, 12, '#d8d8ee'); // long silver hair
    this.torso(Q, b, o); this.arm(Q, b, o, false); this.head(Q, b, o);
    Q(11, 5 + b, 9, 2, '#d8d8ee'); Q(11, 7 + b, 2, 5, '#d8d8ee');
    // pointed hat
    Q(9, 5 + b, 14, 2, '#3a1d7a'); Q(11, 3 + b, 9, 2, '#4a25a0'); Q(13, 1 + b, 6, 2, '#4a25a0'); Q(15, 0 + b, 3, 1, '#4a25a0'); Q(11, 4 + b, 9, 1, '#d4a84a');
    this.arm(Q, b, o, true, a === 1 ? 2 : 0);
    // staff + orb
    const sx = 23 + (a === 1 ? 3 : 0), top = a === 0 ? 2 : 4;
    Q(sx, top + 3, 2, 26 - top, '#6a4a2a'); Q(sx - 1, top + 3, 4, 1, '#d4a84a');
    const gl = a === 1 ? '#f0d8ff' : '#c49bff';
    Q(sx - 1, top - 1, 4, 4, '#8a4be8'); Q(sx, top, 2, 2, gl);
    if (a === 1) { Q(sx - 3, top + 1, 1, 1, gl); Q(sx + 4, top + 1, 1, 1, gl); Q(sx + 1, top - 3, 1, 1, gl); }
    if (a === 0) { Q(sx - 2, top - 2, 1, 1, '#c49bff'); Q(sx + 3, top - 2, 1, 1, '#c49bff'); }
  },
  /* ---------- ARCHER ---------- */
  draw_archer(P, st) {
    const o = { skin: '#e0b08a', pants: '#3a2f22', boots: '#2a2018', tunic: '#5a7a3a', belt: '#4a3a22', hurt: st.hurt };
    const { Q, b } = this.base(P, st, o), a = st.atk;
    Q(8, 13 + b, 4, 10, '#6a4a2a'); Q(8, 11 + b, 1, 3, '#e8e0c0'); Q(10, 11 + b, 1, 3, '#e8e0c0'); // quiver + fletching
    this.torso(Q, b, o); Q(11, 16 + b, 10, 1, '#8a6a3a'); this.arm(Q, b, o, false);
    this.head(Q, b, o);
    // green hood
    Q(11, 3 + b, 10, 4, '#3f8f3f'); Q(10, 5 + b, 3, 8, '#2f6f2f'); Q(13, 2 + b, 5, 2, '#4faf4f'); Q(11, 6 + b, 2, 1, '#2f6f2f');
    this.arm(Q, b, o, true, a === 0 ? 2 : 1);
    // bow
    const bx = 23 + (a === 0 ? 1 : 0), PG = E.PG;
    [[0, 7], [1, 9], [2, 12], [2, 16], [2, 20], [1, 23], [0, 25]].forEach(([dx, y]) => Q(bx + dx, y + b, 2, 3, '#7a4a22'));
    const sxs = a === 0 ? bx - 4 : bx;
    PG.line(Q, bx, 8 + b, sxs, 17 + b, 1, '#e8e0c0'); PG.line(Q, sxs, 17 + b, bx, 26 + b, 1, '#e8e0c0');
    if (a === 0) { Q(sxs, 17 + b, 10, 1, '#cfd5e6'); Q(sxs - 1, 16 + b, 2, 3, '#e8e0c0'); }
    if (a === 1) { Q(bx + 2, 17 + b, 8, 1, '#cfd5e6'); Q(bx + 10, 16 + b, 2, 3, '#cfd5e6'); }
  },
  /* ---------- CLERIC ---------- */
  draw_cleric(P, st) {
    const o = { skin: '#efc4a0', pants: '#d8d0b8', boots: '#8a6a3a', tunic: '#e8e0cc', trim: '#d4a84a', robe: true, hurt: st.hurt };
    const { Q, b } = this.base(P, st, o), a = st.atk;
    this.torso(Q, b, o); Q(11, 22, 10, 1, '#d4a84a'); Q(15, 14 + b, 2, 3, '#d4a84a');
    this.arm(Q, b, o, false); this.head(Q, b, o);
    Q(11, 4 + b, 9, 3, '#e8c860'); Q(10, 5 + b, 3, 8, '#e8c860'); // blond hair
    // white hood
    Q(10, 3 + b, 11, 3, '#f4f0e0'); Q(9, 5 + b, 3, 9, '#d8d0b8'); Q(12, 2 + b, 6, 2, '#fff'); Q(10, 3 + b, 11, 1, '#d4a84a');
    const hx = 22, sw = a === 1 ? 3 : 0, up = a === 0 ? -4 : 0;
    this.arm(Q, b, o, true, a === 1 ? 2 : 0);
    // mace with holy head
    Q(hx + sw, 8 + b + up, 2, 16, '#7a5a32');
    Q(hx - 1 + sw, 5 + b + up, 4, 4, '#d4a84a'); Q(hx + sw, 3 + b + up, 2, 8, '#f2d98a'); Q(hx - 2 + sw, 6 + b + up, 6, 2, '#f2d98a');
    if (a === 1) { Q(hx - 4 + sw, 4 + b, 1, 1, '#fff6c0'); Q(hx + 5 + sw, 4 + b, 1, 1, '#fff6c0'); Q(hx + 1 + sw, 0, 1, 2, '#fff6c0'); }
  }
};

/* ==== src/assets/MonsterSprites.js ==== */
/* Placeholder monster sprites. 5 archetypes + boss, each re-coloured per region palette. */
E.PALS = {
  forest:  { body: '#5b4636', dark: '#2d2118', light: '#8a6a4c', accent: '#5da34a', glow: '#b36bff', bone: '#d8d2bd', fur: '#3a3a48' },
  frost:   { body: '#6f8fb0', dark: '#2c3e5a', light: '#c6e3ff', accent: '#8cc4ff', glow: '#7fe8ff', bone: '#e8f4ff', fur: '#9fb7cf' },
  ash:     { body: '#4a2f2a', dark: '#1d1210', light: '#7a4a3a', accent: '#ff7a2a', glow: '#ffb02a', bone: '#c9b8a8', fur: '#3b2420' },
  abyss:   { body: '#2a1f4a', dark: '#0e0a1f', light: '#5a3f9a', accent: '#c43dff', glow: '#ff4dd2', bone: '#b9a8d8', fur: '#241a3f' },
  capital: { body: '#5a4a2e', dark: '#1c1608', light: '#a88a45', accent: '#f2d98a', glow: '#fff2b0', bone: '#e8dcc0', fur: '#4a3c24' }
};

E.MonsterSprites = {
  build(scene) {
    for (const pal in E.PALS) {
      const c = E.PALS[pal];
      for (const shape of ['wolf', 'thorn', 'skel', 'knight', 'shaman'])
        E.PG.sheet(scene, `mon_${shape}_${pal}`, 32, 32, (P, st) => this['draw_' + shape](P, st, c));
      E.PG.sheet(scene, `mon_boss_${pal}`, 64, 64, (P, st) => this.draw_boss(P, st, c));
    }
  },
  wolf(P, st, c) { return this.draw_wolf(P, st, c); },
  draw_wolf(P, st, c) {
    const S = E.PG.sh, b = st.b, a = st.atk, ox = st.hurt ? -2 : 0, Q = (x, y, w, h, col) => P(x + ox, y, w, h, col);
    const lunge = a === 1 ? 4 : a === 0 ? -2 : a === 2 ? 2 : 0;
    const ph = st.ph, o1 = ph < 0 ? 0 : [2, 0, -2, 0][ph], o2 = -o1;
    // legs
    Q(8 + o1, 22, 3, 7, S(c.fur, 0.8)); Q(12 + o2, 22, 3, 7, S(c.fur, 0.7)); Q(19 + o2, 22, 3, 7, S(c.fur, 0.8)); Q(22 + o1, 22, 3, 7, c.fur);
    Q(8 + o1, 28, 4, 1, c.dark); Q(12 + o2, 28, 4, 1, c.dark); Q(19 + o2, 28, 4, 1, c.dark); Q(22 + o1, 28, 4, 1, c.dark);
    // tail
    Q(2, 12 + b, 3, 3, c.fur); Q(4, 14 + b, 4, 3, c.fur); Q(1, 10 + b, 2, 3, S(c.fur, 1.3));
    // body
    Q(6 + lunge * 0.5, 14 + b, 18, 9, c.fur); Q(6 + lunge * 0.5, 14 + b, 18, 2, S(c.fur, 1.3)); Q(6 + lunge * 0.5, 21 + b, 18, 2, S(c.fur, 0.7));
    for (let i = 0; i < 5; i++) Q(8 + i * 3 + lunge * 0.5, 11 + b + (i % 2), 2, 4, c.accent); // spikes
    // head
    const hx = 22 + lunge;
    Q(hx, 11 + b, 8, 8, c.fur); Q(hx, 11 + b, 8, 2, S(c.fur, 1.3)); Q(hx + 6, 14 + b, 4, 4, S(c.fur, 0.85)); Q(hx + 9, 14 + b, 1, 2, '#111');
    Q(hx + 1, 8 + b, 2, 4, c.fur); Q(hx + 4, 8 + b, 2, 3, c.fur); Q(hx + 1, 8 + b, 1, 2, c.accent);
    Q(hx + 4, 13 + b, 2, 2, c.glow);
    if (a === 1) { Q(hx + 4, 17 + b, 6, 3, '#2a0a0a'); Q(hx + 5, 17 + b, 1, 2, '#fff'); Q(hx + 8, 17 + b, 1, 2, '#fff'); } else Q(hx + 6, 17 + b, 1, 2, '#fff');
  },
  draw_thorn(P, st, c) {
    const S = E.PG.sh, b = st.b, a = st.atk, ox = st.hurt ? -2 : 0, Q = (x, y, w, h, col) => P(x + ox, y, w, h, col);
    const ph = st.ph, sw = ph < 0 ? 0 : [1, 0, -1, 0][ph];
    // root legs
    Q(10 + sw, 23, 3, 6, S(c.body, 0.8)); Q(18 - sw, 23, 3, 6, S(c.body, 0.8)); Q(8 + sw, 28, 4, 2, c.dark); Q(18 - sw, 28, 5, 2, c.dark);
    // body bulb
    Q(9, 14 + b, 14, 10, c.accent); Q(9, 14 + b, 14, 2, S(c.accent, 1.3)); Q(9, 22 + b, 14, 2, S(c.accent, 0.6)); Q(11, 16 + b, 10, 6, S(c.accent, 0.8));
    // thorns
    for (let i = 0; i < 4; i++) { Q(7, 15 + b + i * 2, 2, 1, c.bone); Q(23, 16 + b + i * 2, 2, 1, c.bone); }
    Q(12, 12 + b, 1, 2, c.bone); Q(19, 12 + b, 1, 2, c.bone);
    // head / maw
    Q(10, 4 + b, 12, 11, S(c.accent, 0.9)); Q(10, 4 + b, 12, 2, S(c.accent, 1.35));
    Q(9, 3 + b, 3, 3, c.glow); Q(20, 3 + b, 3, 3, c.glow); // petals/horns glow
    Q(12, 8 + b, 2, 2, c.glow); Q(18, 8 + b, 2, 2, c.glow);
    Q(12, 11 + b, 8, 4, '#220a18'); for (let i = 0; i < 4; i++) Q(12 + i * 2, 11 + b, 1, 2, '#fff');
    // vine arms
    const ext = a === 1 ? 7 : a === 0 ? -2 : a === 2 ? 3 : 0;
    E.PG.line(Q, 22, 17 + b, 26 + ext, 17 + b + (a === 0 ? -4 : 2), 2, S(c.accent, 0.8)); Q(26 + ext, 15 + b + (a === 0 ? -4 : 2), 2, 4, c.bone);
    E.PG.line(Q, 9, 18 + b, 5, 22 + b, 2, S(c.accent, 0.8));
  },
  draw_skel(P, st, c) {
    const S = E.PG.sh, b = st.b, a = st.atk, ox = st.hurt ? -2 : 0, Q = (x, y, w, h, col) => P(x + ox, y, w, h, col);
    const ph = st.ph, o1 = ph < 0 ? 0 : [1, 0, -1, 0][ph];
    Q(8, 14 + b, 4, 13, S(c.dark, 1.4)); Q(7, 20 + b, 4, 8, c.dark); // tattered cloak
    Q(12 + o1, 23, 2, 6, c.bone); Q(18 - o1, 23, 2, 6, S(c.bone, 0.8)); Q(11 + o1, 28, 4, 1, c.bone); Q(18 - o1, 28, 4, 1, c.bone);
    Q(15, 14 + b, 2, 9, c.bone); for (let i = 0; i < 3; i++) Q(12, 15 + b + i * 2, 8, 1, c.bone); Q(13, 21 + b, 6, 2, S(c.bone, 0.8)); // spine + ribs
    Q(12, 5 + b, 8, 8, c.bone); Q(12, 5 + b, 8, 2, S(c.bone, 1.1)); Q(14, 9 + b, 2, 2, '#0b0b14'); Q(18, 9 + b, 2, 2, '#0b0b14'); Q(14, 9 + b, 1, 1, c.glow); Q(18, 9 + b, 1, 1, c.glow);
    Q(13, 12 + b, 6, 1, S(c.bone, 0.7)); Q(11, 4 + b, 10, 3, c.dark); Q(10, 6 + b, 3, 6, c.dark); // hood
    Q(20, 15 + b, 2, 7, c.bone);
    const bx = 23 + (a === 0 ? 1 : 0);
    [[0, 8], [1, 10], [2, 13], [2, 17], [2, 21], [1, 24]].forEach(([dx, y]) => Q(bx + dx, y + b, 2, 3, c.body));
    const sx = a === 0 ? bx - 4 : bx;
    E.PG.line(Q, bx, 9 + b, sx, 18 + b, 1, c.bone); E.PG.line(Q, sx, 18 + b, bx, 26 + b, 1, c.bone);
    if (a === 0) Q(sx, 18 + b, 9, 1, c.glow); if (a === 1) { Q(bx + 2, 18 + b, 8, 1, c.glow); Q(bx + 10, 17 + b, 2, 3, c.glow); }
  },
  draw_knight(P, st, c) {
    const S = E.PG.sh, b = st.b, a = st.atk, ox = st.hurt ? -2 : 0, Q = (x, y, w, h, col) => P(x + ox, y, w, h, col);
    const ph = st.ph, o1 = ph < 0 ? 0 : [1, 0, -1, 0][ph];
    Q(7, 14 + b, 5, 14, c.dark); Q(6, 22 + b, 3, 7, S(c.dark, 0.8)); // cape
    Q(12 + o1, 22, 4, 7, S(c.body, 0.8)); Q(17 - o1, 22, 4, 7, S(c.body, 0.7)); Q(11 + o1, 27, 6, 3, c.dark); Q(17 - o1, 27, 6, 3, c.dark);
    Q(10, 13 + b, 13, 10, c.body); Q(10, 13 + b, 13, 2, c.light); Q(20, 15 + b, 3, 8, S(c.body, 0.6)); Q(10, 21 + b, 13, 2, c.dark); Q(15, 15 + b, 3, 4, c.accent); // glowing core
    Q(8, 12 + b, 5, 5, c.light); Q(20, 12 + b, 5, 5, c.light); Q(8, 12 + b, 5, 1, S(c.light, 1.3)); // pauldrons
    Q(12, 4 + b, 9, 9, c.body); Q(12, 4 + b, 9, 2, c.light); Q(14, 8 + b, 7, 2, '#05050a'); Q(16, 8 + b, 4, 1, c.glow); // helm + slit
    Q(10, 1 + b, 2, 6, c.bone); Q(21, 1 + b, 2, 6, c.bone); Q(9, 0 + b, 2, 2, c.bone); Q(22, 0 + b, 2, 2, c.bone); // horns
    const hx = 23, rise = a === 0 ? -9 : a === 1 ? 4 : a === 2 ? 6 : 0;
    Q(21 + (a === 1 ? 3 : 0), 15 + b, 3, 7, c.body);
    if (a === 1) { Q(24, 19, 8, 3, S(c.bone, 1)); Q(26, 20, 6, 1, '#fff'); Q(24, 17, 2, 7, c.accent); }
    else if (a === 2) { E.PG.line(Q, 24, 21, 30, 28, 3, c.bone); }
    else { Q(hx, 4 + b + rise, 3, 19, c.bone); Q(hx, 4 + b + rise, 1, 19, '#fff'); Q(hx - 2, 22 + b + (a === 0 ? -6 : 0), 7, 2, c.accent); }
  },
  draw_shaman(P, st, c) {
    const S = E.PG.sh, b = st.b, a = st.atk, ox = st.hurt ? -2 : 0, Q = (x, y, w, h, col) => P(x + ox, y, w, h, col);
    const hov = st.ph >= 0 ? [0, 1, 0, 1][st.ph] : 0;
    // floating robe, ragged hem
    Q(9, 13 + b, 14, 14 - hov, c.dark); Q(9, 13 + b, 14, 2, c.body); Q(10, 22 + b, 12, 2, S(c.dark, 0.7));
    for (let i = 0; i < 6; i++) Q(9 + i * 2 + (i % 2), 26 - hov + b, 2, 2 + (i % 2) , S(c.dark, 0.8));
    Q(14, 14 + b, 2, 11, c.accent); Q(11, 16 + b, 10, 1, c.accent);
    // hood + face
    Q(11, 3 + b, 10, 10, c.dark); Q(11, 3 + b, 10, 2, c.body); Q(13, 7 + b, 7, 5, '#05050a');
    Q(14, 8 + b, 2, 2, c.glow); Q(18, 8 + b, 2, 2, c.glow);
    // arms + skull staff
    Q(20, 15 + b, 3, 6, c.dark); Q(20, 20 + b, 3, 2, c.bone);
    const sx = 24 + (a === 1 ? 3 : 0), top = a === 0 ? 0 : 3;
    Q(sx, top + 4, 2, 24 - top, '#3a2a22'); Q(sx - 2, top, 6, 5, c.bone); Q(sx - 1, top + 2, 1, 1, '#000'); Q(sx + 2, top + 2, 1, 1, '#000');
    Q(sx - 1, top - 3, 4, 3, c.glow); Q(sx, top - 2, 2, 1, '#fff');
    if (a === 1) { Q(sx - 4, top - 1, 1, 1, c.glow); Q(sx + 5, top - 1, 1, 1, c.glow); Q(sx + 1, top - 6, 1, 2, c.glow); }
  },
  /* 64x64 colossus used as every boss (recoloured per region). */
  draw_boss(P, st, c) {
    const S = E.PG.sh, b = st.b, a = st.atk, ox = st.hurt ? -2 : 0, Q = (x, y, w, h, col) => P(x + ox, y, w, h, col);
    const ph = st.ph, o1 = ph < 0 ? 0 : [2, 0, -2, 0][ph];
    // trunk legs
    Q(18 + o1, 44, 10, 18, S(c.body, 0.8)); Q(36 - o1, 44, 10, 18, S(c.body, 0.7)); Q(15 + o1, 59, 15, 4, c.dark); Q(34 - o1, 59, 15, 4, c.dark);
    // torso
    Q(14, 20 + b, 36, 28, c.body); Q(14, 20 + b, 36, 4, c.light); Q(44, 24 + b, 6, 24, S(c.body, 0.65));
    for (let i = 0; i < 6; i++) Q(18 + i * 5, 26 + b + (i % 2) * 4, 1, 14, c.dark); // bark grooves
    Q(26, 28 + b, 12, 12, c.dark); Q(28, 30 + b, 8, 8, c.accent); Q(30, 32 + b, 4, 4, c.glow); // rune core
    // mossy shoulders
    Q(10, 16 + b, 14, 8, c.accent); Q(40, 16 + b, 14, 8, c.accent); Q(10, 16 + b, 14, 2, S(c.accent, 1.3)); Q(40, 16 + b, 14, 2, S(c.accent, 1.3));
    // head
    Q(24, 6 + b, 16, 16, S(c.body, 1.1)); Q(24, 6 + b, 16, 3, c.light); Q(27, 12 + b, 4, 3, c.glow); Q(34, 12 + b, 4, 3, c.glow); Q(28, 18 + b, 9, 2, c.dark);
    // antlers
    [[22, 4, 18, 0], [20, 8, 14, 3], [42, 4, 46, 0], [44, 8, 50, 3]].forEach(([x, y, x2, y2]) => E.PG.line(Q, x, y + b, x2, y2 + b, 2, c.bone));
    Q(18, 0, 2, 4, c.bone); Q(46, 0, 2, 4, c.bone);
    // arms
    const up = a === 0, slam = a === 1, aft = a === 2;
    const ay = up ? -14 : slam ? 12 : aft ? 6 : 0;
    Q(2, 22 + b + (up ? -10 : 0), 12, 26 + ay * 0.6, S(c.body, 0.9)); Q(2, 44 + b + ay, 14, 10, c.dark); Q(4, 50 + b + ay, 2, 5, c.bone); Q(8, 50 + b + ay, 2, 5, c.bone); Q(12, 50 + b + ay, 2, 5, c.bone);
    Q(50, 22 + b + (up ? -10 : 0), 12, 26 + ay * 0.6, S(c.body, 0.8)); Q(48, 44 + b + ay, 14, 10, c.dark); Q(50, 50 + b + ay, 2, 5, c.bone); Q(54, 50 + b + ay, 2, 5, c.bone); Q(58, 50 + b + ay, 2, 5, c.bone);
  }
};

/* ==== src/assets/TownSprites.js ==== */
/* Placeholder environment art: town ground, buildings, battle arenas, world map. */
E.TOWN_POS = { // display coords (1280x720) of each clickable building (centre-bottom)
  command:  { x: 640, y: 300, name: 'Command Hall',     panel: 'Command',    desc: 'Quests, taxes & Bastion upgrades' },
  barracks: { x: 290, y: 330, name: 'Barracks',         panel: 'Barracks',   desc: 'Heroes, skills, equipment & promotion' },
  recruit:  { x: 990, y: 330, name: 'Recruitment Hall', panel: 'Recruit',    desc: 'Hire new heroes' },
  smith:    { x: 330, y: 560, name: 'Blacksmith',       panel: 'Blacksmith', desc: 'Craft & upgrade equipment' },
  training: { x: 640, y: 580, name: 'Training Ground',  panel: 'Training',   desc: 'Heroes gain experience over time' },
  gate:     { x: 970, y: 570, name: 'Expedition Gate',  panel: 'Expedition', desc: 'Enter dungeons, farm resources' }
};

E.TownSprites = {
  build(scene) {
    this.ground(scene);
    this.buildings(scene);
    for (const pal in E.PALS) this.arena(scene, pal);
    this.worldMap(scene);
    E.PG.glow(scene, 'glow_orange', 96, '255,160,60'); E.PG.glow(scene, 'glow_white', 64, '255,240,200');
    E.PG.glow(scene, 'glow_purple', 128, '170,100,255');
  },
  noise(rnd, w, h, scale) { // value noise grid
    const gw = Math.ceil(w / scale) + 2, gh = Math.ceil(h / scale) + 2, g = [];
    for (let i = 0; i < gw * gh; i++) g.push(rnd());
    return (x, y) => {
      const gx = x / scale, gy = y / scale, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
      const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
      return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    };
  },
  tree(P, x, y, s, dark) { // small pixel pine/dead tree, base at (x,y)
    P(x - 1, y - 6 * s, 2 * s, 6 * s, '#2a1d18');
    const g = dark ? ['#16301f', '#1d3d29', '#265235'] : ['#1f4a2e', '#28603a', '#337a48'];
    for (let i = 0; i < 4; i++) { const w = (3 + i * 2) * s; P(x - w / 2, y - (14 - i * 3) * s, w, 3 * s, g[i % 3]); }
    P(x - 1 * s, y - 16 * s, 2 * s, 2 * s, g[2]);
  },
  ground(scene) {
    const W = 640, H = 360, [c, ctx] = E.PG.canvas(W, H), P = E.PG.pen(ctx), rnd = E.U.rng(77), nz = this.noise(rnd, W, H, 18);
    const grass = ['#1c3a33', '#21443a', '#28503f', '#183228'];
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      const n = nz(x, y) + (rnd() - 0.5) * 0.25; P(x, y, 2, 2, grass[Math.min(3, Math.max(0, Math.floor(n * 4)))]);
    }
    for (let i = 0; i < 700; i++) { const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H); P(x, y, 1, 2, rnd() < 0.5 ? '#35684f' : '#102a20'); }
    // cobbled paths between buildings
    const pts = Object.values(E.TOWN_POS).map(b => ({ x: b.x / 2, y: b.y / 2 }));
    const hub = { x: 320, y: 215 };
    const path = (a, b2) => {
      const n = 60; for (let i = 0; i <= n; i++) {
        const t = i / n, x = a.x + (b2.x - a.x) * t, y = a.y + (b2.y - a.y) * t;
        for (let k = 0; k < 9; k++) { const dx = (rnd() - 0.5) * 12, dy = (rnd() - 0.5) * 12; P(x + dx, y + dy, 3, 2, ['#4a4a5e', '#3a3a4c', '#55556a', '#2e2e3e'][Math.floor(rnd() * 4)]); }
      }
    };
    pts.forEach(p => path(hub, p));
    // plaza
    for (let i = 0; i < 160; i++) { const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 34; P(hub.x + Math.cos(a) * r, hub.y + Math.sin(a) * r * 0.6, 4, 3, ['#4a4a5e', '#5c5c72', '#3a3a4c'][Math.floor(rnd() * 3)]); }
    // fountain-like crystal obelisk at hub
    P(hub.x - 4, hub.y - 12, 8, 14, '#2c3870'); P(hub.x - 2, hub.y - 18, 4, 8, '#8a4be8'); P(hub.x - 1, hub.y - 20, 2, 3, '#c49bff'); P(hub.x - 6, hub.y + 2, 12, 3, '#1f2850');
    // ruined wall segments
    const wall = (x, y, w, h) => { P(x, y, w, h, '#3a3a4c'); P(x, y, w, 2, '#5a5a70'); for (let i = 0; i < w; i += 6) P(x + i, y + 3, 5, 1, '#2a2a38'); if (w > 20) P(x + w * 0.4, y - 4, 8, 4, '#3a3a4c'); };
    wall(20, 68, 60, 9); wall(560, 70, 55, 9); wall(10, 330, 80, 9); wall(540, 328, 90, 9); wall(8, 150, 8, 40); wall(626, 140, 8, 50);
    // trees on edges + scatter
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W, y = rnd() * H;
      const edge = x < 36 || x > W - 36 || y < 70 || y > H - 22;
      if (!edge && rnd() < 0.85) continue;
      if (pts.some(p => Math.hypot(p.x - x, p.y - y) < 55) || Math.hypot(hub.x - x, hub.y - y) < 60) continue;
      this.tree(P, x, y, 1 + (rnd() < 0.3 ? 1 : 0), true);
    }
    // purple crystal shards & flowers
    for (let i = 0; i < 26; i++) { const x = rnd() * W, y = 75 + rnd() * 270; if (pts.some(p => Math.hypot(p.x - x, p.y - y) < 40)) continue; P(x, y - 5, 2, 5, '#8a4be8'); P(x - 1, y - 3, 1, 3, '#5b2fb0'); P(x + 2, y - 3, 1, 3, '#c49bff'); }
    E.PG.register(scene, 'town_ground', c);
  },
  /* ---- Buildings. Each is drawn at ~1x then displayed at 2x. ---- */
  buildings(scene) {
    const mk = (key, w, h, fn) => { const [c, ctx] = E.PG.canvas(w, h), P = E.PG.pen(ctx); fn(P, w, h); E.PG.outline(ctx, 0, 0, w, h); E.PG.register(scene, key, c); };
    const S = E.PG.sh;
    const stone = (P, x, y, w, h, base = '#4a4e66') => { P(x, y, w, h, base); P(x, y, w, 2, S(base, 1.35)); P(x + w - 3, y + 2, 3, h - 2, S(base, 0.7)); for (let j = 4; j < h; j += 6) for (let i = (j / 6) % 2 ? 0 : 4; i < w; i += 8) P(x + i, y + j, 6, 1, S(base, 0.75)); };
    const win = (P, x, y, w = 5, h = 7) => { P(x - 1, y - 1, w + 2, h + 2, '#1a1a28'); P(x, y, w, h, '#f2b84a'); P(x, y, w, 2, '#fff0b0'); P(x + w / 2 | 0, y, 1, h, '#8a5a1a'); };
    const roof = (P, x, y, w, h, col) => { for (let i = 0; i < h; i++) { const inset = Math.floor(i * (w / 2 - 3) / h); P(x + inset, y + i, w - inset * 2, 1, i % 3 === 0 ? S(col, 1.25) : col); } P(x + w / 2 - 1, y - 2, 2, 3, '#d4a84a'); };
    const flag = (P, x, y, col) => { P(x, y, 1, 14, '#6a5a3a'); P(x + 1, y + 1, 8, 6, col); P(x + 1, y + 1, 8, 1, S(col, 1.3)); P(x + 7, y + 3, 2, 2, S(col, 0.7)); };
    // Command Hall (keep with 2 towers)
    mk('b_command', 120, 100, (P, w, h) => {
      stone(P, 30, 40, 60, 56, '#4d5273'); roof(P, 24, 18, 72, 24, '#2a2f66');
      stone(P, 6, 30, 26, 66, '#434868'); stone(P, 88, 30, 26, 66, '#434868'); roof(P, 2, 8, 34, 24, '#3b2a8a'); roof(P, 84, 8, 34, 24, '#3b2a8a');
      win(P, 14, 46); win(P, 98, 46); win(P, 40, 52); win(P, 76, 52); P(52, 70, 16, 26, '#1a1220'); P(54, 72, 12, 24, '#3a2418'); P(59, 72, 2, 24, '#d4a84a'); P(55, 66, 10, 4, '#d4a84a');
      flag(P, 58, 0, '#8a4be8'); flag(P, 18, -2 + 4, '#c0392b'); P(40, 36, 40, 4, '#d4a84a');
    });
    mk('b_barracks', 112, 80, (P, w, h) => {
      stone(P, 10, 34, 92, 44, '#454a60'); roof(P, 4, 12, 104, 24, '#2b3a58');
      for (let i = 0; i < 4; i++) win(P, 20 + i * 22, 44); P(46, 58, 20, 20, '#1a1220'); P(48, 60, 16, 18, '#4a2f1d'); P(55, 60, 2, 18, '#b0873a');
      flag(P, 16, 0, '#c0392b'); flag(P, 88, 0, '#c0392b'); P(30, 70, 10, 8, '#6a4a2a'); P(32, 66, 2, 5, '#cfd5e6'); P(36, 66, 2, 5, '#cfd5e6'); // weapon crate
    });
    mk('b_training', 120, 80, (P, w, h) => {
      P(4, 20, 112, 56, '#6a5a44'); for (let i = 0; i < 120; i++) P(6 + (i * 37) % 108, 22 + (i * 17) % 52, 2, 1, i % 2 ? '#7a6a52' : '#54463a');
      for (let i = 0; i < 12; i++) { P(4 + i * 10, 14, 2, 14, '#4a3422'); P(4 + i * 10, 70, 2, 12, '#4a3422'); } P(4, 18, 112, 2, '#5a4430'); P(4, 74, 112, 2, '#5a4430');
      const dummy = x => { P(x + 5, 30, 2, 28, '#5a4430'); P(x, 36, 12, 3, '#5a4430'); P(x + 2, 26, 8, 8, '#c8b078'); P(x + 3, 40, 6, 12, '#b09860'); P(x + 4, 30, 1, 1, '#222'); P(x + 7, 30, 1, 1, '#222'); P(x, 48, 12, 2, '#8a2a2a'); };
      dummy(24); dummy(78); // rack
      P(52, 32, 18, 3, '#4a3422'); P(52, 45, 18, 3, '#4a3422'); for (let i = 0; i < 4; i++) { P(54 + i * 4, 22, 1, 20, '#cfd5e6'); P(53 + i * 4, 38, 3, 2, '#8a6a2a'); }
      flag(P, 100, 4, '#c0392b');
    });
    mk('b_smith', 100, 84, (P, w, h) => {
      stone(P, 10, 34, 76, 46, '#4a4448'); roof(P, 4, 16, 88, 20, '#3a2a30'); stone(P, 68, 10, 14, 34, '#3a3438'); P(70, 6, 10, 6, '#2a2428'); P(72, 2, 6, 5, '#ff7a2a'); P(74, 0, 2, 3, '#ffd080');
      win(P, 20, 44); P(40, 52, 24, 28, '#1a0e0a'); P(42, 56, 20, 22, '#ff7a2a'); P(46, 60, 12, 16, '#ffb02a'); P(50, 66, 4, 10, '#ffe080');
      P(78, 66, 16, 4, '#2a2a34'); P(80, 62, 12, 4, '#5a5a6a'); P(84, 70, 4, 10, '#2a2a34'); P(76, 60, 6, 2, '#5a5a6a'); // anvil
      P(14, 68, 3, 12, '#6a4a2a'); P(12, 66, 7, 3, '#5a5a6a');
    });
    mk('b_recruit', 108, 84, (P, w, h) => {
      P(10, 36, 88, 46, '#5a4030'); for (let i = 0; i < 88; i += 8) P(10 + i, 36, 2, 46, '#3a2820'); P(10, 54, 88, 2, '#3a2820');
      roof(P, 4, 10, 100, 28, '#5a2a6a'); win(P, 22, 44, 7, 8); win(P, 78, 44, 7, 8);
      P(44, 56, 20, 26, '#1a1220'); P(46, 58, 16, 24, '#4a2f1d'); P(52, 58, 2, 24, '#b0873a'); P(48, 52, 12, 4, '#d4a84a');
      P(96, 40, 2, 20, '#4a3422'); P(98, 44, 8, 10, '#2a2f66'); P(100, 46, 4, 4, '#d4a84a'); P(8, 74, 8, 8, '#6a4a2a'); P(10, 72, 4, 3, '#8a6a3a'); // sign + barrel
      flag(P, 52, 0, '#d4a84a');
    });
    mk('b_gate', 120, 100, (P, w, h) => {
      stone(P, 4, 30, 30, 66, '#444862'); stone(P, 86, 30, 30, 66, '#444862'); roof(P, 0, 8, 38, 24, '#2a2548'); roof(P, 82, 8, 38, 24, '#2a2548');
      stone(P, 30, 26, 60, 14, '#4d5273'); for (let i = 0; i < 6; i++) P(32 + i * 10, 22, 6, 5, '#4d5273');
      // portal
      for (let r = 28; r > 0; r -= 3) { const col = ['#2a0f5a', '#4a1f9a', '#6a2fd0', '#8a4be8', '#b78bff', '#e0c8ff'][Math.floor((28 - r) / 5)] || '#fff'; P(60 - r * 0.7, 94 - r * 2.1, r * 1.4, r * 2.1, col); }
      P(36, 40, 48, 56, 'rgba(0,0,0,0)'); P(34, 40, 4, 56, '#3a3e58'); P(82, 40, 4, 56, '#3a3e58');
      P(12, 40, 4, 8, '#8a4be8'); P(104, 40, 4, 8, '#8a4be8'); P(13, 41, 2, 4, '#e0c8ff'); P(105, 41, 2, 4, '#e0c8ff');
      flag(P, 56, 0, '#8a4be8');
    });
  },
  /* ---- Arena floors for each region ---- */
  arena(scene, pal) {
    const W = 640, H = 360, [c, ctx] = E.PG.canvas(W, H), P = E.PG.pen(ctx), seed = { forest: 5, frost: 6, ash: 7, abyss: 8, capital: 9 }[pal], rnd = E.U.rng(seed), nz = this.noise(rnd, W, H, 22);
    const base = { forest: ['#1a2c24', '#203a2e', '#27463a', '#142219'], frost: ['#2a3c58', '#34496a', '#42597d', '#1f2d46'], ash: ['#251614', '#32201c', '#40281f', '#190e0c'], abyss: ['#150f2a', '#1e1540', '#291d58', '#0e0a1e'], capital: ['#2a2430', '#363040', '#443d52', '#1d1822'] }[pal];
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { const n = nz(x, y) + (rnd() - 0.5) * 0.22; P(x, y, 2, 2, base[Math.min(3, Math.max(0, Math.floor(n * 4)))]); }
    const accent = E.PALS[pal];
    if (pal === 'capital') for (let y = 0; y < H; y += 24) for (let x = 0; x < W; x += 24) { P(x, y, 24, 1, '#17131c'); P(x, y, 1, 24, '#17131c'); if (rnd() < 0.15) P(x + 2, y + 2, 20, 20, '#4a4258'); }
    for (let i = 0; i < 90; i++) {
      const x = rnd() * W, y = 40 + rnd() * 300;
      if (pal === 'forest') { P(x, y, 1, 3, '#35684f'); P(x + 1, y + 1, 1, 2, '#102a20'); if (rnd() < 0.2) P(x, y, 3, 2, '#3a3a48'); }
      else if (pal === 'frost') { if (rnd() < 0.6) P(x, y, 2, 1, '#e8f4ff'); else { P(x, y, 2, 4, '#8cc4ff'); P(x + 1, y + 1, 1, 3, '#c6e3ff'); } }
      else if (pal === 'ash') { if (rnd() < 0.5) { P(x, y, 5, 1, '#ff7a2a'); P(x + 2, y + 1, 1, 3, '#ff7a2a'); P(x, y, 5, 1, '#ffb02a'); } else P(x, y, 4, 3, '#5a3a30'); }
      else if (pal === 'abyss') { P(x, y, 1, 4, '#c43dff'); P(x + 1, y + 3, 3, 1, '#ff4dd2'); if (rnd() < 0.3) P(x, y, 3, 3, '#3a2870'); }
      else { P(x, y, 3, 1, '#f2d98a'); if (rnd() < 0.3) P(x, y, 2, 6, '#2a2430'); }
    }
    // distant trees / pillars along the north and south edge, then vignette
    for (let i = 0; i < 26; i++) {
      const x = 8 + i * 25 + rnd() * 10;
      for (const y of [48, 346]) {
        if (pal === 'forest') this.tree(P, x, y + rnd() * 4, 2, true);
        else if (pal === 'frost') { P(x, y - 14, 5, 14, '#8cc4ff'); P(x + 1, y - 18, 3, 5, '#c6e3ff'); }
        else if (pal === 'ash') { P(x, y - 12, 7, 12, '#2a1a16'); P(x + 1, y - 16, 4, 5, '#3a2420'); P(x + 2, y - 10, 2, 8, '#ff7a2a'); }
        else if (pal === 'abyss') { P(x, y - 16, 4, 16, '#3a1f7a'); P(x + 1, y - 22, 2, 7, '#c43dff'); }
        else { P(x, y - 22, 8, 22, '#4a4258'); P(x - 1, y - 24, 10, 3, '#6a6278'); P(x + 1, y - 16, 2, 8, '#2a2430'); }
      }
    }
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(3,3,12,0.7)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    E.PG.register(scene, 'arena_' + pal, c);
  },
  worldMap(scene) {
    const W = 380, H = 220, [c, ctx] = E.PG.canvas(W, H), P = E.PG.pen(ctx), rnd = E.U.rng(1234), nz = this.noise(rnd, W, H, 14);
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) P(x, y, 2, 2, nz(x, y) > 0.55 ? '#13203c' : '#0f1a32');
    const blobs = [[0.14, 0.42, 38], [0.30, 0.62, 52], [0.45, 0.38, 46], [0.62, 0.2, 42], [0.80, 0.55, 46], [0.86, 0.82, 36], [0.6, 0.5, 40], [0.5, 0.65, 30], [0.22, 0.5, 34], [0.7, 0.35, 34]];
    const land = (x, y) => { let v = 0; for (const [bx, by, r] of blobs) { const d = Math.hypot(x - bx * W, (y - by * H) * 1.2); v = Math.max(v, 1 - d / r); } return v + (nz(x, y) - 0.5) * 0.5; };
    const cols = { forest: ['#1f4a2e', '#2a603a'], frost: ['#7aa0c8', '#b8d8f0'], ash: ['#4a2a22', '#6a3a28'], abyss: ['#2a1a50', '#4a2a90'], capital: ['#5a4a30', '#8a7240'] };
    const regs = E.DUNGEONS.map(d => ({ pal: d.pal, x: d.mapPos[0] * W, y: d.mapPos[1] * H }));
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      const l = land(x, y); if (l < 0.18) continue;
      let col = l < 0.26 ? '#a89a70' : l < 0.4 ? '#2c4a34' : '#355a3c', best = 1e9;
      for (const r of regs) { const d = Math.hypot(x - r.x, y - r.y); if (d < 50 && d < best) { best = d; col = cols[r.pal][d < 26 ? 1 : 0]; } }
      P(x, y, 2, 2, col);
    }
    for (let i = 0; i < 300; i++) { const x = rnd() * W, y = rnd() * H; if (land(x, y) > 0.3) P(x, y, 1, 1, 'rgba(255,255,255,0.08)'); }
    // grid lines like an old chart
    ctx.strokeStyle = 'rgba(212,168,74,0.12)'; ctx.lineWidth = 1; for (let i = 0; i < W; i += 38) { ctx.beginPath(); ctx.moveTo(i + .5, 0); ctx.lineTo(i + .5, H); ctx.stroke(); } for (let j = 0; j < H; j += 36) { ctx.beginPath(); ctx.moveTo(0, j + .5); ctx.lineTo(W, j + .5); ctx.stroke(); }
    ctx.strokeStyle = '#d4a84a'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, W - 2, H - 2);
    E.PG.register(scene, 'worldmap', c);
  }
};

/* ==== src/assets/IconSprites.js ==== */
/* 16x16 placeholder icons (equipment, materials, UI, commands). */
E.IconSprites = {
  build(scene) {
    const S = E.PG.sh;
    const mk = (key, fn) => { const [c, ctx] = E.PG.canvas(16, 16), P = E.PG.pen(ctx); fn(P, ctx); E.PG.outline(ctx, 0, 0, 16, 16); E.PG.register(scene, key, c); };
    const gold = '#d4a84a', gl = '#f2d98a';
    // equipment
    mk('i_sword', P => { E.PG.line(P, 3, 12, 12, 3, 2, '#d5dbe8'); E.PG.line(P, 4, 11, 11, 4, 1, '#fff'); P(2, 11, 5, 2, gold); P(1, 13, 3, 2, '#6a4a2a'); });
    mk('i_shield', P => { P(3, 2, 10, 10, '#2f7f7b'); P(4, 12, 8, 2, '#2f7f7b'); P(6, 14, 4, 1, '#1f5f5b'); P(3, 2, 10, 1, gl); P(3, 2, 1, 10, gold); P(12, 2, 1, 10, gold); P(7, 5, 2, 5, gold); });
    mk('i_staff', P => { E.PG.line(P, 4, 14, 11, 5, 2, '#7a5a32'); P(9, 1, 5, 5, '#8a4be8'); P(10, 2, 2, 2, '#e0c8ff'); P(8, 6, 3, 1, gold); });
    mk('i_bow', P => { [[10, 1], [12, 3], [13, 6], [13, 9], [12, 12], [10, 14]].forEach(([x, y]) => P(x, y, 2, 2, '#8a5a2a')); E.PG.line(P, 10, 2, 10, 14, 1, '#e8e0c0'); E.PG.line(P, 3, 8, 12, 8, 1, '#cfd5e6'); P(2, 7, 2, 3, '#e8e0c0'); });
    mk('i_mace', P => { E.PG.line(P, 4, 14, 10, 7, 2, '#7a5a32'); P(8, 1, 6, 6, gold); P(9, 2, 4, 2, gl); P(7, 3, 2, 2, gl); P(13, 3, 2, 2, gl); P(10, 0, 2, 2, gl); });
    mk('i_armor', P => { P(3, 3, 10, 10, '#8a96ae'); P(3, 3, 10, 2, '#d5dbe8'); P(1, 3, 3, 4, '#aab4c8'); P(12, 3, 3, 4, '#aab4c8'); P(6, 3, 4, 2, '#2a2f45'); P(7, 7, 2, 6, gold); P(10, 5, 3, 8, '#6a7690'); });
    mk('i_ring', P => { P(4, 5, 8, 8, gold); P(6, 7, 4, 4, '#0b0b14'); P(5, 5, 6, 1, gl); P(6, 2, 4, 4, '#c0392b'); P(7, 3, 2, 1, '#ff9a8a'); });
    mk('i_amulet', P => { E.PG.line(P, 3, 1, 7, 7, 1, gold); E.PG.line(P, 13, 1, 9, 7, 1, gold); P(5, 7, 6, 6, gold); P(6, 8, 4, 4, '#3b82f6'); P(7, 9, 2, 1, '#bfdcff'); });
    mk('i_charm', P => { P(4, 3, 8, 10, '#4aa3a0'); P(5, 4, 6, 8, '#1f5f5b'); P(7, 5, 2, 6, gl); P(5, 7, 6, 2, gl); P(7, 0, 2, 3, gold); });
    // materials
    mk('m_iron', P => { P(2, 6, 12, 8, '#5a5e72'); P(4, 3, 8, 5, '#7a7e94'); P(5, 4, 3, 2, '#aab0c8'); P(9, 9, 3, 2, '#c97a3a'); P(3, 10, 3, 2, '#3a3e52'); });
    mk('m_wood', P => { P(2, 4, 12, 3, '#6a4a2a'); P(2, 8, 12, 3, '#7a5a32'); P(2, 12, 12, 2, '#5a3a22'); P(2, 4, 12, 1, '#9a7a4a'); P(3, 9, 6, 1, '#4a2a18'); });
    mk('m_bone', P => { E.PG.line(P, 4, 12, 12, 4, 2, '#e8e0c8'); P(2, 11, 4, 4, '#e8e0c8'); P(11, 1, 4, 4, '#e8e0c8'); P(3, 12, 2, 2, '#b8b098'); });
    mk('m_crystal', P => { P(6, 1, 4, 14, '#6ab8ff'); P(4, 5, 3, 9, '#4a8ad8'); P(9, 4, 3, 10, '#8cd0ff'); P(7, 2, 1, 8, '#e8f8ff'); });
    mk('m_essence', P => { P(5, 5, 6, 8, '#ff6a1a'); P(6, 3, 4, 3, '#ff9a2a'); P(7, 1, 2, 3, '#ffd080'); P(6, 8, 4, 4, '#ffd080'); P(7, 9, 2, 2, '#fff'); });
    // ui
    mk('u_coin', P => { P(3, 2, 10, 12, gold); P(2, 4, 12, 8, gold); P(4, 3, 8, 10, gl); P(5, 5, 6, 6, gold); P(7, 5, 2, 6, '#8a6a2a'); });
    mk('u_gem', P => { P(4, 2, 8, 2, '#c49bff'); P(2, 4, 12, 3, '#8a4be8'); P(4, 7, 8, 3, '#6a30c8'); P(6, 10, 4, 3, '#4a1f98'); P(5, 3, 2, 1, '#fff'); });
    mk('u_quest', P => { P(3, 2, 10, 12, '#e8d8a8'); P(3, 2, 10, 1, '#fff'); P(2, 1, 2, 3, '#b89860'); P(12, 12, 2, 3, '#b89860'); for (let i = 0; i < 4; i++) P(5, 5 + i * 2, 6, 1, '#6a4a2a'); });
    mk('u_mail', P => { P(2, 4, 12, 9, '#e8d8a8'); P(2, 4, 12, 1, '#fff'); E.PG.line(P, 2, 4, 8, 9, 1, '#8a6a3a'); E.PG.line(P, 14, 4, 8, 9, 1, '#8a6a3a'); });
    mk('u_gear', P => { P(5, 5, 6, 6, '#aab0c8'); P(7, 1, 2, 14, '#aab0c8'); P(1, 7, 14, 2, '#aab0c8'); P(3, 3, 2, 2, '#aab0c8'); P(11, 3, 2, 2, '#aab0c8'); P(3, 11, 2, 2, '#aab0c8'); P(11, 11, 2, 2, '#aab0c8'); P(7, 7, 2, 2, '#1a1a28'); });
    mk('u_save', P => { P(2, 2, 12, 12, '#3b82f6'); P(4, 2, 8, 5, '#d8e8ff'); P(4, 9, 8, 5, '#1f3a70'); P(9, 3, 2, 3, '#3b82f6'); });
    mk('u_load', P => { P(2, 5, 12, 9, '#d4a84a'); P(2, 3, 6, 3, '#d4a84a'); P(4, 7, 8, 5, '#8a6a2a'); E.PG.line(P, 8, 2, 8, 8, 1, '#fff'); });
    mk('u_party', P => { P(2, 4, 4, 4, '#e8b890'); P(10, 4, 4, 4, '#e8b890'); P(6, 2, 4, 5, '#e8b890'); P(1, 8, 6, 6, '#c0392b'); P(9, 8, 6, 6, '#2f7f7b'); P(5, 8, 6, 6, '#5a2db0'); });
    mk('u_hammer', P => { P(2, 2, 10, 5, '#aab0c8'); P(3, 3, 8, 1, '#fff'); E.PG.line(P, 8, 7, 3, 14, 2, '#7a5a32'); });
    mk('u_bag', P => { P(3, 5, 10, 9, '#8a5a2a'); P(5, 2, 6, 4, '#6a4a22'); P(4, 5, 8, 2, '#c08a42'); P(7, 8, 2, 3, gold); });
    mk('u_flag', P => { P(3, 1, 2, 14, '#6a5a3a'); P(5, 2, 9, 7, '#c0392b'); P(5, 2, 9, 1, '#ff7a6a'); });
    mk('u_star', P => { P(7, 1, 2, 14, gold); P(1, 7, 14, 2, gold); P(3, 3, 10, 10, gold); P(5, 5, 6, 6, gl); });
    mk('u_lock', P => { P(3, 7, 10, 8, gold); P(5, 2, 6, 6, '#8a6a2a'); P(7, 3, 2, 4, '#0b0b14'); P(7, 9, 2, 3, '#0b0b14'); });
    mk('u_play', P => { for (let i = 0; i < 6; i++) P(4 + i, 2 + i, 1, 12 - i * 2, '#f2d98a'); });
    mk('u_pause', P => { P(3, 2, 4, 12, '#f2d98a'); P(9, 2, 4, 12, '#f2d98a'); });
    mk('u_swords', P => { E.PG.line(P, 2, 13, 13, 2, 2, '#d5dbe8'); E.PG.line(P, 13, 13, 2, 2, 2, '#aab0c8'); P(1, 12, 4, 2, gold); P(11, 12, 4, 2, gold); });
    mk('u_heart', P => { P(2, 3, 5, 5, '#e04050'); P(9, 3, 5, 5, '#e04050'); P(2, 6, 12, 3, '#e04050'); P(4, 9, 8, 2, '#e04050'); P(6, 11, 4, 2, '#e04050'); P(3, 4, 2, 1, '#ff9aa0'); });
    mk('u_atk', P => { E.PG.line(P, 3, 13, 13, 3, 2, '#e8edf8'); P(2, 12, 5, 2, gold); });
    mk('u_def', P => { P(3, 2, 10, 9, '#4a7ad8'); P(5, 11, 6, 3, '#4a7ad8'); P(3, 2, 10, 1, '#9ac0ff'); P(7, 4, 2, 6, '#fff'); });
    mk('u_x', P => { E.PG.line(P, 3, 3, 12, 12, 2, '#f2d98a'); E.PG.line(P, 12, 3, 3, 12, 2, '#f2d98a'); });
    mk('u_check', P => { E.PG.line(P, 2, 8, 6, 12, 2, '#8be07a'); E.PG.line(P, 6, 12, 13, 3, 2, '#8be07a'); });
    mk('u_up', P => { for (let i = 0; i < 7; i++) P(2 + i, 10 - i, 12 - i * 2, 1, '#f2d98a'); });
    mk('u_down', P => { for (let i = 0; i < 7; i++) P(2 + i, 5 + i, 12 - i * 2, 1, '#f2d98a'); });
    mk('u_skull', P => { P(3, 2, 10, 9, '#e8e0c8'); P(5, 11, 6, 3, '#e8e0c8'); P(4, 5, 3, 3, '#0b0b14'); P(9, 5, 3, 3, '#0b0b14'); P(7, 9, 2, 2, '#0b0b14'); });
    mk('u_helm', P => { P(3, 3, 10, 10, '#9aa6bc'); P(3, 3, 10, 2, '#d3dbea'); P(3, 11, 10, 2, '#6e7a90'); P(5, 7, 8, 2, '#0b0b14'); P(7, 0, 2, 4, '#2f9f9a'); });
    mk('u_home', P => { P(3, 7, 10, 7, '#8a6a4a'); for (let i = 0; i < 6; i++) P(2 + i, 2 + i, 12 - i * 2, 1, '#a02a2a'); P(7, 10, 3, 4, '#2a1a10'); });
    mk('u_exit', P => { P(2, 2, 7, 12, '#8a6a4a'); P(3, 3, 5, 10, '#2a1a10'); E.PG.line(P, 8, 8, 14, 8, 2, '#f2d98a'); P(11, 5, 2, 6, '#f2d98a'); });
    // battle commands
    mk('c_focus', P => { P(7, 1, 2, 5, '#ff6b5a'); P(7, 10, 2, 5, '#ff6b5a'); P(1, 7, 5, 2, '#ff6b5a'); P(10, 7, 5, 2, '#ff6b5a'); P(5, 5, 6, 1, '#ff6b5a'); P(5, 10, 6, 1, '#ff6b5a'); P(7, 7, 2, 2, '#fff'); });
    mk('c_hold', P => { P(3, 3, 10, 10, '#4a7ad8'); P(4, 4, 8, 8, '#1f2f70'); P(6, 6, 4, 4, '#9ac0ff'); });
    mk('c_regroup', P => { E.PG.line(P, 1, 3, 6, 8, 2, '#f2d98a'); E.PG.line(P, 15, 3, 10, 8, 2, '#f2d98a'); E.PG.line(P, 1, 13, 6, 8, 2, '#f2d98a'); E.PG.line(P, 15, 13, 10, 8, 2, '#f2d98a'); P(7, 7, 2, 2, '#fff'); });
    mk('c_spread', P => { E.PG.line(P, 7, 7, 2, 2, 2, '#f2d98a'); E.PG.line(P, 9, 7, 14, 2, 2, '#f2d98a'); E.PG.line(P, 7, 9, 2, 14, 2, '#f2d98a'); E.PG.line(P, 9, 9, 14, 14, 2, '#f2d98a'); P(7, 7, 2, 2, '#fff'); });
    mk('c_advance', P => { P(2, 6, 8, 4, '#8be07a'); for (let i = 0; i < 6; i++) P(9 + i, 2 + i, 1, 12 - i * 2, '#8be07a'); });
    mk('c_retreat', P => { P(6, 6, 8, 4, '#ff9a5a'); for (let i = 0; i < 6; i++) P(6 - i, 2 + i, 1, 12 - i * 2, '#ff9a5a'); });
  }
};

/* ==== src/assets/UISprites.js ==== */
/* 9-slice UI frames in dark-blue / antique-gold. Used by E.UI components. */
E.UISprites = {
  build(scene) {
    const PG = E.PG, S = PG.sh;
    const frame = (key, w, h, o) => {
      const [c, ctx] = PG.canvas(w, h), P = PG.pen(ctx);
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, o.top); g.addColorStop(1, o.bot); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      P(0, 0, w, 1, '#07070f'); P(0, h - 1, w, 1, '#07070f'); P(0, 0, 1, h, '#07070f'); P(w - 1, 0, 1, h, '#07070f');
      P(1, 1, w - 2, 2, o.gold); P(1, h - 3, w - 2, 2, o.goldDark); P(1, 1, 2, h - 2, o.gold); P(w - 3, 1, 2, h - 2, o.goldDark);
      P(3, 3, w - 6, 1, o.hi); P(3, 3, 1, h - 6, o.hi);
      if (o.corner) for (const [x, y] of [[0, 0], [w - 7, 0], [0, h - 7], [w - 7, h - 7]]) { P(x, y, 7, 7, '#07070f'); P(x + 1, y + 1, 5, 5, o.cornerCol); P(x + 2, y + 2, 3, 3, o.gold); P(x + 3, y + 3, 1, 1, '#fff6c0'); }
      PG.register(scene, key, c);
    };
    const gold = '#d4a84a', gd = '#8a6a2a';
    frame('ui_panel', 48, 48, { top: '#1a2145', bot: '#0b0d1e', gold, goldDark: gd, hi: '#3a4690', corner: true, cornerCol: gd });
    frame('ui_panel2', 32, 32, { top: '#12183a', bot: '#080a18', gold: gd, goldDark: '#5a4420', hi: '#242c5c', corner: false });
    frame('ui_btn_n', 32, 24, { top: '#2c3870', bot: '#141a38', gold, goldDark: gd, hi: '#4a58a8', corner: false });
    frame('ui_btn_h', 32, 24, { top: '#4a3a90', bot: '#241a5a', gold: '#f2d98a', goldDark: gold, hi: '#8a78e0', corner: false });
    frame('ui_btn_p', 32, 24, { top: '#0e1230', bot: '#1a2250', gold: gd, goldDark: '#5a4420', hi: '#1a2250', corner: false });
    frame('ui_btn_d', 32, 24, { top: '#22222c', bot: '#14141c', gold: '#4a4a56', goldDark: '#2e2e38', hi: '#2e2e38', corner: false });
    frame('ui_btn_g', 32, 24, { top: '#3a5a2a', bot: '#1a3014', gold: '#9ae080', goldDark: '#4a8a3a', hi: '#5a8a46', corner: false });
    frame('ui_slot', 24, 24, { top: '#0a0c1c', bot: '#14183a', gold: gd, goldDark: '#4a3a1a', hi: '#0a0c1c', corner: false });
    frame('ui_slot_s', 24, 24, { top: '#2a2260', bot: '#18144a', gold: '#f2d98a', goldDark: gold, hi: '#5a48b0', corner: false });
    frame('ui_row', 24, 24, { top: '#161c40', bot: '#0e1230', gold: '#3a3a5a', goldDark: '#262640', hi: '#1c2450', corner: false });
    frame('ui_row_s', 24, 24, { top: '#3a2c70', bot: '#241a50', gold, goldDark: gd, hi: '#5a48b0', corner: false });
    const [c, x] = PG.canvas(2, 2); x.fillStyle = '#fff'; x.fillRect(0, 0, 2, 2); PG.register(scene, 'px', c);
  }
};

/* ==== src/combat/Skills.js ==== */
/* Active skills and ultimates. cast(unit, kind, battle) -> true if it fired. */
E.Skills = {
  cast(u, kind, b) {
    if (!u.alive || u.stunT > 0 || !u.hero) return false;
    const cls = E.CLASSES[u.hero.cls], def = kind === 'ult' ? cls.ult : cls.skill, p = E.Hero.skillPower(u.hero);
    if (kind === 'ult') { if (!E.Hero.ultUnlocked(u.hero) || u.ult < 100) return false; }
    else if (u.skillT > 0) return false;
    const fn = this['do_' + def.id]; if (!fn) return false;
    const foes = b.foesOf(u); if (!foes.length && def.id !== 'aegis' && def.id !== 'sanctuary' && def.id !== 'mend') return false;
    if (kind === 'ult') { u.ult = 0; E.Sfx.play('ult'); b.banner(E.Hero.skillName(u.hero, 'ult') + '!', cls.color); b.shake(180, 0.006); }
    else { u.skillT = cls.skill.cd; E.Sfx.play(def.id === 'mend' ? 'heal' : 'magic'); }
    u.castT = 0.5; u.atkAnim = 0.35; u.atkAnimMax = 0.35;
    fn.call(this, u, b, p);
    return true;
  },
  target(u, b) { const f = b.focus && b.focus.alive ? b.focus : null; return f || b.nearest(u, b.foesOf(u)); },
  inRadius(b, list, x, y, r) { return list.filter(e => Math.hypot(e.x - x, e.y - y) <= r + e.radius * 0.6); },

  do_roar(u, b, p) {
    b.ring(u.x, u.y, 320, 0x4fc1bb, 0.6);
    b.foesOf(u).forEach(e => { if (Math.hypot(e.x - u.x, e.y - u.y) < 340) { e.tauntSrc = u; e.tauntT = 5; if (!e.isBoss) b.burst(e.x, e.y - 30, 0x4fc1bb, 5, 60, 0.4); } });
    u.drT = 5; u.drAmt = 0.45; b.burst(u.x, u.y - 40, 0x4fc1bb, 14, 120, 0.6);
  },
  do_aegis(u, b, p) {
    b.alliesOf(u).forEach(a => { a.shield = a.maxHp * 0.28 * p; a.shieldT = 8; b.ring(a.x, a.y, 60, 0x8cd0ff, 0.5); b.burst(a.x, a.y - 40, 0x8cd0ff, 8, 90, 0.6); });
  },
  do_cleave(u, b, p) {
    b.ring(u.x, u.y, 125, 0xff6b5a, 0.3); b.burst(u.x, u.y - 30, 0xffb0a0, 12, 160, 0.35);
    this.inRadius(b, b.foesOf(u), u.x, u.y, 125).forEach(e => b.dealDamage(u, e, 1.7 * p));
  },
  do_tempest(u, b, p) {
    for (let i = 0; i < 6; i++) b.after(0.12 + i * 0.3, () => {
      if (!u.alive) return; b.ring(u.x, u.y, 175, 0xff9a8a, 0.3); b.burst(u.x, u.y - 30, 0xffffff, 8, 200, 0.3); E.Sfx.play('hit');
      this.inRadius(b, b.foesOf(u), u.x, u.y, 175).forEach(e => b.dealDamage(u, e, 0.95 * p, { noUlt: true }));
    });
    u.moveLock = 1.9;
  },
  do_voidbolt(u, b, p) {
    const t = this.target(u, b); if (!t) return;
    b.projectile({ x: u.x, y: u.y - 50, target: t, speed: 520, kind: 'void', col: 0xc49bff, src: u, onHit: () => {
      b.ring(t.x, t.y, 105, 0xc49bff, 0.4); b.burst(t.x, t.y - 20, 0xe0c8ff, 16, 180, 0.5); b.shake(80, 0.003);
      this.inRadius(b, b.foesOf(u), t.x, t.y, 105).forEach(e => b.dealDamage(u, e, 2.1 * p));
    } });
  },
  do_abyssrain(u, b, p) {
    for (let i = 0; i < 8; i++) b.after(0.2 + i * 0.35, () => {
      const foes = b.foesOf(u); if (!foes.length) return;
      const t = E.U.pick(foes), x = t.x + E.U.rand(-60, 60), y = t.y + E.U.rand(-30, 30);
      b.meteor(x, y, 0.45, () => {
        b.ring(x, y, 100, 0xc49bff, 0.4); b.burst(x, y - 10, 0xffffff, 10, 200, 0.5); b.shake(60, 0.003);
        this.inRadius(b, b.foesOf(u), x, y, 100).forEach(e => b.dealDamage(u, e, 1.4 * p, { noUlt: true }));
      });
    });
  },
  do_pierce(u, b, p) {
    const t = this.target(u, b); if (!t) return;
    const dx = t.x - u.x, dy = t.y - u.y, L = Math.hypot(dx, dy) || 1, nx = dx / L, ny = dy / L, len = 760;
    b.beam(u.x, u.y - 40, u.x + nx * len, u.y - 40 + ny * len, 0xbfff9a, 0.35, 6);
    b.foesOf(u).forEach(e => {
      const rx = e.x - u.x, ry = e.y - u.y, along = rx * nx + ry * ny, perp = Math.abs(rx * ny - ry * nx);
      if (along > 0 && along < len && perp < 34 + e.radius * 0.7) b.dealDamage(u, e, 1.85 * p);
    });
  },
  do_arrowstorm(u, b, p) {
    b.foesOf(u).forEach((e, i) => b.after(0.1 + i * 0.09, () => {
      if (!e.alive) return; b.beam(e.x - 40, e.y - 360, e.x, e.y - 20, 0xbfff9a, 0.25, 4); E.Sfx.play('shoot');
      b.after(0.12, () => { b.burst(e.x, e.y - 20, 0xbfff9a, 6, 120, 0.3); b.dealDamage(u, e, 1.6 * p, { noUlt: true }); });
    }));
  },
  do_mend(u, b, p) {
    const allies = b.alliesOf(u).filter(a => a.hp < a.maxHp);
    const t = (allies.length ? allies : b.alliesOf(u)).sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0]; if (!t) return;
    b.heal(t, u.atk * 2.6 * p, u);
    b.alliesOf(u).forEach(a => { if (a !== t && Math.hypot(a.x - t.x, a.y - t.y) < 150) b.heal(a, u.atk * 1.3 * p, u); });
    b.ring(t.x, t.y, 150, 0xf2d98a, 0.5);
  },
  do_sanctuary(u, b, p) {
    b.alliesOf(u).forEach(a => { b.heal(a, a.maxHp * 0.45, u); a.stunT = 0; b.ring(a.x, a.y, 70, 0xfff2b0, 0.7); });
    const dead = b.heroes.filter(h => !h.alive);
    if (dead.length) b.revive(E.U.pick(dead), 0.4);
    b.ring(u.x, u.y, 400, 0xfff2b0, 0.8);
  }
};

/* ==== src/combat/Unit.js ==== */
/* A combatant (hero or enemy): stats, timers and sprite. Decisions live in AI.js; effects in Battle.js. */
E.Unit = class {
  constructor(b, o) {
    this.b = b; this.side = o.side; this.hero = o.hero || null; this.name = o.name; this.kind = o.kind || (o.hero && o.hero.cls);
    const s = o.stats; this.maxHp = s.hp; this.hp = s.hp; this.atk = s.atk; this.def = s.def; this.spd = s.spd; this.range = s.range; this.cd = s.cd; this.crit = s.crit || 0.05;
    this.x = o.x; this.y = o.y; this.anchor = { x: o.x, y: o.y }; this.radius = o.radius || 20; this.isBoss = !!o.boss;
    this.ranged = o.ranged !== undefined ? o.ranged : this.range > 120; this.proj = o.proj || (this.hero ? (this.kind === 'archer' ? 'arrow' : this.kind === 'mage' ? 'orb' : this.kind === 'cleric' ? 'heal' : null) : null);
    this.healer = !!o.healer || this.kind === 'cleric'; this.elite = !!o.elite; this.bossAtk = o.bossAtk;
    this.alive = true; this.atkT = Math.random() * 0.5; this.skillT = 0; this.ult = 0; this.autoCast = false;
    this.stunT = 0; this.tauntT = 0; this.tauntSrc = null; this.drT = 0; this.drAmt = 0; this.shield = 0; this.shieldT = 0;
    this.hurtT = 0; this.atkAnim = 0; this.atkAnimMax = 0.32; this.pending = null; this.animT = Math.random(); this.moving = false; this.castT = 0; this.moveLock = 0;
    this.facing = this.side === 'hero' ? 1 : -1; this.target = null; this.healT = 3; this.bossT = 3.5; this.bossIdx = 0; this.corpseT = 0; this.casting = null;
    this.sc = o.scale; this.tex = o.tex;
    const sc = this.scene = b.scene;
    this.shadow = sc.add.ellipse(this.x, this.y, this.radius * 2.4, this.radius * 0.9, 0x000000, 0.4);
    this.sprite = sc.add.sprite(this.x, this.y, o.tex, 'idle0').setScale(o.scale).setOrigin(0.5, 0.92);
    this.spriteH = (o.boss ? 64 : 32) * o.scale * 0.9;
    this.sprite.setInteractive({ useHandCursor: this.side === 'enemy' });
    this.sprite.unit = this;
  }
  get dead() { return !this.alive; }
  dist(o) { return Math.hypot(o.x - this.x, o.y - this.y); }
  edge(o) { return this.dist(o) - o.radius * 0.7; }
  moveToward(x, y, dt, mult = 1) {
    if (this.moveLock > 0 || this.stunT > 0 || this.castT > 0) return false;
    const dx = x - this.x, dy = y - this.y, d = Math.hypot(dx, dy);
    if (d < 3) return false;
    const st = Math.min(d, this.spd * mult * dt * (this.slowT > 0 ? 0.5 : 1));
    this.x += dx / d * st; this.y += dy / d * st; this.moving = true;
    if (Math.abs(dx) > 4) this.facing = dx > 0 ? 1 : -1;
    return true;
  }
  face(o) { if (Math.abs(o.x - this.x) > 4) this.facing = o.x > this.x ? 1 : -1; }
  /* Frame selection driven by simulation time so a tactical pause freezes animation. */
  render() {
    const s = this.sprite; s.setPosition(Math.round(this.x), Math.round(this.y)); s.setDepth(this.y);
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y - 2)).setDepth(this.y - 1);
    s.setFlipX(this.facing < 0);
    let f;
    if (!this.alive) f = 'dead';
    else if (this.hurtT > 0 && this.atkAnim <= 0) f = 'hurt';
    else if (this.casting || this.atkAnim > 0) {
      const p = this.casting ? 0 : 1 - this.atkAnim / this.atkAnimMax; f = 'atk' + (p < 0.34 ? 0 : p < 0.7 ? 1 : 2);
    } else if (this.moving) f = 'walk' + (Math.floor(this.animT * 9) % 4);
    else f = 'idle' + (Math.floor(this.animT * 2.2) % 2);
    if (s.frame.name !== f) s.setFrame(f);
    if (this.hurtT > 0) s.setTint(0xff9090); else if (this.stunT > 0) s.setTint(0x9aa0ff); else if (this.shieldT > 0) s.setTint(0xbfe8ff); else if (this.tauntT > 0 && this.side === 'enemy') s.setTint(0xffd0a0); else s.clearTint();
    if (!this.alive) { s.setAlpha(Math.max(0, 1 - this.corpseT / 3.5)); this.shadow.setAlpha(0.25 * s.alpha); }
  }
  destroy() { this.sprite.destroy(); this.shadow.destroy(); }
};

/* ==== src/ai/AI.js ==== */
/* Auto-battle brains. Heroes obey the player's tactical command; enemies chase the closest (or taunting) hero. */
E.AI = {
  /* Is the unit standing in a telegraphed danger zone? Returns the zone or null. */
  danger(u, b) {
    for (const t of b.tele) {
      if (t.dur - t.t < 0.25) continue;
      if (t.shape === 'circle') { if (Math.hypot(u.x - t.x, u.y - t.y) < t.r + u.radius * 0.4) return t; }
      else { const rx = u.x - t.x, ry = u.y - t.y, along = rx * t.nx + ry * t.ny, perp = Math.abs(rx * t.ny - ry * t.nx); if (along > -20 && along < t.len && perp < t.w / 2 + u.radius * 0.5) return t; }
    }
    return null;
  },
  escape(u, z) { // direction out of the zone
    if (z.shape === 'circle') { const dx = u.x - z.x, dy = u.y - z.y, d = Math.hypot(dx, dy) || 1; return { x: z.x + dx / d * (z.r + 60), y: z.y + dy / d * (z.r + 60) }; }
    const rx = u.x - z.x, ry = u.y - z.y, side = (rx * z.ny - ry * z.nx) >= 0 ? 1 : -1;
    return { x: u.x + z.ny * side * (z.w / 2 + 70), y: u.y - z.nx * side * (z.w / 2 + 70) };
  },
  pickHeroTarget(u, b) {
    const foes = b.foesOf(u); if (!foes.length) return null;
    if (b.focus && b.focus.alive && !u.healOnly) return b.focus;
    return b.nearest(u, foes);
  },
  hero(u, b, dt) {
    u.moving = false;
    if (u.stunT > 0) return;
    // auto-cast regular skills when enabled
    if (b.autoSkills && u.skillT <= 0 && u.castT <= 0) E.Skills.cast(u, 'skill', b);
    const cmd = b.cmd, anch = u.anchor;
    // dodge telegraphs unless told to hold
    if (cmd !== 'hold') { const z = this.danger(u, b); if (z) { const e = this.escape(u, z); u.moveToward(e.x, e.y, dt, 1.25); return; } }
    // cleric: heal wounded allies first
    let target = null, healing = false;
    if (u.kind === 'cleric') {
      const hurt = b.alliesOf(u).filter(a => a.hp / a.maxHp < 0.7).sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
      if (hurt) { target = hurt; healing = true; }
    }
    if (!target) target = this.pickHeroTarget(u, b);
    u.target = target;
    const inRange = target && u.edge(target) <= u.range;
    const act = () => { if (target && inRange && u.atkT <= 0 && u.castT <= 0 && u.stunT <= 0) { u.face(target); b.attack(u, target, healing); } };
    if (cmd === 'retreat') {
      u.moveToward(70 + (u.anchor.y % 5) * 6, u.anchor.y, dt, 1.35);
      return;
    }
    if (cmd === 'regroup') {
      const arrived = Math.hypot(anch.x - u.x, anch.y - u.y) < 10;
      if (!arrived) { u.moveToward(anch.x, anch.y, dt, 1.2); return; }
      act(); return;
    }
    if (cmd === 'hold') { act(); return; }
    if (cmd === 'spread') {
      // keep distance from allies and from the pack; fight from where we stand
      let px = 0, py = 0;
      b.alliesOf(u).forEach(a => { if (a === u) return; const d = u.dist(a); if (d < 190 && d > 0) { px += (u.x - a.x) / d * (190 - d); py += (u.y - a.y) / d * (190 - d); } });
      const m = Math.hypot(px, py);
      if (m > 12) { u.moveToward(u.x + px / m * 40, u.y + py / m * 40, dt, 1); return; }
      act(); if (target && !inRange && !(m > 12)) u.moveToward(target.x, target.y, dt, 0.8); return;
    }
    // advance (default): close to range and fight
    if (target && !inRange) {
      const stand = u.range * 0.88 + target.radius * 0.7;
      const dx = u.x - target.x, dy = u.y - target.y, d = Math.hypot(dx, dy) || 1;
      u.moveToward(target.x + dx / d * stand, target.y + dy / d * stand, dt);
    }
    act();
  },
  enemy(u, b, dt) {
    u.moving = false;
    if (u.stunT > 0) return;
    const foes = b.foesOf(u); if (!foes.length) return;
    // shaman heals wounded allies
    if (u.healer && u.healT <= 0) {
      const w = b.alliesOf(u).filter(a => a.hp / a.maxHp < 0.65).sort((a, c) => a.hp - c.hp)[0];
      if (w && u.edge(w) <= u.range * 1.1) { u.healT = 5; u.atkAnim = 0.3; u.atkAnimMax = 0.3; b.heal(w, u.atk * 3, u); return; }
    }
    if (u.isBoss) { this.boss(u, b, dt); if (u.casting) return; }
    let t = (u.tauntT > 0 && u.tauntSrc && u.tauntSrc.alive) ? u.tauntSrc : null;
    if (!t) { t = b.nearest(u, foes); }
    u.target = t; if (!t) return;
    const inRange = u.edge(t) <= u.range;
    if (!inRange) { const stand = u.range * 0.9 + t.radius * 0.5, dx = u.x - t.x, dy = u.y - t.y, d = Math.hypot(dx, dy) || 1; u.moveToward(t.x + dx / d * stand, t.y + dy / d * stand, dt); }
    else if (u.atkT <= 0 && u.castT <= 0) { u.face(t); b.attack(u, t, false); }
  },
  /* Boss: telegraphed attacks. Enrages below 50% HP. */
  boss(u, b, dt) {
    const enraged = u.hp < u.maxHp * 0.5; u.enraged = enraged;
    if (u.casting) {
      u.casting.t += dt; u.moving = false;
      if (u.casting.t >= u.casting.dur) { u.casting = null; u.atkAnim = 0.4; u.atkAnimMax = 0.4; b.shake(160, 0.008); }
      return;
    }
    u.bossT -= dt;
    if (u.bossT > 0) return;
    const heroes = b.heroes.filter(h => h.alive); if (!heroes.length) return;
    const kind = u.bossIdx++ % 3, dur = enraged ? 1.15 : 1.6, names = u.bossAtk || ['Slam', 'Lance', 'Roots'];
    const tgt = E.U.pick(heroes);
    b.banner(names[kind] + '!', 0xff6b5a, 0.9); E.Sfx.play('warn');
    if (kind === 0) b.addTele({ shape: 'circle', x: u.x, y: u.y, r: 175, dur, mult: 1.7, src: u, follow: true });
    else if (kind === 1) { const dx = tgt.x - u.x, dy = tgt.y - u.y, L = Math.hypot(dx, dy) || 1; b.addTele({ shape: 'line', x: u.x, y: u.y, nx: dx / L, ny: dy / L, len: 820, w: 90, dur, mult: 1.5, src: u }); }
    else { const picks = heroes.slice().sort(() => Math.random() - 0.5).slice(0, 3); picks.forEach(h => b.addTele({ shape: 'circle', x: h.x, y: h.y, r: 105, dur: dur + 0.3, mult: 1.4, src: u })); }
    u.casting = { t: 0, dur: dur * 0.9 }; u.face(tgt);
    u.bossT = (enraged ? E.U.rand(3, 4.2) : E.U.rand(4.6, 6.4)) + dur;
  }
};

/* ==== src/combat/Battle.js ==== */
/* Real-time battle simulation. Driven in "simulation time" so pause and 2x speed are exact. */
E.Battle = class {
  constructor(scene, dungeon, stageIdx) {
    this.scene = scene; this.d = dungeon; this.idx = stageIdx;
    this.heroes = []; this.enemies = []; this.proj = []; this.parts = []; this.rings = []; this.beams = []; this.tele = []; this.meteors = []; this.timers = []; this.texts = [];
    this.t = 0; this.cmd = 'advance'; this.focus = null; this.autoSkills = false; this.over = null; this.afterOver = 0;
    this.bounds = { x0: 50, x1: 1230, y0: 120, y1: 580 };
    this.groundGfx = scene.add.graphics().setDepth(2);
    this.barGfx = scene.add.graphics().setDepth(99998);
    this.fxGfx = scene.add.graphics().setDepth(99999);
    this.spawn();
  }
  spawn() {
    const s = E.G.s, B = this.bounds;
    s.party.map(id => E.G.hero(id)).filter(Boolean).forEach(h => {
      const p = s.formation.pos[h.id] || { x: 200, y: 340 };
      const u = new E.Unit(this, { side: 'hero', hero: h, name: h.name, stats: E.Hero.stats(h), x: p.x, y: E.U.clamp(p.y, B.y0, B.y1), scale: 3, radius: 20, tex: 'hero_' + h.cls });
      u.projCol = h.cls === 'archer' ? 0xe8e0c0 : 0xc49bff; this.heroes.push(u);
    });
    const defs = E.Run.buildEnemies(this.d, this.idx), pal = E.PALS[this.d.pal], used = [];
    defs.forEach((e, i) => {
      let x, y, tries = 0;
      do { x = e.boss ? 1020 : E.U.rand(880, 1190); y = e.boss ? 350 : E.U.rand(B.y0 + 30, B.y1 - 20); tries++; } while (tries < 40 && used.some(p => Math.hypot(p.x - x, p.y - y) < 62 + (e.boss ? 60 : 0)));
      used.push({ x, y });
      const u = new E.Unit(this, { side: 'enemy', name: e.name, kind: e.kind, stats: e.stats, x, y, scale: e.scale, radius: e.radius, boss: e.boss, elite: e.elite, ranged: e.ranged, proj: e.proj, healer: e.healer, bossAtk: e.bossAtk, tex: `mon_${e.shape}_${e.pal}` });
      u.projCol = parseInt(pal.glow.slice(1), 16); u.facing = -1; this.enemies.push(u);
    });
    this.units = this.heroes.concat(this.enemies);
    this.boss = this.enemies.find(e => e.isBoss) || null;
  }
  get all() { return this.units; }
  foesOf(u) { return (u.side === 'hero' ? this.enemies : this.heroes).filter(x => x.alive); }
  alliesOf(u) { return (u.side === 'hero' ? this.heroes : this.enemies).filter(x => x.alive); }
  nearest(u, list) { let best = null, bd = 1e9; for (const e of list) { const d = u.dist(e) - e.radius * 0.7; if (d < bd) { bd = d; best = e; } } return best; }
  after(delay, fn) { this.timers.push({ t: delay, fn }); }
  banner(text, col, dur) { this.scene.showBanner && this.scene.showBanner(text, col, dur); }
  shake(ms, k) { if (E.Settings.d.screenShake) this.scene.cameras.main.shake(ms, k); }
  commandSet(c) { this.cmd = c; }

  /* ---------- effects primitives ---------- */
  ring(x, y, r, col, dur = 0.4) { this.rings.push({ x, y, r, col, t: 0, dur }); }
  burst(x, y, col, n = 10, speed = 140, life = 0.5) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = speed * (0.4 + Math.random() * 0.6); this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, t: 0, life: life * (0.6 + Math.random() * 0.6), col, s: 3 + Math.floor(Math.random() * 3) }); }
  }
  beam(x1, y1, x2, y2, col, dur = 0.3, w = 4) { this.beams.push({ x1, y1, x2, y2, col, t: 0, dur, w }); }
  meteor(x, y, dur, fn) { this.meteors.push({ x, y, t: 0, dur, fn }); }
  projectile(o) { o.t = 0; this.proj.push(o); }
  addTele(t) { t.t = 0; this.tele.push(t); }
  floatText(x, y, str, col = '#fff', size = 18) {
    if (this.texts.length > 50) return;
    const t = E.UI.text(this.scene, x, y, str, { size, color: col, bold: true, ox: 0.5, oy: 0.5, st: 4 }); t.setDepth(100000);
    this.texts.push({ obj: t, t: 0, dur: 0.9, vy: -42 });
  }

  /* ---------- combat rules ---------- */
  attack(u, target, healing) {
    u.atkT = u.cd * (u.enraged ? 0.7 : 1); u.atkAnim = 0.3; u.atkAnimMax = 0.3; u.pending = { t: 0.14, target, healing }; u.face(target);
  }
  resolveAttack(u) {
    const p = u.pending, tg = p.target; u.pending = null;
    if (p.healing) { if (tg.alive) { this.beam(u.x, u.y - 50, tg.x, tg.y - 40, 0xf2d98a, 0.25, 4); this.heal(tg, u.atk * 1.0, u); } return; }
    if (!tg.alive) return;
    if (u.proj && u.proj !== 'heal') {
      E.Sfx.play(u.proj === 'arrow' ? 'shoot' : 'magic');
      this.projectile({ x: u.x + u.facing * 24, y: u.y - u.spriteH * 0.5, target: tg, speed: u.proj === 'arrow' ? 680 : 430, kind: u.proj, col: u.projCol, src: u, onHit: () => this.dealDamage(u, tg, 1) });
    } else if (u.edge(tg) <= u.range * 1.5 + 12) this.dealDamage(u, tg, 1);
  }
  dealDamage(src, tgt, mult = 1, o = {}) {
    if (!tgt.alive) return 0;
    let dmg = src.atk * mult * (100 / (100 + tgt.def)) * E.U.rand(0.92, 1.08);
    const crit = !o.noCrit && Math.random() < src.crit; if (crit) dmg *= 1.6;
    if (tgt.drT > 0) dmg *= 1 - tgt.drAmt;
    dmg = Math.max(1, Math.round(dmg)); const shown = dmg;
    if (tgt.shield > 0) { const a = Math.min(tgt.shield, dmg); tgt.shield -= a; dmg -= a; }
    tgt.hp -= dmg; if (dmg > 0) tgt.hurtT = 0.16;
    if (E.Settings.d.damageNumbers) this.floatText(tgt.x + E.U.rand(-10, 10), tgt.y - tgt.spriteH * 0.85, String(shown), tgt.side === 'hero' ? '#ff6b5a' : crit ? '#ffe070' : '#ffffff', crit ? 26 : 18);
    this.burst(tgt.x, tgt.y - tgt.spriteH * 0.4, tgt.side === 'hero' ? 0xff6b5a : 0xffffff, crit ? 8 : 4, 110, 0.3);
    E.Sfx.play(crit ? 'crit' : 'hit');
    if (!o.noUlt) { if (src.hero) src.ult = Math.min(100, src.ult + 5); if (tgt.hero) tgt.ult = Math.min(100, tgt.ult + 3); }
    if (tgt.hp <= 0) this.kill(tgt);
    return shown;
  }
  heal(t, amt, src) {
    if (!t.alive) return; const a = Math.min(Math.round(amt), Math.round(t.maxHp - t.hp)); if (a <= 0) return;
    t.hp += a; if (E.Settings.d.damageNumbers) this.floatText(t.x, t.y - t.spriteH * 0.85, '+' + a, '#8be07a', 18);
    this.burst(t.x, t.y - 40, 0x8be07a, 6, 70, 0.6);
    if (src && src.hero) src.ult = Math.min(100, src.ult + 3);
  }
  kill(u) {
    u.alive = false; u.hp = 0; u.corpseT = 0; u.casting = null; u.pending = null;
    if (this.focus === u) this.focus = null;
    this.burst(u.x, u.y - 30, u.side === 'hero' ? 0x8a4be8 : 0xffffff, u.isBoss ? 40 : 14, u.isBoss ? 300 : 160, 0.8);
    if (u.isBoss) { this.shake(500, 0.014); this.tele.length = 0; }
  }
  revive(u, frac) { u.alive = true; u.hp = u.maxHp * frac; u.corpseT = 0; u.sprite.setAlpha(1); u.shadow.setAlpha(0.4); this.burst(u.x, u.y - 40, 0xfff2b0, 20, 150, 0.8); this.ring(u.x, u.y, 80, 0xfff2b0, 0.6); }

  /* ---------- main step ---------- */
  update(dtTotal) {
    let rem = dtTotal;
    while (rem > 0.0001) { const st = Math.min(rem, 1 / 30); rem -= st; this.step(st); }
    this.render();
  }
  step(dt) {
    this.t += dt;
    for (const m of this.timers) m.t -= dt;
    const due = this.timers.filter(m => m.t <= 0); if (due.length) { this.timers = this.timers.filter(m => m.t > 0); due.forEach(m => m.fn()); }
    for (const u of this.units) {
      u.animT += dt;
      if (!u.alive) { u.corpseT += dt; continue; }
      u.atkT -= dt; u.skillT -= dt; u.healT -= dt; u.castT -= dt; u.moveLock -= dt; u.hurtT -= dt; u.atkAnim -= dt;
      if (u.stunT > 0) u.stunT -= dt; if (u.tauntT > 0) u.tauntT -= dt; if (u.drT > 0) u.drT -= dt;
      if (u.shieldT > 0) { u.shieldT -= dt; if (u.shieldT <= 0) u.shield = 0; }
      if (u.hero) u.ult = Math.min(100, u.ult + dt * 1.1);
      if (u.pending) { u.pending.t -= dt; if (u.pending.t <= 0) this.resolveAttack(u); }
      if (this.over) { u.moving = false; continue; }
      if (u.side === 'hero') E.AI.hero(u, this, dt); else E.AI.enemy(u, this, dt);
    }
    this.separate();
    this.stepFx(dt);
    if (!this.over) {
      if (!this.enemies.some(e => e.alive)) { this.over = 'win'; this.heroes.forEach(h => h.moving = false); }
      else if (!this.heroes.some(h => h.alive)) this.over = 'lose';
    } else this.afterOver += dt;
  }
  separate() {
    const B = this.bounds, alive = this.units.filter(u => u.alive);
    for (let it = 0; it < 2; it++) for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], c = alive[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = (a.radius + c.radius) * 0.78;
      if (d >= min) continue;
      const push = (min - d) / 2, nx = dx / d, ny = dy / d, wa = a.isBoss ? 0 : c.isBoss ? 2 : 1, wc = c.isBoss ? 0 : a.isBoss ? 2 : 1;
      a.x -= nx * push * wa; a.y -= ny * push * wa; c.x += nx * push * wc; c.y += ny * push * wc;
    }
    for (const u of alive) { u.x = E.U.clamp(u.x, B.x0, B.x1); u.y = E.U.clamp(u.y, B.y0, B.y1); }
  }
  stepFx(dt) {
    for (const p of this.proj) {
      p.t += dt; const tg = p.target; if (!tg) { p.done = true; continue; }
      const tx = tg.x, ty = tg.y - tg.spriteH * 0.45, dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), st = p.speed * dt;
      p.ang = Math.atan2(dy, dx);
      if (d <= st + 8 || p.t > 3) { p.done = true; p.onHit && p.onHit(); } else { p.x += dx / d * st; p.y += dy / d * st; }
    }
    this.proj = this.proj.filter(p => !p.done);
    for (const m of this.meteors) { m.t += dt; if (m.t >= m.dur) { m.done = true; m.fn(); } } this.meteors = this.meteors.filter(m => !m.done);
    for (const t of this.tele) {
      t.t += dt; if (t.follow && t.src && t.src.alive) { t.x = t.src.x; t.y = t.src.y; }
      if (t.t >= t.dur) {
        t.done = true;
        this.heroes.filter(h => h.alive).forEach(h => {
          let inside;
          if (t.shape === 'circle') inside = Math.hypot(h.x - t.x, h.y - t.y) < t.r + h.radius * 0.4;
          else { const rx = h.x - t.x, ry = h.y - t.y, al = rx * t.nx + ry * t.ny, pe = Math.abs(rx * t.ny - ry * t.nx); inside = al > -20 && al < t.len && pe < t.w / 2 + h.radius * 0.5; }
          if (inside && t.src.alive !== false) this.dealDamage(t.src, h, t.mult, { noCrit: true });
        });
        if (t.shape === 'circle') { this.ring(t.x, t.y, t.r, 0xff6b5a, 0.4); this.burst(t.x, t.y - 10, 0xff9a7a, 16, 220, 0.5); }
        else { this.beam(t.x, t.y, t.x + t.nx * t.len, t.y + t.ny * t.len, 0xff6b5a, 0.3, t.w * 0.5); }
        this.shake(120, 0.006);
      }
    }
    this.tele = this.tele.filter(t => !t.done);
    for (const r of this.rings) r.t += dt; this.rings = this.rings.filter(r => r.t < r.dur);
    for (const b of this.beams) b.t += dt; this.beams = this.beams.filter(b => b.t < b.dur);
    for (const p of this.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; } this.parts = this.parts.filter(p => p.t < p.life);
    for (const f of this.texts) { f.t += dt; f.obj.y += f.vy * dt; f.obj.setAlpha(Math.max(0, 1 - Math.pow(f.t / f.dur, 2))); if (f.t >= f.dur) { f.obj.destroy(); f.done = true; } }
    this.texts = this.texts.filter(f => !f.done);
  }

  /* ---------- drawing ---------- */
  render() {
    const g = this.groundGfx, fx = this.fxGfx, bg = this.barGfx;
    g.clear(); fx.clear(); bg.clear();
    for (const u of this.units) u.render();
    // focus marker
    if (this.focus && this.focus.alive) {
      const f = this.focus, pulse = 1 + Math.sin(this.scene.time.now / 120) * 0.08;
      g.lineStyle(3, 0xff6b5a, 0.9); g.strokeEllipse(f.x, f.y - 2, f.radius * 2.6 * pulse, f.radius * 1.1 * pulse);
    }
    // telegraphs
    for (const t of this.tele) {
      const p = t.t / t.dur, a = 0.16 + 0.1 * Math.sin(t.t * 14);
      if (t.shape === 'circle') {
        g.fillStyle(0xff3b2a, a); g.fillCircle(t.x, t.y, t.r); g.fillStyle(0xff3b2a, 0.28); g.fillCircle(t.x, t.y, t.r * p); g.lineStyle(3, 0xff6b5a, 0.9); g.strokeCircle(t.x, t.y, t.r);
      } else {
        const nx = t.nx, ny = t.ny, px = -ny * t.w / 2, py = nx * t.w / 2, ex = t.x + nx * t.len, ey = t.y + ny * t.len;
        const poly = [{ x: t.x + px, y: t.y + py }, { x: ex + px, y: ey + py }, { x: ex - px, y: ey - py }, { x: t.x - px, y: t.y - py }];
        g.fillStyle(0xff3b2a, a); g.fillPoints(poly, true); g.lineStyle(3, 0xff6b5a, 0.9); g.strokePoints(poly, true);
        const q = [{ x: t.x + px, y: t.y + py }, { x: t.x + nx * t.len * p + px, y: t.y + ny * t.len * p + py }, { x: t.x + nx * t.len * p - px, y: t.y + ny * t.len * p - py }, { x: t.x - px, y: t.y - py }];
        g.fillStyle(0xff3b2a, 0.28); g.fillPoints(q, true);
      }
    }
    for (const m of this.meteors) { const p = m.t / m.dur; g.lineStyle(2, 0xc49bff, 0.8); g.strokeCircle(m.x, m.y, 100 * p); fx.fillStyle(0xe0c8ff, 1); fx.fillRect(m.x - 60 * (1 - p) - 5, m.y - 420 * (1 - p) - 5, 10, 10); fx.fillStyle(0x8a4be8, 0.6); fx.fillRect(m.x - 60 * (1 - p) - 3 + 14, m.y - 420 * (1 - p) - 3 - 20, 6, 20); }
    // hp bars
    for (const u of this.units) {
      if (!u.alive || u.isBoss) continue;
      const w = u.elite ? 54 : 44, x = Math.round(u.x - w / 2), y = Math.round(u.y - u.spriteH - 10);
      bg.fillStyle(0x000000, 0.75); bg.fillRect(x - 1, y - 1, w + 2, 7);
      bg.fillStyle(u.side === 'hero' ? 0x4caf50 : 0xc0392b, 1); bg.fillRect(x, y, Math.max(0, w * u.hp / u.maxHp), 5);
      if (u.shield > 0) { bg.fillStyle(0x8cd0ff, 0.9); bg.fillRect(x, y, Math.min(w, w * u.shield / u.maxHp), 2); }
      if (u.hero) { bg.fillStyle(0x000000, 0.75); bg.fillRect(x - 1, y + 6, w + 2, 4); bg.fillStyle(u.ult >= 100 ? 0xffe070 : 0x8a4be8, 1); bg.fillRect(x, y + 7, w * u.ult / 100, 2); }
    }
    for (const r of this.rings) { const p = r.t / r.dur, e = 1 - Math.pow(1 - p, 2); fx.lineStyle(4, r.col, 1 - p); fx.strokeCircle(r.x, r.y, r.r * e); }
    for (const b of this.beams) { const p = b.t / b.dur; fx.lineStyle(b.w * (1 - p) + 1, b.col, 1 - p); fx.lineBetween(b.x1, b.y1, b.x2, b.y2); }
    for (const p of this.proj) {
      if (p.kind === 'arrow') { fx.lineStyle(3, 0xe8e0c0, 1); fx.lineBetween(p.x, p.y, p.x - Math.cos(p.ang) * 22, p.y - Math.sin(p.ang) * 22); fx.fillStyle(0xffffff, 1); fx.fillRect(p.x - 2, p.y - 2, 4, 4); }
      else { const big = p.kind === 'void' ? 9 : 6; fx.fillStyle(p.col, 0.35); fx.fillRect(p.x - big - 4, p.y - big - 4, big * 2 + 8, big * 2 + 8); fx.fillStyle(p.col, 1); fx.fillRect(p.x - big, p.y - big, big * 2, big * 2); fx.fillStyle(0xffffff, 1); fx.fillRect(p.x - big / 2, p.y - big / 2, big, big); }
    }
    for (const p of this.parts) { fx.fillStyle(p.col, Math.max(0, 1 - p.t / p.life)); fx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }
  }
  destroy() {
    this.units.forEach(u => u.destroy()); this.texts.forEach(t => t.obj.destroy());
    this.groundGfx.destroy(); this.barGfx.destroy(); this.fxGfx.destroy();
  }
};

/* ==== src/ui/UI.js ==== */
/* Reusable UI components (all real, interactive objects built from 9-slice frames). */
E.UI = {
  text(scene, x, y, str, o = {}) {
    const t = scene.add.text(x, y, String(str), {
      fontFamily: E.FONT, fontSize: (o.size || 16) + 'px', color: o.color || E.CS.text, fontStyle: o.bold ? 'bold' : 'normal',
      align: o.align || 'left', wordWrap: o.wrap ? { width: o.wrap } : undefined, stroke: '#05050c', strokeThickness: o.st || 0, lineSpacing: o.ls || 3
    });
    t.setOrigin(o.ox !== undefined ? o.ox : 0, o.oy !== undefined ? o.oy : 0); t.setResolution(2); return t;
  },
  icon(scene, x, y, key, scale = 2) { return scene.add.image(x, y, key).setScale(scale); },
  /* Interactive 9-slice button. Returns a container with setEnabled/setLabel. */
  button(scene, x, y, w, h, label, cb, o = {}) {
    const c = scene.add.container(x, y), skin = o.skin || 'n';
    const bg = scene.add.nineslice(0, 0, 'ui_btn_' + skin, undefined, w, h, 10, 10, 8, 8);
    c.add(bg);
    let ix = 0;
    if (o.icon) { const ic = scene.add.image(-w / 2 + 6 + (o.iconScale || 2) * 8, 0, o.icon).setScale(o.iconScale || 2); c.add(ic); ix = (o.iconScale || 2) * 8 / 2 + 3; c.ic = ic; }
    const t = E.UI.text(scene, ix, 0, label, { size: o.size || 16, color: o.color || E.CS.goldLight, ox: 0.5, oy: 0.5, bold: true, st: 2 });
    c.add(t); c.label = t; c.bg = bg; c.enabled = true; c.skin = skin; c.sel = false;
    c.setSize(w, h); c.setInteractive({ useHandCursor: true });
    const tex = k => bg.setTexture('ui_btn_' + k);
    const base = () => c.enabled ? (c.sel ? 'h' : skin) : 'd';
    c.on('pointerover', () => { if (!c.enabled) return; tex('h'); scene.tweens.add({ targets: c, scaleX: 1.04, scaleY: 1.04, duration: 90 }); E.Sfx.play('hover'); });
    c.on('pointerout', () => { tex(base()); scene.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 90 }); c.pressed = false; });
    c.on('pointerdown', () => { if (!c.enabled) { E.Sfx.play('error'); return; } c.pressed = true; tex('p'); c.setScale(0.96); });
    c.on('pointerup', () => {
      if (!c.enabled || !c.pressed) return; c.pressed = false; tex('h'); c.setScale(1.04);
      E.Sfx.play(o.sfx || 'click'); scene.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 120, ease: 'Back.Out' });
      cb && cb(c);
    });
    c.setEnabled = v => { c.enabled = v; tex(base()); t.setAlpha(v ? 1 : 0.5); if (c.ic) c.ic.setAlpha(v ? 1 : 0.5); if (!v) c.input.cursor = 'default'; else c.input.cursor = 'pointer'; return c; };
    c.setSelected = v => { c.sel = v; tex(base()); return c; };
    c.setLabel = s => t.setText(s);
    if (o.disabled) c.setEnabled(false);
    return c;
  },
  /* 9-slice panel with title. Origin is top-left. */
  panel(scene, x, y, w, h, title, o = {}) {
    const c = scene.add.container(x, y);
    c.add(scene.add.nineslice(0, 0, o.light ? 'ui_panel2' : 'ui_panel', undefined, w, h, 14, 14, 14, 14).setOrigin(0));
    if (title) {
      c.add(E.UI.text(scene, 24, 14, title, { size: o.titleSize || 22, color: E.CS.goldLight, bold: true, st: 3 }));
      const ln = scene.add.rectangle(24, 46, w - 48, 2, E.C.goldDark).setOrigin(0); c.add(ln);
      c.add(scene.add.rectangle(24 + 6, 46, 40, 2, E.C.goldLight).setOrigin(0));
    }
    c.w = w; c.h = h; return c;
  },
  frame(scene, x, y, w, h, key = 'ui_slot', insets = 6) { return scene.add.nineslice(x, y, key, undefined, w, h, insets, insets, insets, insets).setOrigin(0); },
  /* Horizontal bar with frame */
  bar(scene, x, y, w, h, pct, col, label) {
    const c = scene.add.container(x, y);
    const bg = scene.add.rectangle(0, 0, w, h, 0x05050c).setOrigin(0).setStrokeStyle(1, E.C.goldDark);
    const fill = scene.add.rectangle(1, 1, Math.max(0, (w - 2) * E.U.clamp(pct, 0, 1)), h - 2, col).setOrigin(0);
    const hi = scene.add.rectangle(1, 1, Math.max(0, (w - 2) * E.U.clamp(pct, 0, 1)), Math.max(1, (h - 2) / 3), 0xffffff, 0.22).setOrigin(0);
    c.add([bg, fill, hi]);
    if (label) c.add(E.UI.text(scene, w / 2, h / 2, label, { size: Math.min(14, h), ox: 0.5, oy: 0.5, bold: true, st: 3 }));
    return c;
  },
  portrait(scene, x, y, cls, size = 64, sel = false) {
    const c = scene.add.container(x, y);
    c.add(E.UI.frame(scene, 0, 0, size + 8, size + 8, sel ? 'ui_slot_s' : 'ui_slot', 6));
    c.add(scene.add.image(4, 4, 'port_' + cls).setOrigin(0).setDisplaySize(size, size)); return c;
  },
  /* Item slot: icon + rarity border + optional count. */
  slot(scene, x, y, size, icon, rarityCol, count, sel) {
    const c = scene.add.container(x, y);
    c.add(E.UI.frame(scene, 0, 0, size, size, sel ? 'ui_slot_s' : 'ui_slot', 6));
    if (rarityCol !== undefined && rarityCol !== null) c.add(scene.add.rectangle(2, 2, size - 4, size - 4).setOrigin(0).setStrokeStyle(2, rarityCol, 0.9));
    if (icon) c.add(scene.add.image(size / 2, size / 2, icon).setScale(Math.floor((size - 8) / 16)));
    if (count !== undefined && count !== null) c.add(E.UI.text(scene, size - 3, size - 2, count, { size: 13, ox: 1, oy: 1, bold: true, st: 3 }));
    c.setSize(size, size); c.w = size; return c;
  },
  toast(scene, msg, col = E.CS.goldLight) {
    const t = E.UI.text(scene, 640, 640, msg, { size: 20, color: col, bold: true, ox: 0.5, oy: 0.5, st: 4 });
    const w = t.width + 40, bg = scene.add.nineslice(640, 640, 'ui_panel2', undefined, w, 44, 12, 12, 12, 12);
    const c = scene.add.container(0, 0, [bg, t]).setDepth(100000).setAlpha(0);
    scene.tweens.add({ targets: c, alpha: 1, y: -14, duration: 200 });
    scene.tweens.add({ targets: c, alpha: 0, delay: 1800, duration: 400, onComplete: () => c.destroy() });
    return c;
  },
  /* Blocking confirm/alert dialog. buttons: [{label, cb, skin}] */
  modal(scene, title, msg, buttons) {
    const c = scene.add.container(0, 0).setDepth(200000);
    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.65).setInteractive(); c.add(dim);
    const w = 560, h = 230, p = E.UI.panel(scene, 640 - w / 2, 360 - h / 2, w, h, title); c.add(p);
    c.add(E.UI.text(scene, 640, 345, msg, { size: 17, ox: 0.5, oy: 0.5, wrap: w - 60, align: 'center' }));
    const n = buttons.length, bw = 170, gap = 20, x0 = 640 - (n * bw + (n - 1) * gap) / 2 + bw / 2;
    buttons.forEach((b, i) => c.add(E.UI.button(scene, x0 + i * (bw + gap), 360 + h / 2 - 42, bw, 42, b.label, () => { c.destroy(); b.cb && b.cb(); }, { skin: b.skin })));
    c.alpha = 0; scene.tweens.add({ targets: c, alpha: 1, duration: 120 });
    return c;
  },
  statRow(scene, x, y, icon, label, value, w = 200) {
    const c = scene.add.container(x, y);
    if (icon) c.add(scene.add.image(8, 9, icon).setScale(1.25));
    c.add(E.UI.text(scene, icon ? 24 : 0, 0, label, { size: 15, color: E.CS.dim }));
    c.add(E.UI.text(scene, w, 0, value, { size: 15, ox: 1, bold: true }));
    return c;
  },
  /* Pager: returns {page, items, controls} helper state; caller re-renders on change. */
  pager(scene, x, y, st, total, per, onChange) {
    const pages = Math.max(1, Math.ceil(total / per)); st.page = E.U.clamp(st.page || 0, 0, pages - 1);
    const c = scene.add.container(x, y);
    const prev = E.UI.button(scene, 0, 0, 44, 30, '', () => { st.page--; onChange(); }, { icon: 'u_up', size: 12 });
    const next = E.UI.button(scene, 54, 0, 44, 30, '', () => { st.page++; onChange(); }, { icon: 'u_down', size: 12 });
    prev.setEnabled(st.page > 0); next.setEnabled(st.page < pages - 1);
    c.add([prev, next, E.UI.text(scene, 112, 0, (st.page + 1) + ' / ' + pages, { size: 14, color: E.CS.dim, oy: 0.5 })]);
    return c;
  }
};

/* ==== src/ui/PanelScene.js ==== */
/* Base class for modal panels launched on top of Town/Menu. Subclasses implement render(). */
E.PanelScene = class extends Phaser.Scene {
  constructor(key, title, w, h) { super(key); this.panelTitle = title; this.pw = w; this.ph = h; }
  init(data) { this.opts = data || {}; this.st = {}; this.closing = false; }
  create() {
    this.dim = this.add.rectangle(640, 360, 1280, 720, 0x03030a, 0.7).setInteractive().setAlpha(0);
    this.px = (E.W - this.pw) / 2; this.py = (E.H - this.ph) / 2;
    this.shell = this.add.container(0, 0);
    this.frame = E.UI.panel(this, this.px, this.py, this.pw, this.ph, this.panelTitle);
    this.shell.add(this.frame);
    this.content = this.add.container(this.px, this.py);
    this.closeBtn = E.UI.button(this, this.px + this.pw - 30, this.py + 28, 40, 34, '', () => this.close(), { icon: 'u_x', size: 12, sfx: 'click' });
    this.input.keyboard.on('keydown-ESC', () => this.close());
    this.tweens.add({ targets: this.dim, alpha: 0.7, duration: 150 });
    this.shell.setAlpha(0); this.content.setAlpha(0); this.closeBtn.setAlpha(0);
    this.tweens.add({ targets: [this.shell, this.content, this.closeBtn], alpha: 1, duration: 160 });
    this.render();
  }
  /* Add display objects to the content container (coordinates are panel-local). */
  put(...objs) { objs.forEach(o => this.content.add(o)); return objs[0]; }
  rerender() { this.content.removeAll(true); this.render(); }
  render() { }
  toast(msg, col) { E.UI.toast(this, msg, col); }
  goldBar(x = 24, y = 10) {
    const g = this.add.container(x, y);
    g.add(this.add.image(8, 12, 'u_coin').setScale(1.5)); g.add(E.UI.text(this, 24, 2, E.U.fmt(E.G.s.gold), { size: 18, color: E.CS.goldLight, bold: true, st: 2 }));
    return g;
  }
  close() {
    if (this.closing) return; this.closing = true; E.Sfx.play('click');
    this.scene.stop();
    const p = this.opts.parent; if (p) { this.scene.resume(p); }
    if (this.opts.onClose) this.opts.onClose();
  }
};

/* ==== src/scenes/BootScene.js ==== */
/* Generates every placeholder texture + animation once, then opens the title screen. */
E.BootScene = class extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    const t0 = performance.now();
    E.UISprites.build(this); E.IconSprites.build(this); E.HeroSprites.build(this); E.MonsterSprites.build(this); E.TownSprites.build(this);
    for (const cls of E.CLASS_ORDER) {
      this.anims.create({ key: 'idle_' + cls, frames: ['idle0', 'idle1'].map(f => ({ key: 'hero_' + cls, frame: f })), frameRate: 2.2, repeat: -1 });
      this.anims.create({ key: 'walk_' + cls, frames: ['walk0', 'walk1', 'walk2', 'walk3'].map(f => ({ key: 'hero_' + cls, frame: f })), frameRate: 9, repeat: -1 });
      this.anims.create({ key: 'atk_' + cls, frames: ['atk0', 'atk1', 'atk2'].map(f => ({ key: 'hero_' + cls, frame: f })), frameRate: 9, repeat: 0 });
    }
    E.bootMs = Math.round(performance.now() - t0);
    const el = document.getElementById('boot'); if (el) { el.classList.add('hide'); setTimeout(() => el.remove(), 600); }
    this.scene.start('Menu');
  }
};

/* ==== src/scenes/MenuScene.js ==== */
/* Title screen: Continue / New Game / Load / Settings / Credits. */
E.MenuScene = class extends Phaser.Scene {
  constructor() { super('Menu'); }
  create() {
    const W = E.W, H = E.H;
    this.add.image(0, 0, 'arena_abyss').setOrigin(0).setScale(2).setTint(0x7a6aa8);
    // moon + glow
    this.add.image(930, 170, 'glow_white').setScale(5).setTint(0x8a7ae0).setAlpha(0.5);
    const moon = this.add.graphics(); moon.fillStyle(0xe8e4ff, 1); moon.fillCircle(930, 170, 62); moon.fillStyle(0xc4bce8, 1); moon.fillCircle(910, 190, 14); moon.fillCircle(950, 150, 9); moon.fillCircle(940, 200, 7);
    // castle silhouette
    const cs = this.add.graphics(); cs.fillStyle(0x0b0a1c, 1);
    const blocks = [[640, 380, 90, 200], [720, 300, 60, 280], [770, 340, 70, 240], [840, 260, 50, 320], [890, 330, 100, 250], [1000, 290, 60, 290], [1060, 350, 90, 230], [1150, 320, 70, 260], [560, 420, 90, 160], [1210, 380, 100, 200]];
    blocks.forEach(([x, y, w, h]) => { cs.fillRect(x, y, w, h); cs.fillTriangle(x - 4, y, x + w / 2, y - w * 0.9, x + w + 4, y); for (let i = 0; i < w; i += 14) cs.fillRect(x + i, y - 6, 8, 6); });
    cs.fillStyle(0xf2b84a, 0.9); blocks.forEach(([x, y, w, h], i) => { for (let k = 0; k < 3; k++) if ((i + k) % 2) cs.fillRect(x + w / 2 - 4, y + 30 + k * 50, 6, 10); });
    this.add.rectangle(0, 560, W, 200, 0x07070f, 0.92).setOrigin(0).setDepth(2);
    // hero
    const hero = this.add.sprite(300, 640, 'hero_warrior').setScale(8).setOrigin(0.5, 0.92).setDepth(3); hero.play('idle_warrior'); this.tweens.add({ targets: hero, x: 310, yoyo: true, repeat: -1, duration: 3000, ease: 'Sine.InOut' });
    // embers
    for (let i = 0; i < 40; i++) {
      const e = this.add.image(Phaser.Math.Between(0, W), Phaser.Math.Between(250, H), 'glow_purple').setScale(Phaser.Math.FloatBetween(0.12, 0.35)).setAlpha(Phaser.Math.FloatBetween(0.3, 0.9)).setBlendMode(Phaser.BlendModes.ADD).setDepth(4);
      this.tweens.add({ targets: e, y: e.y - Phaser.Math.Between(120, 300), x: e.x + Phaser.Math.Between(-60, 60), alpha: 0, duration: Phaser.Math.Between(3000, 7000), repeat: -1, delay: Phaser.Math.Between(0, 3000) });
    }
    // title
    const t1 = E.UI.text(this, 340, 84, 'ELDORIA', { size: 96, color: E.CS.goldLight, bold: true, st: 8, ox: 0.5 }).setDepth(6);
    E.UI.text(this, 340, 190, 'T H E   L A S T   B A S T I O N', { size: 22, color: E.CS.purple, bold: true, st: 4, ox: 0.5 }).setDepth(6);
    this.add.rectangle(340, 176, 440, 3, E.C.gold).setDepth(6);
    this.tweens.add({ targets: t1, scale: 1.02, yoyo: true, repeat: -1, duration: 2200, ease: 'Sine.InOut' });
    // buttons
    this.menuBtns = [];
    const mk = (i, label, cb, o) => { const b = E.UI.button(this, 1010, 320 + i * 68, 300, 54, label, cb, Object.assign({ size: 22 }, o)).setDepth(10); this.menuBtns.push(b); return b; };
    this.cont = mk(0, 'Continue', () => this.doContinue(), { skin: 'g', disabled: true, sfx: 'confirm' });
    mk(1, 'New Game', () => this.newGame(), { sfx: 'confirm' });
    mk(2, 'Load Game', () => this.openPanel('SavePanel', { mode: 'load' }));
    mk(3, 'Settings', () => this.openPanel('Settings'));
    mk(4, 'Credits', () => this.openPanel('Credits'));
    E.UI.text(this, W - 12, H - 10, 'v' + E.VERSION + ' · Placeholder art generated in code', { size: 12, color: E.CS.dim, ox: 1, oy: 1 }).setDepth(10);
    this.hint = E.UI.text(this, 340, 690, 'Click anywhere to enable audio', { size: 14, color: E.CS.dim, ox: 0.5 }).setDepth(10);
    this.input.once('pointerdown', () => { E.Sfx.init(); E.Music.start(); this.hint.setVisible(false); });
    this.events.on('resume', () => this.refreshContinue());
    this.refreshContinue();
  }
  refreshContinue() { E.Save.latest().then(i => { this.latest = i; if (this.cont && this.cont.scene) this.cont.setEnabled(i >= 0); }); }
  openPanel(key, data) { E.Sfx.init(); this.scene.pause(); this.scene.launch(key, Object.assign({ parent: 'Menu' }, data)); }
  doContinue() { E.Save.load(this.latest).then(ok => { if (ok) this.scene.start('Town'); }); }
  newGame() { E.Sfx.init(); E.Music.start(); E.G.newGame(); this.scene.start('Intro'); }
};

/* ==== src/scenes/IntroScene.js ==== */
E.IntroScene = class extends Phaser.Scene {
  constructor() { super('Intro'); }
  create() {
    this.page = 0;
    this.pages = [
      'For a thousand years the Aurelian kings held the Abyss at bay.\n\nThen, in a single blood-red night, the Royal Capital of ELDORIA fell.',
      'You are Prince Kael — last of your line.\n\nYou escaped the burning gates with a handful of loyal knights, and fled north to The Last Bastion: a crumbling border fort at the edge of the Blackwood.',
      'Rebuild the Bastion. Gather heroes. Forge arms.\n\nAnd reclaim Eldoria region by region — beginning with the Cursed Forest, where the first guardian has begun to rot.'
    ];
    this.add.image(0, 0, 'arena_abyss').setOrigin(0).setScale(2).setTint(0x403060);
    this.add.rectangle(0, 0, E.W, E.H, 0x000000, 0.55).setOrigin(0);
    const hero = this.add.sprite(1040, 560, 'hero_warrior').setScale(9).setOrigin(0.5, 0.92); hero.play('idle_warrior');
    this.txt = E.UI.text(this, 120, 240, '', { size: 28, wrap: 780, ls: 8, st: 3 });
    this.next = E.UI.button(this, 900, 640, 220, 50, 'Next', () => this.advance(), { size: 20, sfx: 'confirm' });
    E.UI.button(this, 1160, 640, 160, 50, 'Skip', () => this.finish(), { size: 18 });
    this.show();
  }
  show() {
    const s = this.pages[this.page]; this.txt.setText(''); let i = 0;
    if (this.ev) this.ev.remove();
    this.ev = this.time.addEvent({ delay: 22, repeat: s.length - 1, callback: () => { i++; this.txt.setText(s.slice(0, i)); } });
    this.next.setLabel(this.page === this.pages.length - 1 ? 'Begin' : 'Next');
  }
  advance() { if (this.ev && this.ev.getRepeatCount() > 0) { this.ev.remove(); this.txt.setText(this.pages[this.page]); return; } if (++this.page >= this.pages.length) this.finish(); else this.show(); }
  finish() { this.scene.start('Town'); }
};

/* ==== src/scenes/TownScene.js ==== */
/* The Last Bastion: top-down town hub. Buildings are real buttons that open the game systems. */
E.TownScene = class extends Phaser.Scene {
  constructor() { super('Town'); }
  create() {
    const s = E.G.s; if (!s) { this.scene.start('Menu'); return; }
    this.hudT = 0; E.Town.refreshRecruits();
    this.add.image(0, 0, 'town_ground').setOrigin(0).setScale(2);
    this.buildings = {}; this.badges = {}; this.glows = [];
    for (const k in E.TOWN_POS) {
      const p = E.TOWN_POS[k], img = this.add.image(p.x, p.y, 'b_' + (k === 'recruit' ? 'recruit' : k)).setOrigin(0.5, 1).setScale(2).setDepth(p.y);
      const w = img.width * 2, h = img.height * 2;
      img.setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 40 });
      img.on('pointerover', () => { img.setTint(0xffeebb); this.tweens.add({ targets: img, scale: 2.05, duration: 100 }); this.showTip(p.name + ' — ' + p.desc); E.Sfx.play('hover'); });
      img.on('pointerout', () => { img.clearTint(); this.tweens.add({ targets: img, scale: 2, duration: 100 }); this.showTip(''); });
      img.on('pointerdown', () => { E.Sfx.play('confirm'); this.tweens.add({ targets: img, scale: 1.97, yoyo: true, duration: 80, onComplete: () => this.openPanel(p.panel) }); });
      this.buildings[k] = img;
      // name plate
      const plate = E.UI.text(this, p.x, p.y + 10, p.name, { size: 15, color: E.CS.goldLight, bold: true, ox: 0.5, st: 4 }).setDepth(p.y + 1);
      this.add.rectangle(p.x, p.y + 20, plate.width + 18, 24, 0x07070f, 0.7).setDepth(p.y).setStrokeStyle(1, E.C.goldDark);
      // lit windows / forge glow at night
      const g = this.add.image(p.x + (k === 'smith' ? -20 : 0), p.y - h * 0.4, k === 'gate' ? 'glow_purple' : 'glow_orange').setScale(k === 'gate' ? 2.4 : 1.8).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.y + 2).setAlpha(0);
      this.glows.push({ g, base: k === 'gate' ? 0.8 : 0.6 });
      // notification badge
      const b = E.UI.text(this, p.x + w * 0.38, p.y - h + 6, '!', { size: 30, color: '#ffe070', bold: true, st: 6, ox: 0.5 }).setDepth(p.y + 5).setVisible(false);
      this.tweens.add({ targets: b, y: b.y - 8, yoyo: true, repeat: -1, duration: 500 }); this.badges[k] = b;
    }
    // fireflies and wandering villagers
    for (let i = 0; i < 26; i++) {
      const f = this.add.image(Phaser.Math.Between(20, 1260), Phaser.Math.Between(100, 640), 'glow_white').setScale(0.12).setTint(0xc49bff).setBlendMode(Phaser.BlendModes.ADD).setDepth(900).setAlpha(0.3);
      this.tweens.add({ targets: f, x: f.x + Phaser.Math.Between(-80, 80), y: f.y + Phaser.Math.Between(-60, 60), alpha: { from: 0.1, to: 0.9 }, yoyo: true, repeat: -1, duration: Phaser.Math.Between(1800, 3600), delay: Phaser.Math.Between(0, 2000) });
    }
    this.villagers = [];
    ['archer', 'cleric', 'mage', 'guardian'].forEach((cls, i) => {
      const v = this.add.sprite(300 + i * 220, 440, 'hero_' + cls).setScale(1.8).setOrigin(0.5, 0.92).setTint(0x9a8a7a); v.cls = cls; v.play('walk_' + cls); this.villagers.push(v); this.wander(v);
    });
    this.night = this.add.rectangle(0, 0, E.W, E.H, 0x080a38, 0).setOrigin(0).setDepth(5000);
    this.buildHud();
    this.events.on('resume', () => { this.refresh(true); });
    this.events.once('shutdown', () => { this.events.off('resume'); });
    this.refresh(true);
    if (!E.G.s.hintsSeen.town) { E.G.s.hintsSeen.town = true; E.UI.toast(this, 'Click a building to begin. Recruit heroes, then visit the Expedition Gate.', E.CS.goldLight); }
  }
  wander(v) {
    const nx = Phaser.Math.Between(120, 1160), ny = Phaser.Math.Between(380, 640), d = Phaser.Math.Distance.Between(v.x, v.y, nx, ny);
    v.setFlipX(nx < v.x); v.setDepth(v.y);
    this.tweens.add({ targets: v, x: nx, y: ny, duration: d * 22, onUpdate: () => v.setDepth(v.y), onComplete: () => this.time.delayedCall(Phaser.Math.Between(500, 3000), () => v.scene && this.wander(v)) });
  }
  buildHud() {
    const top = this.add.container(0, 0).setDepth(6000);
    top.add(this.add.nineslice(0, 0, 'ui_panel2', undefined, E.W, 54, 12, 12, 12, 12).setOrigin(0));
    this.goldTxt = E.UI.text(this, 52, 27, '', { size: 20, color: E.CS.goldLight, bold: true, oy: 0.5, st: 3 });
    top.add([this.add.image(30, 27, 'u_coin').setScale(2), this.goldTxt]);
    this.matTxt = {}; let x = 230;
    for (const k in E.MATS) { top.add(this.add.image(x, 27, E.MATS[k].icon).setScale(2)); this.matTxt[k] = E.UI.text(this, x + 20, 27, '0', { size: 16, bold: true, oy: 0.5, st: 3 }); top.add(this.matTxt[k]); x += 92; }
    this.clockTxt = E.UI.text(this, 780, 27, '', { size: 20, color: E.CS.blue, bold: true, oy: 0.5, st: 3 }); top.add(this.clockTxt);
    const tb = (x, icon, tip, cb) => { const b = E.UI.button(this, x, 27, 44, 38, '', cb, { icon, iconScale: 2 }); b.on('pointerover', () => this.showTip(tip)); b.on('pointerout', () => this.showTip('')); top.add(b); return b; };
    tb(1130, 'u_gear', 'Settings', () => this.openPanel('Settings'));
    tb(1182, 'u_exit', 'Return to Title (unsaved progress is lost)', () => this.quitToTitle());
    tb(1234, 'u_quest', 'Quest log (Command Hall)', () => this.openPanel('Command'));
    // bottom nav
    const nav = this.add.container(0, 0).setDepth(6000);
    nav.add(this.add.nineslice(815, 690, 'ui_panel2', undefined, 790, 60, 12, 12, 12, 12));
    const items = [['u_helm', 'Heroes', () => this.openPanel('Barracks')], ['u_bag', 'Inventory', () => this.openPanel('Inventory')], ['u_party', 'Formation', () => this.goFormation()],
      ['u_hammer', 'Craft', () => this.openPanel('Blacksmith')], ['u_save', 'Save', () => this.openPanel('SavePanel', { mode: 'save' })], ['u_load', 'Load', () => this.openPanel('SavePanel', { mode: 'load' })]];
    items.forEach(([ic, lb, cb], i) => nav.add(E.UI.button(this, 500 + i * 126, 690, 118, 44, lb, cb, { icon: ic, size: 14, iconScale: 2 })));
    this.tip = E.UI.text(this, E.W / 2, 646, '', { size: 16, color: E.CS.goldLight, ox: 0.5, oy: 0.5, bold: true, st: 4 }).setDepth(6001);
    // quest tracker
    this.qBox = this.add.container(16, 640).setDepth(6000);
    this.qBox.add(this.add.nineslice(0, 0, 'ui_panel2', undefined, 330, 64, 12, 12, 12, 12).setOrigin(0));
    this.qTitle = E.UI.text(this, 14, 8, '', { size: 15, color: E.CS.goldLight, bold: true }); this.qDesc = E.UI.text(this, 14, 32, '', { size: 13, color: E.CS.dim, wrap: 300 });
    this.qBox.add([this.qTitle, this.qDesc]);
    this.qBox.setSize(330, 64).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openPanel('Command'));
  }
  showTip(s) { this.tip.setText(s); }
  refresh(force) {
    const s = E.G.s; this.goldTxt.setText(E.U.fmt(s.gold));
    for (const k in this.matTxt) this.matTxt[k].setText(E.U.fmt(s.mats[k] || 0));
    this.clockTxt.setText(E.Clock.label());
    const q = E.Town.currentQuest();
    if (q) { const rdy = E.Town.questState(q) === 'ready'; this.qTitle.setText((rdy ? '★ ' : '◆ ') + q.title); this.qTitle.setColor(rdy ? E.CS.green : E.CS.goldLight); this.qDesc.setText(rdy ? 'Complete! Claim in the Command Hall.' : q.prog(s) + '  ' + q.desc.slice(0, 48) + '…'); }
    else { this.qTitle.setText('◆ All quests complete'); this.qDesc.setText('Eldoria is yours.'); }
    this.badges.command.setVisible(s.fortress.taxPending > 0 || E.Town.readyQuests() > 0);
    this.badges.recruit.setVisible(s.recruits.list.length > 0 && s.heroes.length < E.Town.maxRoster());
    this.badges.training.setVisible(E.Town.trainingReady());
    this.badges.gate.setVisible(false); this.badges.barracks.setVisible(s.party.length < Math.min(E.MAX_PARTY, s.heroes.length)); this.badges.smith.setVisible(false);
    const dk = E.Clock.darkness(); this.night.setFillStyle(0x080a38, dk * 0.55);
    this.glows.forEach(o => o.g.setAlpha(Math.min(1, dk * 1.4) * o.base * (0.9 + Math.random() * 0.1)));
    this.villagers.forEach(v => v.setAlpha(dk > 0.8 ? 0.6 : 1));
  }
  update(t, dtms) {
    E.Clock.advance(dtms / 1000 * E.Clock.RATE);
    this.hudT += dtms; if (this.hudT > 250) { this.hudT = 0; this.refresh(); }
    const ev = E.Town.pollEvent();
    if (ev) { E.Sfx.play(ev.special ? 'warn' : 'confirm'); this.openPanel('Event', { event: ev }); }
  }
  openPanel(key, data) { this.showTip(''); this.scene.pause(); this.scene.launch(key, Object.assign({ parent: 'Town' }, data)); }
  goFormation() { this.scene.start('Formation', { mode: 'edit' }); }
  quitToTitle() {
    E.UI.modal(this, 'Return to Title?', 'Unsaved progress will be lost. There is no autosave — use Save first.', [
      { label: 'Stay' }, { label: 'Quit to Title', skin: 'g', cb: () => this.scene.start('Menu') }]).setDepth(9000);
  }
};

/* ==== src/scenes/FormationScene.js ==== */
/* Formation: pick the party (max 5) and drag heroes freely inside the deploy zone. No overlaps allowed. */
E.FormationScene = class extends Phaser.Scene {
  constructor() { super('Formation'); }
  init(data) { this.mode = data.mode || 'edit'; this.d = data.dungeon || null; this.stage = data.stage || 0; this.st = { page: 0 }; }
  create() {
    const s = E.G.s, Z = E.Form.zone, pal = this.d ? this.d.pal : 'forest';
    this.add.image(0, 0, 'arena_' + pal).setOrigin(0).setScale(2);
    this.add.rectangle(0, 0, E.W, E.H, 0x000000, 0.25).setOrigin(0);
    // deploy zone
    this.zone = this.add.rectangle(Z.x0 - 40, Z.y0 - 60, Z.x1 - Z.x0 + 80, Z.y1 - Z.y0 + 100, 0x8a4be8, 0.12).setOrigin(0).setStrokeStyle(3, E.C.purple, 0.9);
    this.tweens.add({ targets: this.zone, alpha: 0.6, yoyo: true, repeat: -1, duration: 1200 });
    E.UI.text(this, Z.x0 - 30, Z.y0 - 52, 'DEPLOY ZONE — drag heroes anywhere inside', { size: 14, color: E.CS.purple, bold: true, st: 3 });
    this.add.rectangle(Z.x1 + 130, 360, 3, 560, E.C.red, 0.35);
    E.UI.text(this, 700, 360, 'ENEMY\nSIDE', { size: 16, color: E.CS.red, ox: 0.5, oy: 0.5, align: 'center', bold: true, st: 3 }).setAlpha(0.6);
    // header
    const hdr = this.add.nineslice(0, 0, 'ui_panel2', undefined, E.W, 54, 12, 12, 12, 12).setOrigin(0).setDepth(100);
    E.UI.text(this, 24, 27, this.mode === 'battle' ? 'Formation — ' + this.d.stages[this.stage].name : 'Formation', { size: 22, bold: true, color: E.CS.goldLight, oy: 0.5, st: 3 }).setDepth(101);
    this.sprites = {}; this.labels = {};
    s.party.forEach(id => this.makeSprite(E.G.hero(id)));
    this.panel = this.add.container(0, 0).setDepth(100);
    this.input.on('dragstart', (p, o) => { if (!o.heroId) return; o.setScale(3.25); o.setDepth(500); E.Sfx.play('click'); });
    this.input.on('drag', (p, o, x, y) => {
      if (!o.heroId) return; const q = E.Form.clampPos({ x, y }); o.setPosition(q.x, q.y);
      o.setTint(E.Form.overlaps(q, this.othersOf(o.heroId)) ? 0xff7070 : 0xffffff);
    });
    this.input.on('dragend', (p, o) => {
      if (!o.heroId) return; o.clearTint(); o.setScale(3);
      const q = E.Form.freeSpot({ x: o.x, y: o.y }, this.othersOf(o.heroId));
      this.tweens.add({ targets: o, x: q.x, y: q.y, duration: 140, ease: 'Sine.Out' });
      s.formation.pos[o.heroId] = { x: Math.round(q.x), y: Math.round(q.y) };
      if (q.x !== o.x || q.y !== o.y) E.Sfx.play('error');
    });
    this.buildPanel();
    this.input.keyboard.on('keydown-ESC', () => this.back());
  }
  othersOf(id) { return Object.keys(this.sprites).filter(k => k !== id).map(k => ({ x: this.sprites[k].x, y: this.sprites[k].y })); }
  makeSprite(h) {
    const p = E.G.s.formation.pos[h.id] || { x: 260, y: 340 };
    const sp = this.add.sprite(p.x, p.y, 'hero_' + h.cls).setScale(3).setOrigin(0.5, 0.92); sp.heroId = h.id; sp.play('idle_' + h.cls);
    sp.setInteractive({ draggable: true, useHandCursor: true, pixelPerfect: false }); this.sprites[h.id] = sp;
    this.labels[h.id] = E.UI.text(this, p.x, p.y + 10, h.name, { size: 14, bold: true, ox: 0.5, st: 4, color: E.CS.goldLight });
    sp.shadow = this.add.ellipse(p.x, p.y, 48, 16, 0, 0.4);
  }
  update() {
    for (const id in this.sprites) { const sp = this.sprites[id]; sp.setDepth(sp.y); this.labels[id].setPosition(sp.x, sp.y + 8).setDepth(sp.y + 1); sp.shadow.setPosition(sp.x, sp.y - 2).setDepth(sp.y - 1); }
  }
  removeSprite(id) { const sp = this.sprites[id]; if (!sp) return; sp.shadow.destroy(); sp.destroy(); this.labels[id].destroy(); delete this.sprites[id]; delete this.labels[id]; }
  syncPositions() { const s = E.G.s; for (const id in this.sprites) { const p = s.formation.pos[id]; if (p) this.tweens.add({ targets: this.sprites[id], x: p.x, y: p.y, duration: 250, ease: 'Sine.InOut' }); } }
  toggle(h) {
    const s = E.G.s;
    if (s.party.includes(h.id)) {
      if (s.party.length <= 1) { E.UI.toast(this, 'The party needs at least one hero', E.CS.red); E.Sfx.play('error'); return; }
      s.party = s.party.filter(i => i !== h.id); this.removeSprite(h.id);
    } else {
      if (s.party.length >= E.MAX_PARTY) { E.UI.toast(this, 'Party is full (5 heroes)', E.CS.red); E.Sfx.play('error'); return; }
      s.party.push(h.id); s.formation.pos[h.id] = E.Form.freeSpot({ x: 270, y: 340 }, this.othersOf(h.id)); this.makeSprite(h);
      this.sprites[h.id].setAlpha(0); this.tweens.add({ targets: this.sprites[h.id], alpha: 1, duration: 200 });
    }
    E.Sfx.play('click'); this.buildPanel();
  }
  buildPanel() {
    const s = E.G.s, st = this.st, per = 5; this.panel.removeAll(true);
    const P = this.panel, add = o => { P.add(o); return o; };
    add(E.UI.panel(this, 810, 66, 456, 640, 'Party', { light: false, titleSize: 20 }));
    add(E.UI.text(this, 1240, 80, s.party.length + ' / ' + E.MAX_PARTY, { size: 18, bold: true, ox: 1, color: E.CS.goldLight }));
    s.heroes.slice(st.page * per, st.page * per + per).forEach((h, i) => {
      const y = 112 + i * 60, on = s.party.includes(h.id);
      const row = add(E.UI.frame(this, 826, y, 424, 54, on ? 'ui_row_s' : 'ui_row')); row.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggle(h));
      add(E.UI.portrait(this, 832, y + 1, h.cls, 44));
      add(E.UI.text(this, 890, y + 7, h.name, { size: 17, bold: true })); add(E.UI.text(this, 890, y + 30, 'Lv ' + h.level + ' ' + E.Hero.title(h) + ' · P' + E.Hero.power(h), { size: 12, color: E.CS.blue }));
      add(E.UI.text(this, 1236, y + 27, on ? '✔ IN PARTY' : 'bench', { size: 12, bold: true, ox: 1, oy: 0.5, color: on ? E.CS.green : E.CS.dim }));
    });
    add(E.UI.pager(this, 826, 430, st, s.heroes.length, per, () => this.buildPanel()));
    add(E.UI.button(this, 1160, 444, 180, 34, 'Auto Arrange', () => {
      const hs = s.party.map(id => E.G.hero(id)); E.Form.autoArrange(hs, s.formation.pos); this.syncPositions(); E.Sfx.play('confirm');
    }, { size: 14, icon: 'u_star', iconScale: 1.5 }));
    add(E.UI.text(this, 826, 486, 'Formation Presets', { size: 15, bold: true, color: E.CS.goldLight }));
    for (let i = 0; i < 3; i++) {
      const y = 516 + i * 40, pr = s.formation.presets[i];
      add(E.UI.text(this, 826, y, 'Preset ' + (i + 1) + (pr ? '  (' + pr.party.length + ' heroes)' : '  — empty'), { size: 14, color: pr ? E.CS.text : E.CS.dim, oy: 0.5 }));
      add(E.UI.button(this, 1090, y, 90, 32, 'Load', () => {
        if (E.Form.loadPreset(s, i)) { Object.keys(this.sprites).forEach(id => this.removeSprite(id)); s.party.forEach(id => this.makeSprite(E.G.hero(id))); this.buildPanel(); E.Sfx.play('confirm'); E.UI.toast(this, 'Preset ' + (i + 1) + ' loaded'); }
      }, { size: 14, disabled: !pr }));
      add(E.UI.button(this, 1190, y, 90, 32, 'Save', () => { E.Form.savePreset(s, i); E.Sfx.play('confirm'); E.UI.toast(this, 'Preset ' + (i + 1) + ' saved (in memory — use Save Game to keep it)'); this.buildPanel(); }, { size: 14, skin: 'g' }));
    }
    // enemy preview
    if (this.mode === 'battle') {
      const en = E.Run.buildEnemies(this.d, this.stage), cnt = {};
      en.forEach(e => { const k = e.boss ? 'boss' : e.kind; cnt[k] = cnt[k] || { e, n: 0 }; cnt[k].n++; });
      add(E.UI.text(this, 826, 636, 'Enemies:', { size: 14, bold: true, color: E.CS.red, oy: 0.5 }));
      Object.values(cnt).forEach((c, i) => { const sp = this.add.image(920 + i * 62, 650, `mon_${c.e.shape}_${c.e.pal}`, 'idle0').setScale(c.e.boss ? 0.8 : 1.5).setOrigin(0.5, 0.9); add(sp); add(E.UI.text(this, 920 + i * 62 + 14, 656, '×' + c.n, { size: 13, bold: true, st: 3 })); });
    }
    add(E.UI.button(this, 100, 680, 160, 42, 'Back', () => this.back(), { size: 18, icon: 'u_home' }).setDepth(101));
    if (this.mode === 'battle') add(E.UI.button(this, 1110, 680, 250, 44, 'Start Battle', () => this.start(), { size: 20, skin: 'g', icon: 'u_swords', sfx: 'confirm' }));
    else add(E.UI.button(this, 1110, 680, 250, 44, 'Done', () => this.back(), { size: 20, skin: 'g' }));
    if (this.mode === 'edit') add(E.UI.text(this, 640, 690, 'Positions are used when a battle starts.', { size: 13, color: E.CS.dim, ox: 0.5 }));
  }
  back() { E.Form.sanitize(E.G.s); this.scene.start('Town'); }
  start() { E.Form.sanitize(E.G.s); this.scene.start('Battle', { dungeon: this.d, stage: this.stage }); }
};

/* ==== src/scenes/BattleScene.js ==== */
/* Battle scene: arena + HUD (hero cards, skills/ultimates, tactical commands, pause, speed). */
E.BattleScene = class extends Phaser.Scene {
  constructor() { super('Battle'); }
  init(data) { this.d = data.dungeon; this.stage = data.stage; }
  create() {
    this.paused = false; this.speed = 1; this.resultShown = false; this.cards = [];
    this.add.image(0, 0, 'arena_' + this.d.pal).setOrigin(0).setScale(2).setDepth(0);
    this.battle = new E.Battle(this, this.d, this.stage); const b = this.battle;
    // clicking enemies sets focus target
    this.input.on('gameobjectdown', (p, o) => { if (o.unit && o.unit.side === 'enemy' && o.unit.alive) this.setFocus(o.unit); });
    this.buildHud();
    this.banner = E.UI.text(this, 640, 150, '', { size: 34, bold: true, ox: 0.5, oy: 0.5, st: 7 }).setDepth(200000).setAlpha(0);
    this.pauseTxt = E.UI.text(this, 640, 360, 'TACTICAL PAUSE', { size: 44, bold: true, ox: 0.5, oy: 0.5, color: E.CS.goldLight, st: 8 }).setDepth(200000).setVisible(false);
    this.pauseSub = E.UI.text(this, 640, 405, 'Give orders or cast skills, then press Space to resume', { size: 18, ox: 0.5, oy: 0.5, color: E.CS.text, st: 5 }).setDepth(200000).setVisible(false);
    const kb = this.input.keyboard;
    kb.on('keydown-SPACE', () => this.togglePause());
    const cmds = { A: 'advance', H: 'hold', G: 'regroup', S: 'spread', R: 'retreat' };
    for (const k in cmds) kb.on('keydown-' + k, () => this.setCmd(cmds[k]));
    kb.on('keydown', ev => { const m = /^Digit([1-5])$/.exec(ev.code); if (m) { const c = this.cards[+m[1] - 1]; if (c) this.cast(c.u, ev.shiftKey ? 'ult' : 'skill'); } });
    this.showBanner(this.d.stages[this.stage].boss ? 'BOSS: ' + b.boss.name : this.d.stages[this.stage].name, this.d.stages[this.stage].boss ? 0xff6b5a : 0xf2d98a, 2.2);
    if (!E.Settings.d.tipsShown) { E.Settings.set('tipsShown', true); E.UI.toast(this, 'Click an enemy to focus · Space = tactical pause · 1–5 skills · Shift+1–5 ultimates', E.CS.goldLight); }
    this.events.once('shutdown', () => { if (this.battle) this.battle.destroy(); this.input.off('gameobjectdown'); });
  }
  showBanner(text, col, dur = 1.4) {
    this.banner.setText(text).setColor(E.U.hex(col)).setAlpha(1).setScale(1.25); this.tweens.killTweensOf(this.banner);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 200 }); this.tweens.add({ targets: this.banner, alpha: 0, delay: dur * 1000, duration: 400 });
  }
  setFocus(u) { const b = this.battle; b.focus = (b.focus === u) ? null : u; E.Sfx.play('click'); if (b.focus) this.showBanner('Focus: ' + u.name, 0xff6b5a, 0.8); this.refreshCmds(); }
  setCmd(c) { this.battle.cmd = c; E.Sfx.play('click'); this.refreshCmds(); }
  togglePause() { if (this.battle.over) return; this.paused = !this.paused; this.pauseTxt.setVisible(this.paused); this.pauseSub.setVisible(this.paused); this.pauseBtn.setLabel(this.paused ? 'Resume' : 'Pause'); this.pauseBtn.setSelected(this.paused); E.Sfx.play('click'); }
  cast(u, kind) { if (!E.Skills.cast(u, kind, this.battle)) E.Sfx.play('error'); }
  buildHud() {
    const b = this.battle, D = 150000;
    this.add.nineslice(0, 0, 'ui_panel2', undefined, E.W, 54, 12, 12, 12, 12).setOrigin(0).setDepth(D);
    E.UI.button(this, 70, 27, 120, 38, 'Flee', () => this.flee(), { size: 15, icon: 'c_retreat', iconScale: 1.5 }).setDepth(D + 1);
    E.UI.text(this, 150, 27, this.d.name + ' · ' + this.d.stages[this.stage].name, { size: 18, bold: true, color: E.CS.goldLight, oy: 0.5, st: 3 }).setDepth(D + 1);
    this.pauseBtn = E.UI.button(this, 1000, 27, 140, 38, 'Pause', () => this.togglePause(), { size: 15, icon: 'u_pause', iconScale: 1.5 }).setDepth(D + 1);
    this.speedBtn = E.UI.button(this, 1116, 27, 82, 38, 'x1', () => { this.speed = this.speed === 1 ? 2 : 1; this.speedBtn.setLabel('x' + this.speed); this.speedBtn.setSelected(this.speed === 2); }, { size: 16 }).setDepth(D + 1);
    this.autoBtn = E.UI.button(this, 1216, 27, 100, 38, 'Auto: OFF', () => { b.autoSkills = !b.autoSkills; this.autoBtn.setLabel('Auto: ' + (b.autoSkills ? 'ON' : 'OFF')); this.autoBtn.setSelected(b.autoSkills); }, { size: 13 }).setDepth(D + 1);
    // boss bar
    if (b.boss) { this.bossBarBg = this.add.rectangle(640, 82, 560, 18, 0x05050c).setStrokeStyle(2, E.C.gold).setDepth(D); this.bossBar = this.add.rectangle(360, 82, 556, 14, 0xc0392b).setOrigin(0, 0.5).setDepth(D + 1); this.bossTxt = E.UI.text(this, 640, 82, b.boss.name, { size: 13, bold: true, ox: 0.5, oy: 0.5, st: 4 }).setDepth(D + 2); }
    // bottom bar
    this.add.nineslice(0, 600, 'ui_panel2', undefined, E.W, 120, 12, 12, 12, 12).setOrigin(0).setDepth(D);
    b.heroes.forEach((u, i) => {
      const x = 14 + i * 152, y = 608, c = { u };
      const g = this.add.container(x, y).setDepth(D + 1);
      g.add(this.add.nineslice(0, 0, 'ui_row', undefined, 146, 106, 6, 6, 6, 6).setOrigin(0));
      g.add(this.add.image(6, 6, 'port_' + u.hero.cls).setOrigin(0).setDisplaySize(40, 40));
      g.add(E.UI.text(this, 52, 6, u.name, { size: 14, bold: true }));
      g.add(E.UI.text(this, 52, 24, 'Lv ' + u.hero.level, { size: 11, color: E.CS.blue }));
      c.hpBg = this.add.rectangle(6, 54, 134, 9, 0x05050c).setOrigin(0).setStrokeStyle(1, E.C.goldDark); c.hp = this.add.rectangle(7, 55, 132, 7, 0x4caf50).setOrigin(0);
      c.hpTxt = E.UI.text(this, 73, 58.5, '', { size: 9, bold: true, ox: 0.5, oy: 0.5, st: 3 }); g.add([c.hpBg, c.hp, c.hpTxt]);
      const mk = (kind, bx, label, key) => {
        const w = 64, bt = this.add.container(bx, 68); bt.add(this.add.nineslice(0, 0, 'ui_btn_n', undefined, w, 32, 10, 10, 8, 8).setOrigin(0));
        bt.add(E.UI.text(this, 4, 4, key, { size: 9, color: E.CS.dim }));
        bt.add(E.UI.text(this, w / 2, 17, label, { size: 12, bold: true, ox: 0.5, oy: 0.5, color: E.CS.goldLight, st: 2 }));
        const ov = this.add.rectangle(0, 0, w, 32, 0x000000, 0.6).setOrigin(0); bt.add(ov);
        const glow = this.add.rectangle(0, 0, w, 32).setOrigin(0).setStrokeStyle(2, 0xffe070).setVisible(false); bt.add(glow);
        bt.setSize(w, 32); bt.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, 32), Phaser.Geom.Rectangle.Contains); bt.input.cursor = 'pointer';
        bt.on('pointerdown', () => this.cast(u, kind)); g.add(bt); return { bt, ov, glow, w };
      };
      c.sk = mk('skill', 6, 'Skill', String(i + 1)); c.ul = mk('ult', 76, 'Ultimate', '⇧' + (i + 1));
      this.cards.push(Object.assign(c, { g })); this.add.existing(g);
    });
    // commands
    const cmds = [['focus', 'Focus', 'c_focus'], ['hold', 'Hold', 'c_hold'], ['regroup', 'Regroup', 'c_regroup'], ['spread', 'Spread', 'c_spread'], ['advance', 'Advance', 'c_advance'], ['retreat', 'Retreat', 'c_retreat']];
    this.cmdBtns = {};
    this.add.text(0, 0, '').setVisible(false);
    E.UI.text(this, 800, 606, 'Tactical Commands', { size: 12, color: E.CS.dim }).setDepth(D + 1);
    cmds.forEach(([k, label, icon], i) => {
      const bt = E.UI.button(this, 880 + (i % 3) * 150, 640 + Math.floor(i / 3) * 52, 144, 46, label, () => k === 'focus' ? this.autoFocus() : this.setCmd(k), { size: 15, icon, iconScale: 2 }).setDepth(D + 1);
      this.cmdBtns[k] = bt;
    });
    this.refreshCmds();
  }
  autoFocus() {
    const b = this.battle; if (b.focus) { b.focus = null; this.refreshCmds(); E.Sfx.play('click'); return; }
    const foes = b.enemies.filter(e => e.alive).sort((a, c) => (c.isBoss - a.isBoss) || (c.elite - a.elite) || (c.atk - a.atk));
    if (foes[0]) this.setFocus(foes[0]);
  }
  refreshCmds() { for (const k in this.cmdBtns) this.cmdBtns[k].setSelected(k === 'focus' ? !!this.battle.focus : k === this.battle.cmd); }
  flee() {
    E.UI.modal(this, 'Flee the battle?', 'You will return to the Bastion with no rewards.', [{ label: 'Keep fighting' }, { label: 'Flee', skin: 'g', cb: () => this.toTown(60) }]).setDepth(300000);
  }
  toTown(mins) { E.Clock.advance(mins); this.scene.start('Town'); }
  update(t, dtms) {
    const b = this.battle, dt = Math.min(0.05, dtms / 1000);
    b.update(this.paused ? 0 : dt * this.speed);
    this.updateHud();
    if (b.over && !this.resultShown && b.afterOver > 1.1) this.showResult();
  }
  updateHud() {
    const b = this.battle;
    this.cards.forEach(c => {
      const u = c.u, pct = u.hp / u.maxHp, cls = E.CLASSES[u.hero.cls];
      c.hp.width = 132 * Math.max(0, pct); c.hp.fillColor = pct > 0.5 ? 0x4caf50 : pct > 0.25 ? 0xe0a030 : 0xc0392b; c.hpTxt.setText(Math.max(0, Math.ceil(u.hp)) + ' / ' + u.maxHp);
      c.g.setAlpha(u.alive ? 1 : 0.45);
      const skReady = u.alive && u.skillT <= 0; c.sk.ov.width = skReady ? 0 : c.sk.w * Math.min(1, Math.max(0, u.skillT) / cls.skill.cd); c.sk.glow.setVisible(skReady);
      const unl = E.Hero.ultUnlocked(u.hero), ulReady = u.alive && unl && u.ult >= 100;
      c.ul.ov.width = !unl ? c.ul.w : ulReady ? 0 : c.ul.w * (1 - u.ult / 100); c.ul.glow.setVisible(ulReady);
    });
    if (b.boss && this.bossBar) { this.bossBar.width = 556 * Math.max(0, b.boss.hp / b.boss.maxHp); this.bossBar.fillColor = b.boss.enraged ? 0xff3b2a : 0xc0392b; this.bossTxt.setText(b.boss.name + (b.boss.enraged ? '  — ENRAGED' : '')); }
  }
  showResult() {
    this.resultShown = true; const b = this.battle, win = b.over === 'win', s = E.G.s;
    let out = null, levelUps = [];
    if (win) {
      out = E.Run.victory(this.d, this.stage);
      b.heroes.forEach(u => { const gained = E.Hero.addXp(u.hero, u.alive ? out.xp : out.xp * 0.5); if (gained) levelUps.push(u.hero.name + ' → Lv ' + u.hero.level); });
      E.Sfx.play('victory');
    } else E.Sfx.play('defeat');
    const W = 760, H = 500, x0 = (E.W - W) / 2, y0 = 100, D = 250000;
    const c = this.add.container(0, 0).setDepth(D); c.add(this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.6).setInteractive());
    c.add(E.UI.panel(this, x0, y0, W, H, ''));
    const t = E.UI.text(this, 640, y0 + 50, win ? 'VICTORY' : 'DEFEAT', { size: 56, bold: true, ox: 0.5, oy: 0.5, color: win ? E.CS.goldLight : E.CS.red, st: 8 }); c.add(t);
    this.tweens.add({ targets: t, scale: { from: 1.5, to: 1 }, duration: 350, ease: 'Back.Out' });
    let y = y0 + 110;
    if (win) {
      const line = (icon, str, col) => { c.add(this.add.image(x0 + 60, y + 10, icon).setScale(2)); c.add(E.UI.text(this, x0 + 90, y, str, { size: 20, bold: true, color: col || E.CS.text, st: 2 })); y += 36; };
      line('u_coin', '+' + E.U.fmt(out.gold) + ' gold', E.CS.goldLight); line('u_star', '+' + E.U.fmt(out.xp) + ' XP to each hero (fallen heroes: half)', E.CS.purple);
      const mats = Object.keys(out.mats); if (mats.length) { mats.forEach((m, i) => { c.add(this.add.image(x0 + 60 + (i % 3) * 220, y + 10, E.MATS[m].icon).setScale(2)); c.add(E.UI.text(this, x0 + 86 + (i % 3) * 220, y, '+' + out.mats[m] + ' ' + E.MATS[m].name.split(' ')[0], { size: 17, st: 2 })); if (i % 3 === 2) y += 32; }); y += 40; }
      out.gear.forEach(g => { c.add(E.UI.slot(this, x0 + 56, y - 4, 44, E.Items.icon(g), E.Items.rarity(g).color)); c.add(E.UI.text(this, x0 + 110, y + 4, 'Dropped: ' + E.Items.name(g), { size: 19, bold: true, color: E.Items.rarity(g).css, st: 2 })); y += 52; });
      if (levelUps.length) { c.add(E.UI.text(this, x0 + 60, y, 'LEVEL UP!  ' + levelUps.join('   '), { size: 18, bold: true, color: E.CS.green, wrap: 640, st: 3 })); y += 62; E.Sfx.play('levelup'); }
      if (out.bossFirst) c.add(E.UI.text(this, 640, y + 4, '★ Boss defeated — new region unlocked! ★', { size: 20, bold: true, ox: 0.5, color: E.CS.goldLight, st: 3 }));
      else if (out.firstClear && this.stage < 3) c.add(E.UI.text(this, 640, y + 4, 'Next stage unlocked', { size: 17, ox: 0.5, color: E.CS.blue, st: 2 }));
    } else {
      c.add(E.UI.text(this, 640, y + 40, 'Your heroes have fallen.\nRegroup, change your formation or train, then try again.', { size: 20, ox: 0.5, align: 'center', color: E.CS.dim, ls: 8 }));
    }
    const by = y0 + H - 50;
    c.add(E.UI.button(this, 640 - 250, by, 230, 46, 'Return to Town', () => this.toTown(120), { size: 18 }));
    c.add(E.UI.button(this, 640, by, 230, 46, win ? 'Replay' : 'Retry', () => this.scene.start('Formation', { mode: 'battle', dungeon: this.d, stage: this.stage }), { size: 18, skin: 'g', sfx: 'confirm' }));
    const canNext = win && this.d.id !== 'raid' && this.stage < this.d.stages.length - 1;
    c.add(E.UI.button(this, 640 + 250, by, 230, 46, 'Next Stage', () => this.scene.start('Formation', { mode: 'battle', dungeon: this.d, stage: this.stage + 1 }), { size: 18, disabled: !canNext }));
    c.setAlpha(0); this.tweens.add({ targets: c, alpha: 1, duration: 300 });
  }
};

/* ==== src/scenes/panels/EventPanel.js ==== */
/* Random / timed town events. Must be resolved by choosing an option. */
E.EventPanel = class extends E.PanelScene {
  constructor() { super('Event', '', 780, 430); }
  init(data) { super.init(data); this.ev = data.event; this.panelTitle = this.ev.title; this.result = null; }
  create() { super.create(); this.closeBtn.setVisible(false).disableInteractive(); this.input.keyboard.removeAllListeners(); }
  close() { if (!this.result) return; super.close(); }
  render() {
    const ev = this.ev, s = E.G.s;
    this.put(E.UI.text(this, 40, 74, ev.special ? '🌑 ' + 'The sky turns red…' : 'Day ' + E.G.day() + ' · ' + E.U.clockStr(s.time), { size: 15, color: ev.special ? E.CS.red : E.CS.dim }));
    this.put(E.UI.text(this, 40, 108, this.result ? this.result.text : ev.text, { size: 21, wrap: 700, ls: 8 }));
    if (!this.result) {
      ev.choices.forEach((c, i) => {
        const ok = !c.cond || c.cond(s);
        this.put(E.UI.button(this, 390, 250 + i * 58, 640, 46, c.label, () => {
          this.result = c.do(s); E.Sfx.play(this.result.battle ? 'warn' : 'coin'); this.rerender();
        }, { size: 18, disabled: !ok, skin: ev.special && i === 0 ? 'g' : 'n' }));
      });
    } else {
      this.put(E.UI.button(this, 390, 360, 300, 50, this.result.battle ? 'To the walls!' : 'Continue', () => {
        if (this.result.battle) { this.scene.stop('Town'); this.scene.start('Formation', { mode: 'battle', dungeon: E.Dungeons.raid(E.G.day()), stage: 0 }); }
        else this.close();
      }, { size: 20, sfx: 'confirm', skin: 'g' }));
    }
  }
};

/* ==== src/scenes/panels/BarracksPanel.js ==== */
/* Barracks: roster, character sheet, skills, equipment, promotion, party membership. */
E.BarracksPanel = class extends E.PanelScene {
  constructor() { super('Barracks', 'Barracks — Heroes', 1200, 650); }
  init(d) { super.init(d); this.st = { page: 0, sel: E.G.s.heroes[0] && E.G.s.heroes[0].id, pick: null }; }
  get hero() { return E.G.hero(this.st.sel); }
  render() {
    const s = E.G.s, st = this.st, per = 8;
    this.put(this.goldBar(1000, 10));
    // ---- roster list ----
    this.put(E.UI.text(this, 24, 62, 'Roster ' + s.heroes.length + '/' + E.Town.maxRoster() + '   Party ' + s.party.length + '/' + E.MAX_PARTY, { size: 15, color: E.CS.dim }));
    this.put(E.UI.pager(this, 24, 612, st, s.heroes.length, per, () => this.rerender()));
    s.heroes.slice(st.page * per, st.page * per + per).forEach((h, i) => {
      const y = 92 + i * 62, inParty = s.party.includes(h.id), sel = h.id === st.sel;
      const row = this.put(E.UI.frame(this, 24, y, 340, 56, sel ? 'ui_row_s' : 'ui_row'));
      row.setInteractive({ useHandCursor: true }).on('pointerdown', () => { st.sel = h.id; st.pick = null; E.Sfx.play('click'); this.rerender(); });
      this.put(E.UI.portrait(this, 30, y + 2, h.cls, 44));
      this.put(E.UI.text(this, 90, y + 8, h.name + (h.prince ? ' ♛' : ''), { size: 18, bold: true, color: sel ? E.CS.goldLight : E.CS.text }));
      this.put(E.UI.text(this, 90, y + 32, 'Lv ' + h.level + ' ' + E.Hero.title(h), { size: 13, color: E.CS.blue }));
      if (inParty) this.put(E.UI.text(this, 350, y + 28, 'PARTY', { size: 12, bold: true, color: E.CS.green, ox: 1, oy: 0.5, st: 2 }));
    });
    const h = this.hero; if (!h) return;
    if (st.pick) return this.renderPicker(h);
    this.renderSheet(h);
  }
  renderSheet(h) {
    const s = E.G.s, st = this.st, cls = E.CLASSES[h.cls], S = E.Hero.stats(h), X = 390;
    // portrait + animated sprite
    this.put(E.UI.frame(this, X, 70, 210, 250, 'ui_slot'));
    const sp = this.add.sprite(X + 105, 280, 'hero_' + h.cls).setScale(6.4).setOrigin(0.5, 0.92); sp.play('idle_' + h.cls);
    sp.setInteractive({ useHandCursor: true }).on('pointerdown', () => { sp.play('atk_' + h.cls); E.Sfx.play('hit'); sp.once('animationcomplete', () => sp.play('idle_' + h.cls)); });
    this.put(sp);
    this.put(E.UI.text(this, X + 105, 306, 'click to preview attack', { size: 10, color: E.CS.dim, ox: 0.5 }));
    // name / level / xp
    const nx = X + 230;
    this.put(E.UI.text(this, nx, 70, h.name + (h.prince ? '  ♛ Prince' : ''), { size: 28, bold: true, color: E.CS.goldLight, st: 3 }));
    this.put(E.UI.text(this, nx, 106, 'Lv ' + h.level + '  ·  ' + E.Hero.title(h) + '  ·  ' + cls.role + '  ·  Tier ' + (h.tier + 1), { size: 16, color: E.CS.blue }));
    const need = E.Hero.xpNeed(h.level), maxed = h.level >= E.MAX_LEVEL;
    this.put(E.UI.bar(this, nx, 134, 300, 18, maxed ? 1 : h.xp / need, E.C.purple, maxed ? 'MAX' : h.xp + ' / ' + need + ' XP'));
    this.put(E.UI.text(this, nx + 320, 135, 'Power ' + E.Hero.power(h), { size: 16, bold: true, color: E.CS.goldLight }));
    const rows = [['u_heart', 'HP', S.hp], ['u_atk', 'ATK', S.atk], ['u_def', 'DEF', S.def], [null, 'SPD', S.spd], [null, 'RANGE', S.range], [null, 'CRIT', Math.round(S.crit * 100) + '%']];
    rows.forEach((r, i) => this.put(E.UI.statRow(this, nx + (i % 2) * 230, 170 + Math.floor(i / 2) * 26, r[0], r[1], (typeof r[2] === 'number' ? E.U.fmt(r[2]) : r[2]), 200)));
    // equipment slots
    this.put(E.UI.text(this, nx, 256, 'Equipment', { size: 15, bold: true, color: E.CS.goldLight }));
    E.SLOTS.forEach((sl, i) => {
      const uid = h.equip[sl], g = uid && E.Inv.gearByUid(uid), x = nx + i * 150;
      const slot = this.put(E.UI.slot(this, x, 280, 64, g ? E.Items.icon(g) : null, g ? E.Items.rarity(g).color : null, null, false));
      if (!g) this.put(E.UI.text(this, x + 32, 312, E.SLOT_NAMES[sl], { size: 10, color: E.CS.dim, ox: 0.5, oy: 1 }));
      slot.setInteractive({ useHandCursor: true }).on('pointerdown', () => { st.pick = sl; E.Sfx.play('click'); this.rerender(); });
      this.put(E.UI.text(this, x + 72, 282, g ? E.Items.name(g) : '— empty —', { size: 12, bold: true, color: g ? E.Items.rarity(g).css : E.CS.dim, wrap: 76 }));
      if (g) this.put(E.UI.text(this, x + 72, 322, E.Items.statLine(E.Items.stats(g)).replace(/  /g, '\n'), { size: 11, color: E.CS.dim, ls: 1 }));
    });
    // skills
    this.put(E.UI.text(this, X, 350, 'Skills', { size: 15, bold: true, color: E.CS.goldLight }));
    const skills = [['skill', 'Active · ' + cls.skill.cd + 's cooldown', cls.skill.desc, true], ['ult', 'Ultimate · unlocks at Lv ' + cls.ult.unlock, cls.ult.desc, E.Hero.ultUnlocked(h)]];
    skills.forEach((k, i) => {
      const y = 374 + i * 62, name = E.Hero.skillName(h, k[0]);
      this.put(E.UI.frame(this, X, y, 770, 56, 'ui_row'));
      this.put(E.UI.text(this, X + 12, y + 6, (k[3] ? '◆ ' : '🔒 ') + name, { size: 16, bold: true, color: k[3] ? E.CS.purple : E.CS.dim }), E.UI.text(this, X + 330, y + 8, k[1], { size: 12, color: E.CS.dim }));
      this.put(E.UI.text(this, X + 12, y + 30, k[2] + (h.tier ? '  (Power +' + h.tier * 25 + '%)' : ''), { size: 12, color: k[3] ? E.CS.text : E.CS.dim, wrap: 740 }));
    });
    // promotion
    const req = E.Hero.promoReq(h), can = E.Hero.canPromote(h);
    this.put(E.UI.frame(this, X, 504, 770, 82, 'ui_panel2', 10));
    if (!req) this.put(E.UI.text(this, X + 20, 530, '★ Maximum tier reached: ' + E.Hero.title(h), { size: 18, bold: true, color: E.CS.goldLight }));
    else {
      const mats = Object.keys(req.mats).map(m => req.mats[m] + ' ' + E.MATS[m].name + ' (' + (s.mats[m] || 0) + ')').join(', ');
      this.put(E.UI.text(this, X + 14, 512, 'Promote to ' + E.CLASSES[h.cls].titles[h.tier + 1], { size: 17, bold: true, color: E.CS.goldLight }));
      this.put(E.UI.text(this, X + 14, 538, 'Requires Lv ' + req.level + '  ·  ' + E.U.fmt(req.gold) + 'g  ·  ' + mats + '\n+' + Math.round((E.TIER_MULT[h.tier + 1] / E.TIER_MULT[h.tier] - 1) * 100) + '% stats and stronger skills', { size: 12, color: can.ok ? E.CS.green : E.CS.dim, wrap: 560, ls: 3 }));
      this.put(E.UI.button(this, X + 670, 545, 170, 44, 'Promote', () => {
        if (E.Hero.promote(h)) { E.Sfx.play('levelup'); this.toast(h.name + ' is now a ' + E.Hero.title(h) + '!'); this.rerender(); } else E.Sfx.play('error');
      }, { size: 18, skin: can.ok ? 'g' : 'n', disabled: !can.ok, sfx: 'confirm' }));
    }
    // party toggle
    const inParty = s.party.includes(h.id);
    this.put(E.UI.button(this, X + 130, 612, 250, 38, inParty ? 'Remove from Party' : 'Add to Party', () => {
      if (inParty) { if (s.party.length <= 1) { this.toast('The party needs at least one hero', E.CS.red); E.Sfx.play('error'); return; } s.party = s.party.filter(id => id !== h.id); }
      else { if (s.party.length >= E.MAX_PARTY) { this.toast('Party is full (5)', E.CS.red); E.Sfx.play('error'); return; } s.party.push(h.id); }
      E.Form.sanitize(s); this.rerender();
    }, { size: 16 }));
    this.put(E.UI.button(this, X + 420, 612, 250, 38, 'Edit Formation', () => { this.scene.stop(); this.scene.stop('Town'); this.scene.start('Formation', { mode: 'edit' }); }, { size: 16, icon: 'u_party' }));
  }
  renderPicker(h) {
    const st = this.st, slot = st.pick, X = 390, per = 6;
    this.put(E.UI.text(this, X, 70, E.SLOT_NAMES[slot] + ' — ' + h.name, { size: 22, bold: true, color: E.CS.goldLight }));
    const list = E.G.s.gear.filter(g => E.Items.slot(g) === slot && E.Inv.canEquip(h, g)).sort((a, b) => E.Items.rarity(b).color - E.Items.rarity(a).color || b.lvl - a.lvl);
    if (h.equip[slot]) this.put(E.UI.button(this, X + 560, 82, 200, 38, 'Unequip', () => { E.Inv.unequip(h, slot); st.pick = null; E.Sfx.play('click'); this.rerender(); }, { size: 16 }));
    this.put(E.UI.button(this, X + 680, 612, 180, 38, 'Back', () => { st.pick = null; this.rerender(); }, { size: 16 }));
    this.put(E.UI.pager(this, X, 612, st, list.length, per, () => this.rerender()));
    if (!list.length) this.put(E.UI.text(this, X, 130, 'No compatible ' + E.SLOT_NAMES[slot].toLowerCase() + ' in storage.\nCraft one at the Blacksmith or win drops in dungeons.' + (slot === 'weapon' ? '\n(' + E.CLASSES[h.cls].name + ' uses: ' + Object.values(E.EQUIP).filter(e => e.cls === h.cls).map(e => e.name).join(', ') + ')' : ''), { size: 17, color: E.CS.dim, ls: 8 }));
    list.slice(st.page * per, st.page * per + per).forEach((g, i) => {
      const y = 130 + i * 74, cur = h.equip[slot] === g.uid, other = E.Inv.equippedBy(g.uid), r = E.Items.rarity(g);
      this.put(E.UI.frame(this, X, y, 770, 66, cur ? 'ui_row_s' : 'ui_row'));
      this.put(E.UI.slot(this, X + 8, y + 5, 56, E.Items.icon(g), r.color));
      this.put(E.UI.text(this, X + 78, y + 10, E.Items.name(g), { size: 18, bold: true, color: r.css }), E.UI.text(this, X + 78, y + 38, r.name + '  ·  ' + E.Items.statLine(E.Items.stats(g)) + (other && !cur ? '   (on ' + other.name + ')' : ''), { size: 13, color: E.CS.dim }));
      this.put(E.UI.button(this, X + 690, y + 33, 130, 42, cur ? 'Equipped' : 'Equip', () => { E.Inv.equip(h, g.uid); E.Sfx.play('confirm'); st.pick = null; this.rerender(); }, { size: 16, skin: 'g', disabled: cur }));
    });
  }
};

/* ==== src/scenes/panels/InventoryPanel.js ==== */
/* Inventory: equipment + materials, tabs, details, selling. */
E.InventoryPanel = class extends E.PanelScene {
  constructor() { super('Inventory', 'Inventory', 1100, 620); }
  init(d) { super.init(d); this.st = { page: 0, tab: 'All', sel: null }; }
  items() {
    const s = E.G.s, out = [], t = this.st.tab;
    if (t === 'All' || t === 'Equipment') s.gear.slice().sort((a, b) => E.Items.rarity(b).color - E.Items.rarity(a).color || a.key.localeCompare(b.key)).forEach(g => out.push({ type: 'gear', g }));
    if (t === 'All' || t === 'Material') for (const m in E.MATS) if ((s.mats[m] || 0) > 0) out.push({ type: 'mat', m });
    return out;
  }
  render() {
    const s = E.G.s, st = this.st, per = 28, cols = 7;
    this.put(this.goldBar(900, 10));
    ['All', 'Equipment', 'Material'].forEach((t, i) => this.put(E.UI.button(this, 100 + i * 150, 82, 140, 34, t, () => { st.tab = t; st.page = 0; st.sel = null; this.rerender(); }, { size: 15 }).setSelected(st.tab === t)));
    const items = this.items();
    this.put(E.UI.pager(this, 24, 562, st, items.length, per, () => this.rerender()));
    this.put(E.UI.text(this, 300, 566, 'Capacity ' + s.gear.length + ' / ' + E.Inv.capacity() + ' equipment', { size: 14, color: E.CS.dim }));
    items.slice(st.page * per, st.page * per + per).forEach((it, i) => {
      const x = 24 + (i % cols) * 78, y = 130 + Math.floor(i / cols) * 78;
      const key = it.type === 'gear' ? it.g.uid : it.m, sel = st.sel === key;
      const slot = it.type === 'gear'
        ? this.put(E.UI.slot(this, x, y, 70, E.Items.icon(it.g), E.Items.rarity(it.g).color, it.g.lvl ? '+' + it.g.lvl : null, sel))
        : this.put(E.UI.slot(this, x, y, 70, E.MATS[it.m].icon, null, E.U.fmt(s.mats[it.m]), sel));
      slot.setInteractive({ useHandCursor: true }).on('pointerdown', () => { st.sel = key; E.Sfx.play('click'); this.rerender(); });
      if (it.type === 'gear' && E.Inv.equippedBy(it.g.uid)) this.put(E.UI.text(this, x + 6, y + 4, 'E', { size: 13, bold: true, color: E.CS.green, st: 3 }));
    });
    if (!items.length) this.put(E.UI.text(this, 280, 260, 'Nothing here yet.', { size: 20, color: E.CS.dim, ox: 0.5 }));
    // detail pane
    this.put(E.UI.panel(this, 590, 70, 486, 520, '', { light: true }));
    const mat = st.sel && E.MATS[st.sel] ? st.sel : null, g = st.sel && E.Inv.gearByUid(st.sel);
    if (g) {
      const r = E.Items.rarity(g), p = E.Items.parse(g.key), by = E.Inv.equippedBy(g.uid);
      this.put(E.UI.slot(this, 616, 96, 84, E.Items.icon(g), r.color));
      this.put(E.UI.text(this, 716, 98, E.Items.name(g), { size: 24, bold: true, color: r.css, wrap: 340, st: 2 }), E.UI.text(this, 716, 158, r.name + ' ' + E.SLOT_NAMES[p.def.slot], { size: 15, color: E.CS.dim }));
      const stt = E.Items.stats(g); let y = 214;
      for (const [k, ic, lb] of [['atk', 'u_atk', 'Attack'], ['def', 'u_def', 'Defense'], ['hp', 'u_heart', 'Health']]) if (stt[k]) { this.put(E.UI.statRow(this, 620, y, ic, lb, '+' + stt[k], 420)); y += 28; }
      this.put(E.UI.text(this, 620, y + 10, 'Upgrade level +' + g.lvl + ' / ' + E.MAX_UPGRADE + '  (upgrade at the Blacksmith)', { size: 14, color: E.CS.purple }));
      this.put(E.UI.text(this, 620, y + 40, p.def.cls ? 'Usable by: ' + E.CLASSES[p.def.cls].name : 'Usable by: any hero', { size: 14, color: E.CS.blue }));
      this.put(E.UI.text(this, 620, y + 66, by ? 'Equipped by ' + by.name : 'In storage', { size: 14, color: by ? E.CS.green : E.CS.dim }));
      const price = E.Items.sellPrice(g);
      this.put(E.UI.button(this, 833, 540, 300, 44, 'Sell for ' + E.U.fmt(price) + 'g', () => {
        E.UI.modal(this, 'Sell item?', 'Sell ' + E.Items.name(g) + ' for ' + price + ' gold?', [{ label: 'Cancel' }, { label: 'Sell', skin: 'g', cb: () => { E.Inv.sell(g.uid); E.Sfx.play('coin'); st.sel = null; this.rerender(); } }]);
      }, { size: 17, disabled: !!by }));
    } else if (mat) {
      this.put(E.UI.slot(this, 616, 96, 84, E.MATS[mat].icon, null, null));
      this.put(E.UI.text(this, 716, 98, E.MATS[mat].name, { size: 24, bold: true, wrap: 340 }), E.UI.text(this, 716, 140, 'Owned: ' + E.U.fmt(s.mats[mat]), { size: 18, color: E.CS.goldLight }));
      const src = E.DUNGEONS.filter(d => d.mats[mat]).map(d => d.name).join(', ');
      this.put(E.UI.text(this, 620, 214, 'Crafting material. Dropped in: ' + src + '.\nUsed for crafting, upgrades, promotions and Bastion upgrades.', { size: 15, color: E.CS.dim, wrap: 430, ls: 6 }));
    } else this.put(E.UI.text(this, 833, 300, 'Select an item', { size: 20, color: E.CS.dim, ox: 0.5 }));
  }
};

/* ==== src/scenes/panels/BlacksmithPanel.js ==== */
/* Blacksmith: craft new equipment by tier, upgrade owned equipment up to +5. */
E.BlacksmithPanel = class extends E.PanelScene {
  constructor() { super('Blacksmith', 'Blacksmith', 1180, 640); }
  init(d) { super.init(d); this.st = { page: 0, tab: 'Craft', tier: 0, sel: null, usel: null }; }
  matLine(mats, y, x = 0) {
    const s = E.G.s; let cx = x;
    for (const m in mats) {
      const have = s.mats[m] || 0, ok = have >= mats[m];
      this.put(this.add.image(cx + 10, y + 10, E.MATS[m].icon).setScale(1.5));
      this.put(E.UI.text(this, cx + 26, y, mats[m] + '/' + have, { size: 15, bold: true, color: ok ? E.CS.green : E.CS.red, st: 2 })); cx += 96;
    }
  }
  render() {
    const st = this.st, s = E.G.s;
    this.put(this.goldBar(1000, 10));
    ['Craft', 'Upgrade'].forEach((t, i) => this.put(E.UI.button(this, 100 + i * 170, 82, 160, 36, t, () => { st.tab = t; st.page = 0; this.rerender(); }, { size: 17 }).setSelected(st.tab === t)));
    if (st.tab === 'Craft') this.renderCraft(); else this.renderUpgrade();
  }
  renderCraft() {
    const st = this.st, s = E.G.s;
    E.TIERS.forEach((t, i) => this.put(E.UI.button(this, 100 + i * 112, 134, 106, 34, t.name, () => { st.tier = i; st.sel = null; this.rerender(); }, { size: 13, color: E.RARITY[t.rarity].css }).setSelected(st.tier === i)));
    const keys = Object.keys(E.EQUIP).map(ty => E.Items.key(ty, st.tier));
    keys.forEach((k, i) => {
      const y = 166 + i * 48, p = E.Items.parse(k), g = { key: k, lvl: 0 }, r = E.Items.rarity(g), sel = st.sel === k;
      const row = this.put(E.UI.frame(this, 24, y, 590, 44, sel ? 'ui_row_s' : 'ui_row'));
      row.setInteractive({ useHandCursor: true }).on('pointerdown', () => { st.sel = k; E.Sfx.play('click'); this.rerender(); });
      this.put(this.add.image(46, y + 22, p.def.icon).setScale(2));
      this.put(E.UI.text(this, 72, y + 4, E.Items.name(g), { size: 16, bold: true, color: r.css }), E.UI.text(this, 72, y + 25, E.Items.statLine(E.Items.stats(g)) + (p.def.cls ? '  ·  ' + E.CLASSES[p.def.cls].name : ''), { size: 12, color: E.CS.dim }));
      const can = E.Craft.canCraft(k).ok; this.put(E.UI.text(this, 600, y + 22, can ? '✔' : '', { size: 18, color: E.CS.green, ox: 1, oy: 0.5 }));
    });
    // detail
    this.put(E.UI.panel(this, 640, 134, 516, 480, '', { light: true }));
    if (!st.sel) { this.put(E.UI.text(this, 898, 360, 'Select a recipe', { size: 20, color: E.CS.dim, ox: 0.5 })); return; }
    const k = st.sel, p = E.Items.parse(k), g = { key: k, lvl: 0 }, r = E.Items.rarity(g), rec = E.Items.recipe(k), c = E.Craft.canCraft(k);
    this.put(E.UI.slot(this, 664, 158, 88, p.def.icon, r.color));
    this.put(E.UI.text(this, 770, 160, E.Items.name(g), { size: 24, bold: true, color: r.css, wrap: 360, st: 2 }), E.UI.text(this, 770, 220, r.name + ' ' + E.SLOT_NAMES[p.def.slot], { size: 14, color: E.CS.dim }));
    const stt = E.Items.stats(g); let y = 268;
    for (const [kk, ic, lb] of [['atk', 'u_atk', 'Attack'], ['def', 'u_def', 'Defense'], ['hp', 'u_heart', 'Health']]) if (stt[kk]) { this.put(E.UI.statRow(this, 668, y, ic, lb, '+' + stt[kk], 440)); y += 28; }
    this.put(E.UI.text(this, 668, y + 8, p.def.cls ? 'Equippable by: ' + E.CLASSES[p.def.cls].name + ' only' : 'Equippable by any hero', { size: 14, color: E.CS.blue }));
    this.put(E.UI.text(this, 668, 400, 'Materials needed', { size: 15, bold: true, color: E.CS.goldLight }));
    this.matLine(rec.mats, 428, 668);
    this.put(this.add.image(678, 478, 'u_coin').setScale(1.5)); this.put(E.UI.text(this, 696, 468, E.U.fmt(rec.gold) + 'g', { size: 17, bold: true, color: s.gold >= rec.gold ? E.CS.goldLight : E.CS.red, st: 2 }));
    this.put(E.UI.button(this, 898, 558, 340, 50, c.ok ? 'Craft' : c.why, () => {
      const it = E.Craft.craft(k); if (!it) { E.Sfx.play('error'); return; }
      E.Sfx.play('anvil'); this.toast('Forged: ' + E.Items.name(it), E.Items.rarity(it).css); this.rerender();
    }, { size: 20, skin: c.ok ? 'g' : 'n', disabled: !c.ok, sfx: 'anvil' }));
  }
  renderUpgrade() {
    const st = this.st, s = E.G.s, per = 7;
    const gear = s.gear.slice().sort((a, b) => E.Items.rarity(b).color - E.Items.rarity(a).color || b.lvl - a.lvl);
    if (!st.usel || !E.Inv.gearByUid(st.usel)) st.usel = gear[0] && gear[0].uid;
    this.put(E.UI.pager(this, 24, 590, st, gear.length, per, () => this.rerender()));
    if (!gear.length) this.put(E.UI.text(this, 300, 300, 'You own no equipment.', { size: 20, color: E.CS.dim, ox: 0.5 }));
    gear.slice(st.page * per, st.page * per + per).forEach((g, i) => {
      const y = 134 + i * 64, r = E.Items.rarity(g), sel = st.usel === g.uid, by = E.Inv.equippedBy(g.uid);
      const row = this.put(E.UI.frame(this, 24, y, 590, 58, sel ? 'ui_row_s' : 'ui_row'));
      row.setInteractive({ useHandCursor: true }).on('pointerdown', () => { st.usel = g.uid; E.Sfx.play('click'); this.rerender(); });
      this.put(this.add.image(48, y + 29, E.Items.icon(g)).setScale(2));
      this.put(E.UI.text(this, 76, y + 8, E.Items.name(g), { size: 17, bold: true, color: r.css }), E.UI.text(this, 76, y + 32, E.Items.statLine(E.Items.stats(g)) + (by ? '  ·  on ' + by.name : ''), { size: 12, color: E.CS.dim }));
    });
    this.put(E.UI.panel(this, 640, 134, 516, 480, '', { light: true }));
    const g = st.usel && E.Inv.gearByUid(st.usel); if (!g) return;
    const r = E.Items.rarity(g), c = E.Craft.canUpgrade(g), cost = E.Items.upgradeCost(g), cur = E.Items.stats(g), nx = E.Items.stats({ key: g.key, lvl: g.lvl + 1 });
    this.put(E.UI.slot(this, 664, 158, 88, E.Items.icon(g), r.color));
    this.put(E.UI.text(this, 770, 160, E.Items.name(g), { size: 24, bold: true, color: r.css, wrap: 360, st: 2 }), E.UI.text(this, 770, 220, 'Upgrade +' + g.lvl + ' → +' + Math.min(E.MAX_UPGRADE, g.lvl + 1), { size: 15, color: E.CS.purple }));
    let y = 270;
    for (const [kk, ic, lb] of [['atk', 'u_atk', 'Attack'], ['def', 'u_def', 'Defense'], ['hp', 'u_heart', 'Health']]) if (cur[kk]) {
      this.put(E.UI.statRow(this, 668, y, ic, lb, cur[kk] + (g.lvl < E.MAX_UPGRADE ? '  →  ' + nx[kk] : ''), 440)); y += 28;
    }
    if (g.lvl < E.MAX_UPGRADE) { this.put(E.UI.text(this, 668, 400, 'Upgrade cost', { size: 15, bold: true, color: E.CS.goldLight })); this.matLine(cost.mats, 428, 668); this.put(this.add.image(678, 478, 'u_coin').setScale(1.5)); this.put(E.UI.text(this, 696, 468, E.U.fmt(cost.gold) + 'g', { size: 17, bold: true, color: s.gold >= cost.gold ? E.CS.goldLight : E.CS.red, st: 2 })); }
    this.put(E.UI.button(this, 898, 558, 340, 50, c.ok ? 'Upgrade' : c.why, () => {
      if (E.Craft.upgrade(g)) { E.Sfx.play('anvil'); this.toast(E.Items.name(g) + ' upgraded!', E.CS.green); this.rerender(); } else E.Sfx.play('error');
    }, { size: 20, skin: c.ok ? 'g' : 'n', disabled: !c.ok, sfx: 'anvil' }));
  }
};

/* ==== src/scenes/panels/RecruitPanel.js ==== */
E.RecruitPanel = class extends E.PanelScene {
  constructor() { super('Recruit', 'Recruitment Hall', 1040, 560); }
  hero(x, y, cls, scale) {
    const sp = this.add.sprite(x, y, 'hero_' + cls).setScale(scale).setOrigin(0.5, 0.92); sp.play('idle_' + cls); return sp;
  }
  render() {
    const s = E.G.s, list = s.recruits.list;
    this.put(this.goldBar(780, 10));
    this.put(E.UI.text(this, 24, 62, 'Roster ' + s.heroes.length + ' / ' + E.Town.maxRoster() + '   ·   New candidates arrive every day.', { size: 15, color: E.CS.dim }));
    if (!list.length) this.put(E.UI.text(this, 520, 280, 'No candidates today.\nCome back tomorrow.', { size: 24, color: E.CS.dim, ox: 0.5, align: 'center' }));
    list.forEach((c, i) => {
      const x = 30 + i * 330, y = 100, cls = E.CLASSES[c.cls];
      this.put(E.UI.panel(this, x, y, 310, 430, '', { light: true }));
      this.put(E.UI.frame(this, x + 20, y + 20, 270, 150, 'ui_slot'));
      this.put(this.hero(x + 155, y + 150, c.cls, 5));
      this.put(E.UI.text(this, x + 155, y + 188, c.name, { size: 24, bold: true, ox: 0.5, color: E.CS.goldLight, st: 3 }));
      this.put(E.UI.text(this, x + 155, y + 218, cls.name + ' · ' + cls.role + ' · Lv ' + c.level, { size: 15, ox: 0.5, color: E.CS.blue }));
      this.put(E.UI.text(this, x + 20, y + 246, cls.blurb, { size: 14, wrap: 270, color: E.CS.dim }));
      this.put(E.UI.text(this, x + 20, y + 290, '◆ ' + cls.skill.names[0] + '\n◆ ' + cls.ult.names[0] + ' (Lv 5)', { size: 14, color: E.CS.purple, ls: 5 }));
      const can = s.gold >= c.cost && s.heroes.length < E.Town.maxRoster();
      this.put(this.add.image(x + 30, y + 354, 'u_coin').setScale(1.6)); this.put(E.UI.text(this, x + 48, y + 345, E.U.fmt(c.cost), { size: 20, bold: true, color: s.gold >= c.cost ? E.CS.goldLight : E.CS.red, st: 2 }));
      this.put(E.UI.button(this, x + 155, y + 394, 250, 40, 'Recruit', () => {
        const r = E.Town.recruit(c);
        if (!r.ok) { E.Sfx.play('error'); this.toast(r.why, E.CS.red); return; }
        E.Sfx.play('coin'); this.toast(r.hero.name + ' joins the Bastion!'); this.rerender();
      }, { size: 18, skin: can ? 'g' : 'n', sfx: 'confirm' }));
    });
  }
};

/* ==== src/scenes/panels/TrainingPanel.js ==== */
E.TrainingPanel = class extends E.PanelScene {
  constructor() { super('Training', 'Training Ground', 1000, 560); }
  create() { super.create(); this.timer = this.time.addEvent({ delay: 500, loop: true, callback: () => { if (!this.st.pick) this.rerender(); } }); }
  render() {
    const s = E.G.s, slots = E.Town.trainSlots();
    this.put(this.goldBar(780, 10));
    this.put(E.UI.text(this, 24, 62, 'Assigned heroes gain XP as in-game time passes (max 24h per session). Slots: ' + s.training.length + ' / ' + slots, { size: 15, color: E.CS.dim }));
    if (this.st.pick) return this.renderPicker();
    for (let i = 0; i < 3; i++) {
      const x = 30 + i * 320, y = 100, t = s.training[i], locked = i >= slots;
      this.put(E.UI.panel(this, x, y, 300, 420, '', { light: true }));
      if (locked) { this.put(this.add.image(x + 150, y + 170, 'u_lock').setScale(5)); this.put(E.UI.text(this, x + 150, y + 250, 'Upgrade the Bastion\nto unlock', { size: 16, color: E.CS.dim, ox: 0.5, align: 'center' })); continue; }
      if (!t) {
        this.put(E.UI.text(this, x + 150, y + 150, 'Empty Slot', { size: 22, color: E.CS.dim, ox: 0.5 }));
        this.put(E.UI.button(this, x + 150, y + 380, 240, 44, 'Assign Hero', () => { this.st.pick = true; this.rerender(); }, { size: 18 }));
        continue;
      }
      const h = E.G.hero(t.heroId), xp = E.Town.trainingXp(t), hrs = Math.min(24, (s.time - t.start) / 60), cls = E.CLASSES[h.cls];
      this.put(E.UI.frame(this, x + 20, y + 20, 260, 150, 'ui_slot'));
      const sp = this.add.sprite(x + 150, y + 150, 'hero_' + h.cls).setScale(5).setOrigin(0.5, 0.92); sp.play('atk_' + h.cls); sp.on('animationcomplete', () => sp.play('idle_' + h.cls)); this.put(sp);
      this.put(E.UI.text(this, x + 150, y + 188, h.name, { size: 22, bold: true, ox: 0.5, color: E.CS.goldLight, st: 3 }));
      this.put(E.UI.text(this, x + 150, y + 216, 'Lv ' + h.level + ' ' + E.Hero.title(h), { size: 15, ox: 0.5, color: E.CS.blue }));
      this.put(E.UI.text(this, x + 150, y + 250, 'Training: ' + hrs.toFixed(1) + ' h', { size: 15, ox: 0.5, color: E.CS.dim }));
      this.put(E.UI.text(this, x + 150, y + 280, '+' + E.U.fmt(xp) + ' XP', { size: 28, ox: 0.5, bold: true, color: E.CS.green, st: 3 }));
      this.put(E.UI.text(this, x + 150, y + 316, E.Town.trainRate(h) + ' XP / hour', { size: 13, ox: 0.5, color: E.CS.dim }));
      this.put(E.UI.button(this, x + 150, y + 380, 240, 44, 'Collect', () => {
        const r = E.Town.collectTraining(t); E.Sfx.play(r.levels ? 'levelup' : 'coin');
        this.toast(r.hero.name + ' gained ' + r.xp + ' XP' + (r.levels ? ' — Level up! (Lv ' + r.hero.level + ')' : '')); this.rerender();
      }, { size: 18, skin: 'g', sfx: 'confirm' }));
    }
  }
  renderPicker() {
    const s = E.G.s, st = this.st;
    this.put(E.UI.text(this, 24, 96, 'Choose a hero to train (cost in gold, paid up front):', { size: 17, color: E.CS.goldLight }));
    const avail = s.heroes.filter(h => !s.training.some(t => t.heroId === h.id)), per = 6;
    this.put(E.UI.pager(this, 24, 520, st, avail.length, per, () => this.rerender()));
    avail.slice(st.page * per, st.page * per + per).forEach((h, i) => {
      const y = 130 + i * 62, cost = E.Town.trainCost(h);
      this.put(E.UI.frame(this, 24, y, 950, 54, 'ui_row'));
      this.put(E.UI.portrait(this, 32, y + 1, h.cls, 44));
      this.put(E.UI.text(this, 100, y + 8, h.name, { size: 19, bold: true }), E.UI.text(this, 100, y + 30, 'Lv ' + h.level + ' ' + E.Hero.title(h) + '  ·  ' + E.Town.trainRate(h) + ' XP/h', { size: 13, color: E.CS.dim }));
      this.put(E.UI.button(this, 860, y + 27, 170, 40, cost + 'g · Train', () => {
        const r = E.Town.startTraining(h); if (!r.ok) { E.Sfx.play('error'); this.toast(r.why, E.CS.red); return; }
        st.pick = false; E.Sfx.play('coin'); this.rerender();
      }, { size: 16, disabled: s.gold < cost || h.level >= E.MAX_LEVEL }));
    });
    this.put(E.UI.button(this, 900, 520, 170, 40, 'Back', () => { st.pick = false; this.rerender(); }, { size: 16 }));
  }
};

/* ==== src/scenes/panels/CommandPanel.js ==== */
/* Command Hall: collect taxes, upgrade the Bastion, quests. */
E.CommandPanel = class extends E.PanelScene {
  constructor() { super('Command', 'Command Hall', 1180, 640); }
  render() {
    const s = E.G.s, f = s.fortress, T = E.Town;
    this.put(this.goldBar(1000, 10));
    // left: Bastion
    this.put(E.UI.panel(this, 24, 70, 420, 546, 'The Last Bastion', { light: true, titleSize: 20 }));
    this.put(E.UI.text(this, 44, 130, 'Fortress Level ' + f.level + ' / 5', { size: 22, bold: true, color: E.CS.goldLight }));
    for (let i = 0; i < 5; i++) this.put(this.add.image(50 + i * 34, 186, 'u_star').setScale(2).setTint(i < f.level ? 0xffffff : 0x333344));
    const rows = [['Taxes per day', E.U.fmt(T.taxPerDay()) + ' g'], ['Roster capacity', s.heroes.length + ' / ' + T.maxRoster()], ['Training slots', T.trainSlots()], ['Inventory capacity', E.Inv.capacity()], ['Day', E.G.day()]];
    rows.forEach((r, i) => this.put(E.UI.statRow(this, 44, 220 + i * 26, null, r[0], r[1], 370)));
    this.put(E.UI.text(this, 44, 366, 'Pending taxes', { size: 15, color: E.CS.dim }), E.UI.text(this, 414, 366, E.U.fmt(f.taxPending) + ' g', { size: 20, bold: true, ox: 1, color: E.CS.goldLight }));
    this.put(E.UI.button(this, 234, 418, 360, 44, 'Collect Taxes', () => { const n = T.collectTax(); E.Sfx.play('coin'); this.toast('+' + E.U.fmt(n) + ' gold collected'); this.rerender(); }, { size: 18, skin: 'g', disabled: f.taxPending < 1 }));
    const c = T.upgradeCost(), max = f.level >= 5;
    const need = max ? 'Bastion fully restored' : 'Upgrade: ' + E.U.fmt(c.gold) + 'g  +  ' + Object.keys(c.mats).map(m => c.mats[m] + ' ' + E.MATS[m].name).join(', ');
    this.put(E.UI.text(this, 234, 480, need, { size: 14, ox: 0.5, color: max ? E.CS.green : (s.gold >= c.gold && E.Inv.hasMats(c.mats) ? E.CS.text : E.CS.red), wrap: 380, align: 'center' }));
    this.put(E.UI.button(this, 234, 548, 360, 48, max ? 'Max Level' : 'Upgrade Bastion', () => {
      const r = T.upgradeFortress(); if (!r.ok) { E.Sfx.play('error'); this.toast(r.why, E.CS.red); return; }
      E.Sfx.play('levelup'); this.toast('The Bastion grows stronger! (Level ' + s.fortress.level + ')'); this.rerender();
    }, { size: 18, disabled: max }));
    // right: quests
    this.put(E.UI.panel(this, 460, 70, 696, 546, 'Main Quests', { light: true, titleSize: 20 }));
    const st = this.st, per = 5;
    const qs = E.QUESTS.slice().sort((a, b) => { const o = { ready: 0, active: 1, claimed: 2 }; return o[T.questState(a)] - o[T.questState(b)]; });
    this.put(E.UI.pager(this, 480, 585, st, qs.length, per, () => this.rerender()));
    qs.slice(st.page * per, st.page * per + per).forEach((q, i) => {
      const y = 126 + i * 90, state = T.questState(q);
      this.put(E.UI.frame(this, 480, y, 656, 82, state === 'ready' ? 'ui_row_s' : 'ui_row'));
      this.put(E.UI.text(this, 498, y + 8, (state === 'claimed' ? '✔ ' : '◆ ') + q.title, { size: 18, bold: true, color: state === 'claimed' ? E.CS.dim : state === 'ready' ? E.CS.green : E.CS.goldLight }));
      this.put(E.UI.text(this, 498, y + 34, q.desc, { size: 13, color: E.CS.dim, wrap: 420 }));
      const r = q.reward, parts = []; if (r.gold) parts.push(E.U.fmt(r.gold) + 'g'); for (const m in (r.mats || {})) parts.push(r.mats[m] + ' ' + E.MATS[m].name.split(' ')[0]);
      this.put(E.UI.text(this, 498, y + 62, 'Reward: ' + parts.join(', ') + '    Progress: ' + q.prog(s), { size: 12, color: E.CS.purple }));
      if (state === 'ready') this.put(E.UI.button(this, 1060, y + 41, 130, 44, 'Claim', () => { T.claimQuest(q); E.Sfx.play('levelup'); this.toast('Quest complete: ' + q.title); this.rerender(); }, { size: 17, skin: 'g', sfx: 'confirm' }));
      else if (state === 'claimed') this.put(E.UI.text(this, 1060, y + 41, 'Done', { size: 16, color: E.CS.dim, ox: 0.5, oy: 0.5 }));
      else this.put(E.UI.text(this, 1060, y + 41, 'In progress', { size: 15, color: E.CS.blue, ox: 0.5, oy: 0.5 }));
    });
  }
};

/* ==== src/scenes/panels/ExpeditionPanel.js ==== */
/* Expedition Gate: world map of Eldoria, dungeon + stage selection, then Formation -> Battle. */
E.ExpeditionPanel = class extends E.PanelScene {
  constructor() { super('Expedition', 'Expedition Gate — Eldoria', 1220, 660); }
  init(d) { super.init(d); const s = E.G.s; this.st = { sel: 'forest', stage: null }; }
  render() {
    const s = E.G.s, st = this.st, MX = 24, MY = 70, MS = 2;
    this.put(this.add.image(MX, MY, 'worldmap').setOrigin(0).setScale(MS));
    // home marker
    this.put(this.add.image(MX + 0.14 * 380 * MS, MY + 0.42 * 220 * MS, 'u_home').setScale(2.5));
    this.put(E.UI.text(this, MX + 0.14 * 380 * MS, MY + 0.42 * 220 * MS + 22, 'The Last Bastion', { size: 12, bold: true, ox: 0.5, st: 3, color: E.CS.goldLight }));
    E.DUNGEONS.forEach(d => {
      const x = MX + d.mapPos[0] * 380 * MS, y = MY + d.mapPos[1] * 220 * MS, un = E.Dungeons.isUnlocked(d, s), sel = st.sel === d.id, boss = s.cleared[d.id] && s.cleared[d.id].boss;
      const b = this.put(E.UI.button(this, x, y, 50, 46, '', () => { st.sel = d.id; st.stage = null; E.Sfx.play('click'); this.rerender(); }, { icon: un ? (boss ? 'u_star' : 'u_skull') : 'u_lock', iconScale: 2.4, skin: sel ? 'g' : 'n' }));
      b.ic.x = 0;
      this.put(E.UI.text(this, x, y + 30, d.region, { size: 13, bold: true, ox: 0.5, st: 4, color: un ? (sel ? E.CS.goldLight : E.CS.text) : E.CS.dim }));
      if (sel) { const ring = this.add.circle(x, y, 36).setStrokeStyle(3, E.C.goldLight); this.put(ring); this.tweens.add({ targets: ring, scale: 1.25, alpha: 0.2, yoyo: false, repeat: -1, duration: 900 }); }
    });
    const d = E.Dungeons.get(st.sel), un = E.Dungeons.isUnlocked(d, s), c = s.cleared[d.id] || { stages: 0, boss: false, clears: 0 };
    // info under map
    this.put(E.UI.text(this, 24, 520, d.region + ' — ' + d.name, { size: 22, bold: true, color: E.CS.goldLight, st: 3 }));
    this.put(E.UI.text(this, 24, 552, d.desc, { size: 14, color: E.CS.dim, wrap: 740 }));
    const drops = Object.keys(d.mats).map(m => E.MATS[m].name).join(', ');
    this.put(E.UI.text(this, 24, 598, 'Drops: ' + E.U.fmt(d.gold[0]) + '–' + E.U.fmt(d.gold[1]) + ' gold, ' + drops + '; ' + E.TIERS[d.gearTier].name + '-tier gear. No stamina — replay freely.', { size: 13, color: E.CS.purple, wrap: 740 }));
    // right: stage list
    this.put(E.UI.panel(this, 800, 70, 396, 570, 'Stages', { light: true, titleSize: 20 }));
    this.put(E.UI.text(this, 820, 120, 'Recommended Lv ' + d.recLv + '+   ·   Clears: ' + c.clears, { size: 14, color: un ? E.CS.blue : E.CS.red }));
    if (!un) { const need = E.Dungeons.get(d.unlock); this.put(E.UI.text(this, 998, 330, '🔒 Locked\n\nDefeat the boss of\n' + need.name + '\nto open this region.', { size: 20, ox: 0.5, align: 'center', color: E.CS.dim, ls: 6 })); return; }
    d.stages.forEach((sg, i) => {
      const y = 154 + i * 76, open = E.Dungeons.stageUnlocked(d, i, s), done = c.stages > i, sel = st.stage === i;
      const row = this.put(E.UI.frame(this, 820, y, 356, 68, sel ? 'ui_row_s' : 'ui_row'));
      if (open) row.setInteractive({ useHandCursor: true }).on('pointerdown', () => { st.stage = i; E.Sfx.play('click'); this.rerender(); });
      this.put(E.UI.text(this, 836, y + 8, (i + 1) + '. ' + sg.name, { size: 17, bold: true, color: open ? (sg.boss ? E.CS.red : E.CS.text) : E.CS.dim }));
      const en = E.Run.buildEnemies(d, i), elite = en.filter(e => e.elite && !e.boss).length;
      this.put(E.UI.text(this, 836, y + 36, open ? en.length + ' enemies' + (elite ? ' · ' + elite + ' elite' : '') + (sg.boss ? ' · BOSS' : '') : 'Clear the previous stage', { size: 13, color: E.CS.dim }));
      if (done) this.put(this.add.image(1148, y + 34, 'u_check').setScale(2));
      else if (!open) this.put(this.add.image(1148, y + 34, 'u_lock').setScale(2));
    });
    const stg = st.stage;
    this.put(E.UI.text(this, 820, 470, stg !== null ? 'Stage ' + (stg + 1) + ': ' + d.stages[stg].name : 'Select a stage', { size: 15, color: E.CS.goldLight, bold: true }));
    if (stg !== null) { this.put(E.UI.text(this, 820, 494, 'Party power ' + s.party.reduce((a, id) => a + E.Hero.power(E.G.hero(id)), 0) + '  ·  ' + s.party.length + ' hero(es)', { size: 13, color: E.CS.dim })); }
    this.put(E.UI.button(this, 998, 580, 340, 54, 'Deploy', () => {
      this.scene.stop(); this.scene.stop('Town'); this.scene.start('Formation', { mode: 'battle', dungeon: d, stage: stg });
    }, { size: 22, skin: 'g', disabled: stg === null, icon: 'u_swords', sfx: 'confirm' }));
  }
};

/* ==== src/scenes/panels/SavePanel.js ==== */
/* Manual save/load slots (IndexedDB). Overwrite is always confirmed. No autosave exists. */
E.SavePanel = class extends E.PanelScene {
  constructor() { super('SavePanel', 'Save / Load', 920, 620); }
  init(data) { super.init(data); this.mode = data.mode || 'load'; this.slots = null; this.panelTitle = this.mode === 'save' ? 'Save Game' : 'Load Game'; }
  create() { super.create(); E.Save.list().then(l => { this.slots = l; if (this.scene.isActive()) this.rerender(); }); }
  render() {
    this.put(E.UI.text(this, 24, 62, this.mode === 'save' ? 'Choose a slot to write. Existing saves will ask before being overwritten.' : 'Choose a slot to load.', { size: 15, color: E.CS.dim }));
    if (!this.slots) { this.put(E.UI.text(this, 460, 300, 'Reading saves…', { size: 22, ox: 0.5, color: E.CS.dim })); return; }
    this.slots.forEach((r, i) => {
      const y = 96 + i * 84;
      this.put(E.UI.frame(this, 24, y, 872, 76, r ? 'ui_row' : 'ui_slot'));
      this.put(E.UI.text(this, 44, y + 24, 'Slot ' + (i + 1), { size: 22, bold: true, color: E.CS.goldLight }));
      if (r) {
        const m = r.meta, d = new Date(m.savedAt);
        this.put(E.UI.text(this, 150, y + 10, 'Day ' + m.day + '  ·  ' + m.heroes + ' heroes  ·  top Lv ' + m.maxLevel + '  ·  ' + E.U.fmt(m.gold) + ' gold  ·  Bosses slain: ' + m.progress, { size: 15 }));
        this.put(E.UI.text(this, 150, y + 38, d.toLocaleDateString() + ' ' + d.toLocaleTimeString(), { size: 13, color: E.CS.dim }));
        (m.party || []).forEach((c, k) => this.put(this.add.image(560 + k * 32, y + 50, 'port_' + c).setDisplaySize(28, 28)));
      } else this.put(E.UI.text(this, 150, y + 26, 'Empty', { size: 17, color: E.CS.dim }));
      const main = this.mode === 'save' ? 'Save' : 'Load';
      this.put(E.UI.button(this, 740, y + 38, 110, 42, main, () => this.act(i, r), { size: 17, skin: 'g', disabled: this.mode === 'load' && !r, sfx: 'confirm' }));
      this.put(E.UI.button(this, 856, y + 38, 70, 42, '', () => this.del(i), { icon: 'u_x', size: 12, disabled: !r }));
    });
  }
  act(i, r) {
    if (this.mode === 'save') {
      const go = () => E.Save.write(i).then(() => { E.Sfx.play('confirm'); this.toast('Game saved to slot ' + (i + 1)); this.slots[i] = { meta: E.Save.meta(E.G.s) }; E.Save.get(i).then(x => { this.slots[i] = x; this.rerender(); }); });
      if (r) E.UI.modal(this, 'Overwrite Save?', 'Slot ' + (i + 1) + ' already contains a save (Day ' + r.meta.day + '). It will be permanently replaced.', [{ label: 'Cancel' }, { label: 'Overwrite', skin: 'g', cb: go }]);
      else go();
    } else {
      const go = () => E.Save.load(i).then(ok => {
        if (!ok) return; const parent = this.opts.parent; if (parent) this.scene.stop(parent); this.scene.start('Town');
      });
      if (this.opts.parent === 'Town') E.UI.modal(this, 'Load Game?', 'Unsaved progress in the current game will be lost.', [{ label: 'Cancel' }, { label: 'Load', skin: 'g', cb: go }]);
      else go();
    }
  }
  del(i) {
    E.UI.modal(this, 'Delete Save?', 'Slot ' + (i + 1) + ' will be permanently deleted.', [{ label: 'Cancel' }, { label: 'Delete', skin: 'g', cb: () => E.Save.remove(i).then(() => { this.slots[i] = null; this.rerender(); }) }]);
  }
};

/* ==== src/scenes/panels/SettingsPanel.js ==== */
E.SettingsPanel = class extends E.PanelScene {
  constructor() { super('Settings', 'Settings', 720, 540); }
  slider(x, y, w, key, label) {
    this.put(E.UI.text(this, x, y - 4, label, { size: 18, bold: true }));
    const tx = x + 230, tw = w - 230, val = E.Settings.d[key];
    const track = this.add.rectangle(tx, y + 10, tw, 8, 0x05050c).setOrigin(0, 0.5).setStrokeStyle(1, E.C.goldDark);
    const fill = this.add.rectangle(tx, y + 10, tw * val, 8, E.C.purple).setOrigin(0, 0.5);
    const knob = this.add.rectangle(tx + tw * val, y + 10, 16, 26, E.C.gold).setStrokeStyle(2, E.C.goldLight);
    const pct = E.UI.text(this, tx + tw + 14, y + 10, Math.round(val * 100) + '%', { size: 15, oy: 0.5, color: E.CS.dim });
    const hit = this.add.rectangle(tx - 10, y + 10, tw + 20, 40, 0xffffff, 0.001).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    const set = p => { const v = E.U.clamp((p.x - this.px - tx) / tw, 0, 1); E.Settings.set(key, Math.round(v * 20) / 20); fill.width = tw * E.Settings.d[key]; knob.x = tx + tw * E.Settings.d[key]; pct.setText(Math.round(E.Settings.d[key] * 100) + '%'); };
    let down = false; hit.on('pointerdown', p => { down = true; set(p); E.Sfx.init(); E.Music.start(); }); hit.on('pointermove', p => { if (down) set(p); }); hit.on('pointerup', () => { down = false; E.Sfx.play('click'); }); hit.on('pointerout', () => { down = false; });
    this.put(track, fill, knob, pct, hit);
  }
  toggle(x, y, key, label) {
    const on = E.Settings.d[key];
    this.put(E.UI.text(this, x, y + 6, label, { size: 18, bold: true }));
    this.put(E.UI.button(this, x + 400, y + 18, 120, 38, on ? 'ON' : 'OFF', () => { E.Settings.set(key, !E.Settings.d[key]); this.rerender(); }, { size: 17, skin: on ? 'g' : 'n' }));
  }
  render() {
    this.slider(40, 100, 640, 'music', 'Music Volume');
    this.slider(40, 160, 640, 'sfx', 'SFX Volume');
    this.toggle(40, 220, 'damageNumbers', 'Show Damage Numbers');
    this.toggle(40, 280, 'screenShake', 'Screen Shake');
    this.put(E.UI.text(this, 40, 346, 'Display', { size: 18, bold: true }));
    this.put(E.UI.button(this, 440, 358, 240, 38, this.scale.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen', () => { this.scale.toggleFullscreen(); this.time.delayedCall(300, () => this.rerender()); }, { size: 16 }));
    this.put(E.UI.text(this, 40, 410, 'Reference resolution 1280×720 · scales to any screen.\nProgress is saved manually only (Save slots).\nESC closes this window.', { size: 14, color: E.CS.dim, ls: 6 }));
  }
};

/* ==== src/scenes/panels/CreditsPanel.js ==== */
E.CreditsPanel = class extends E.PanelScene {
  constructor() { super('Credits', 'Credits', 760, 520); }
  render() {
    const t = [
      'ELDORIA: The Last Bastion', '',
      'Original world, characters and story.', 'Built with Phaser 3 · JavaScript · HTML5 Canvas · IndexedDB.', '',
      'ART NOTE', 'All sprites, tiles, icons and UI frames are PLACEHOLDER pixel art',
      'generated by code at start-up (src/assets). They are structured as frame sheets',
      '(idle, walk, attack, hurt, dead) so final hand-made art can replace them 1:1.', '',
      'Design inspiration: dark-fantasy tower-defense manhwa genre (no IP reused).'
    ];
    this.put(E.UI.text(this, 380, 80, t.join('\n'), { size: 17, ox: 0.5, align: 'center', ls: 8 }));
  }
};

/* ==== src/main.js ==== */
/* Entry point: waits briefly for the web font, then boots Phaser at the 1280x720 reference resolution. */
E.bus = new Phaser.Events.EventEmitter();

E.start = function () {
  const panels = [E.EventPanel, E.BarracksPanel, E.InventoryPanel, E.BlacksmithPanel, E.RecruitPanel, E.TrainingPanel, E.CommandPanel, E.ExpeditionPanel, E.SavePanel, E.SettingsPanel, E.CreditsPanel];
  E.game = new Phaser.Game({
    type: Phaser.AUTO, width: E.W, height: E.H, parent: 'game', backgroundColor: '#05050c',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { pixelArt: false, antialias: true, roundPixels: true },
    input: { activePointers: 3 },
    scene: [E.BootScene, E.MenuScene, E.IntroScene, E.TownScene, E.FormationScene, E.BattleScene, ...panels]
  });
};

const wait = new Promise(res => {
  const done = () => res(); setTimeout(done, 1500);
  if (document.fonts && document.fonts.load) document.fonts.load('700 20px Cinzel').then(done, done); else done();
});
wait.then(() => E.start());
