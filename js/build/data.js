// ══════════════════════════════════════════════════
// DATA — S13 装备配置器 · 精简版
// 词缀池从 data/affixes.json 加载
// 分类规则: x 结尾→C_MULTI / x 开头→B_ADD / + 开头→查表或A_ADD
// ══════════════════════════════════════════════════

let AFFIX_POOL = [];

// ═══════════════════════════════════════════════ 职业 / 槽位定义 ═══════════════════════════════════════════════
const CLASSES = [
  { id:'barbarian',   name:'野蛮人',   icon:'🪓', mainStat:'str', mainStatName:'力量', mainStatRatio:900 },
  { id:'paladin',     name:'圣骑士',   icon:'🛡️', mainStat:'str', mainStatName:'力量', mainStatRatio:900 },
  { id:'druid',       name:'德鲁伊',   icon:'🐺', mainStat:'wil', mainStatName:'意志', mainStatRatio:900 },
  { id:'necromancer', name:'死灵法师', icon:'💀', mainStat:'int', mainStatName:'智力', mainStatRatio:900 },
  { id:'rogue',       name:'游侠',     icon:'🏹', mainStat:'dex', mainStatName:'敏捷', mainStatRatio:900 },
  { id:'sorcerer',    name:'巫师',     icon:'🔮', mainStat:'int', mainStatName:'智力', mainStatRatio:900 },
  { id:'warlock',     name:'术士',     icon:'🔥', mainStat:'int', mainStatName:'智力', mainStatRatio:900 },
  { id:'spiritborn',  name:'灵巫',     icon:'🌿', mainStat:'dex', mainStatName:'敏捷', mainStatRatio:900 },
];

const ARMOR_SLOTS = [
  { id:'helm', name:'头盔', icon:'⛑️' }, { id:'chest', name:'胸甲', icon:'👕' },
  { id:'gloves', name:'手套', icon:'🧤' }, { id:'pants', name:'裤子', icon:'👖' },
  { id:'boots', name:'鞋子', icon:'👢' },
];
const JEWELRY_SLOTS = [
  { id:'amulet', name:'护符', icon:'📿', powerBonus:1.5 },
  { id:'ring1', name:'戒指1', icon:'💍', powerBonus:1 },
  { id:'ring2', name:'戒指2', icon:'💍', powerBonus:1 },
];
const WEAPON_SLOTS = {
  barbarian: [
    { id:'mainhand', name:'主手武器', icon:'⚔️', baseDmg:1800 }, { id:'offhand', name:'副手武器', icon:'🗡️', baseDmg:1500 },
    { id:'bludgeon', name:'双手钝击', icon:'🔨', baseDmg:3000 }, { id:'slash', name:'双手斩击', icon:'🪓', baseDmg:3000 },
  ],
  paladin:     [{ id:'mainhand', name:'主手武器', icon:'⚔️', baseDmg:2200 }, { id:'offhand', name:'盾牌', icon:'🛡️', baseDmg:0, optional:true }],
  druid:       [{ id:'mainhand', name:'主手武器', icon:'🪓', baseDmg:2200 }, { id:'offhand', name:'图腾', icon:'🪵', baseDmg:0, optional:true }],
  necromancer: [{ id:'mainhand', name:'主手武器', icon:'🗡️', baseDmg:2000 }, { id:'offhand', name:'聚能器', icon:'💀', baseDmg:0, optional:true }],
  rogue:       [{ id:'mainhand', name:'主手武器', icon:'⚔️', baseDmg:1600 }, { id:'offhand', name:'副手/弓', icon:'🗡️', baseDmg:1400, optional:true }],
  sorcerer:    [{ id:'mainhand', name:'主手武器', icon:'🪄', baseDmg:1800 }, { id:'offhand', name:'聚能器', icon:'📖', baseDmg:0, optional:true }],
  warlock:     [{ id:'mainhand', name:'主手武器', icon:'🪄', baseDmg:1900 }, { id:'offhand', name:'法器', icon:'📜', baseDmg:0, optional:true }],
  spiritborn:  [{ id:'mainhand', name:'主手武器', icon:'🪄', baseDmg:1800 }, { id:'offhand', name:'副手', icon:'🪶', baseDmg:0, optional:true }],
};

function getSlotsForClass(cid) { return [...ARMOR_SLOTS, ...JEWELRY_SLOTS, ...(WEAPON_SLOTS[cid]||[])]; }

// ═══════════════════════════════════════════════ 词缀池加载 & 筛选 ═══════════════════════════════════════════════
const WEAPON_SLOT_IDS = ['mainhand','offhand','bludgeon','slash'];

async function loadAffixPool() {
  try {
    const res = await fetch('data/affixes.json');
    AFFIX_POOL = await res.json();
  } catch(e) {
    console.warn('加载词缀池失败，使用空池', e);
    AFFIX_POOL = [];
  }
}

function filterAffixes(classId, slotId) {
  const slotType = WEAPON_SLOT_IDS.includes(slotId) ? 'weapon' : slotId;
  return AFFIX_POOL.filter(a => {
    const classMatch = a.classes === 'all' || (Array.isArray(a.classes) && a.classes.includes(classId));
    const slotMatch = a.slots.includes(slotType);
    return classMatch && slotMatch;
  });
}

function findAffixByName(name) {
  return AFFIX_POOL.find(a => a.name === name);
}

// ═══════════════════════════════════════════════ 物品强度 (仅用于武器基础伤害) ═══════════════════════════════════════════════
const IP_PRESETS = [750, 800, 850, 900];

function ipScale(ip, lo, hi, imin=750, imax=900) {
  return Math.round(lo + (hi-lo) * Math.min(1, Math.max(0, (ip-imin)/(imax-imin))));
}
function scaleAffix(a, ip, mw) {
  return Math.round(ipScale(ip, a.base, a.max) * (1 + (mw||0) * 0.05));
}

// ═══════════════════════════════════════════════ 回火 / 宝石 / 威能 (保持不变) ═══════════════════════════════════════════════
const TEMPER_LIBRARY = [
  { name:'[+]% 近战伤害',    category:'A_ADD',  base:30, max:60, suffix:'%' },
  { name:'[+]% 物理伤害',    category:'A_ADD',  base:30, max:60, suffix:'%' },
  { name:'[+]% 核心技能伤害', category:'A_ADD',  base:30, max:60, suffix:'%' },
  { name:'[+]% 对精英伤害',  category:'A_ADD',  base:30, max:60, suffix:'%' },
  { name:'[+]% 全属性伤害',  category:'A_ADD',  base:20, max:45, suffix:'%' },
  { name:'[+]% 狂暴时伤害',  category:'A_ADD',  base:30, max:60, suffix:'%' },
  { name:'[+]% 流血目标伤害',category:'A_ADD',  base:30, max:60, suffix:'%' },
  { name:'[+]% 持续性伤害',  category:'A_ADD',  base:30, max:60, suffix:'%' },
  { name:'[+]% 远距离伤害',  category:'A_ADD',  base:30, max:60, suffix:'%' },
  { name:'[+]% 健康敌人伤害',category:'A_ADD',  base:30, max:60, suffix:'%' },
  { name:'[+]% 暴击伤害',    category:'CRIT_DMG', base:30, max:60, suffix:'%' },
  { name:'[+]% 易伤伤害',    category:'VULN_DMG', base:30, max:60, suffix:'%' },
  { name:'[+]% 压制伤害',    category:'OP_ADD',  base:30, max:60, suffix:'%' },
  { name:'最大生命值',      category:'MAXHP',   base:300, max:900, suffix:'' },
];

const ASPECT_LIBRARY = [
  { name:'优势大师之威能',     category:'C_MULTI', value:35,  desc:'资源提高伤害[×]%',         amuletOk:true  },
  { name:'元素使者之威能',     category:'C_MULTI', value:30,  desc:'元素伤害提高[×]%',         amuletOk:true  },
  { name:'优势精英之威能',     category:'C_MULTI', value:25,  desc:'对精英伤害提高[×]%',       amuletOk:true  },
  { name:'保护者之威能',       category:'MISC',    value:0,   desc:'对精英伤害时获得屏障',     amuletOk:true  },
  { name:'无畏酋长之威能',     category:'MISC',    value:0,   desc:'战吼冷却减少',             amuletOk:false },
];

const GEM_LIBRARY = [
  { name:'皇家红宝石',   category:'C_MULTI', value:20,  slotType:'weapon' },
  { name:'皇家绿宝石',   category:'C_MULTI', value:15,  slotType:'weapon' },
  { name:'皇家骷髅石',   category:'C_MULTI', value:12,  slotType:'weapon' },
  { name:'皇家钻石',     category:'C_MULTI', value:10,  slotType:'weapon' },
  { name:'皇家紫宝石',   category:'C_MULTI', value:10,  slotType:'weapon' },
  { name:'皇家黄宝石',   category:'MISC',    value:0,   slotType:'armor' },
];

const GEM_SLOT_MAP = {
  helm:'armor', chest:'armor', pants:'armor',
  mainhand:'weapon', offhand:'weapon', bludgeon:'weapon', slash:'weapon',
  amulet:'jewelry', ring1:'jewelry', ring2:'jewelry',
  gloves:null, boots:null
};
function gemsForSlot(sid) { const t = GEM_SLOT_MAP[sid]; return t ? GEM_LIBRARY.filter(g => g.slotType === t) : []; }

// ══════════════════════════════════════════════
// 天梯配装模版
// ══════════════════════════════════════════════
let LADDER_BUILDS = [];

async function loadLadderBuilds() {
  try {
    const res = await fetch('data/ladder_builds.json');
    LADDER_BUILDS = await res.json();
  } catch(e) {
    console.warn('加载天梯配装失败', e);
    LADDER_BUILDS = [];
  }
}

function getLadderBuildsForClass(cid) {
  return LADDER_BUILDS.filter(b => b.class === cid);
}

function applyLadderBuild(buildId) {
  const build = LADDER_BUILDS.find(b => b.id === buildId);
  if (!build) return false;
  if (build.class !== state.currentClass) {
    switchClass(build.class);
  }
  state.buildName = build.name + ' (天梯)';
  state.slots = JSON.parse(JSON.stringify(build.slots));
  state.weaponMode = build.weaponMode || 'main';
  saveState();
  renderAll();
  return true;
}


// ================================================================
// 我的方案 (本地存储)
// ================================================================
const SAVED_BUILDS_KEY = "d4_saved_builds_v1";

function getSavedBuilds() {
  try { return JSON.parse(localStorage.getItem(SAVED_BUILDS_KEY) || "[]"); } catch(e) { return []; }
}

function saveCurrentBuild(name) {
  if (!name || !name.trim()) return false;
  const builds = getSavedBuilds();
  const build = { id: "save_" + Date.now(), name: name.trim(), class: state.currentClass, weaponMode: state.weaponMode, slots: JSON.parse(JSON.stringify(state.slots)), createdAt: new Date().toISOString() };
  builds.push(build);
  localStorage.setItem(SAVED_BUILDS_KEY, JSON.stringify(builds));
  return true;
}

function loadSavedBuild(buildId) {
  const builds = getSavedBuilds();
  const build = builds.find(b => b.id === buildId);
  if (!build) return false;
  if (build.class !== state.currentClass) { switchClass(build.class); }
  state.buildName = build.name;
  state.slots = JSON.parse(JSON.stringify(build.slots));
  state.weaponMode = build.weaponMode || "main";
  saveState(); renderAll();
  return true;
}

function deleteSavedBuild(buildId) {
  let builds = getSavedBuilds();
  builds = builds.filter(b => b.id !== buildId);
  localStorage.setItem(SAVED_BUILDS_KEY, JSON.stringify(builds));
}
function emptySlot() {
  return { enabled:true, itemPower:900, affixes:[], tempers:[], aspect:null, gem:null };
}
