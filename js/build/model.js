// ══════════════════════════════════════════════════
// MODEL — 状态管理 & S13 完整伤害公式
// 词缀: A区[+]加法 · B区[×]加法 · 独立区(嬗变)各自相乘
// ══════════════════════════════════════════════════

const BUILD_STORAGE_KEY = 'd4_build_config_v3';
const TRANSFER_KEY = 'd4_build_transfer';

let state = {
  currentClass: 'barbarian',
  buildName: '新方案',
  weaponMode: 'dual',
  slots: {},
};

function initState() {
  const c = CLASSES[0];
  state.currentClass = c.id; state.slots = {};
  getSlotsForClass(c.id).forEach(s => { state.slots[s.id] = emptySlot(); });
  state.weaponMode = (c.id === 'barbarian') ? 'dual' : 'main';
}

function switchClass(cid) {
  const old = state.slots;
  state.currentClass = cid; state.slots = {};
  getSlotsForClass(cid).forEach(s => { state.slots[s.id] = old[s.id] || emptySlot(); });
  state.weaponMode = (cid === 'barbarian') ? 'dual' : 'main';
}

function currentClass() { return CLASSES.find(c => c.id === state.currentClass); }
function currentSlots() { return getSlotsForClass(state.currentClass); }

function saveState() {
  localStorage.setItem(BUILD_STORAGE_KEY, JSON.stringify({
    currentClass: state.currentClass, buildName: state.buildName,
    weaponMode: state.weaponMode, slots: state.slots,
  }));
}
function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(BUILD_STORAGE_KEY) || '{}');
    state.currentClass = raw.currentClass || 'barbarian';
    state.buildName = raw.buildName || '新方案';
    state.weaponMode = raw.weaponMode || 'dual';
    state.slots = raw.slots || {};
  } catch(e) { initState(); }
  if (!state.slots || Object.keys(state.slots).length === 0) initState();
}

// ================================================================
// 属性汇总
// ================================================================
function aggregateStats() {
  const cls = currentClass();
  const agg = {
    wpn1:0, wpn2:0, wpn_add:0,
    mainStat:0,
    a_add:0, b_add:0,
    crit_chance:0, crit_dmg_add:0,
    vuln_add:0,
    aps_bonus:0,
    maxhp:0,
    op_add:0,
    c_multi:[],      // 独立乘区: 嬗变增倍 + 威能 + 宝石
    skill_pct:215, hits:1, is_dot:false,
    crit_active:true, vuln_active:true, vuln_uptime:80,
    op_active:false, op_stack_add:15, op_stacks:0,
    monster_dr:80, apply_dr:false,
  };

  const src = {
    mainStat:[], a_add:[], b_add:[], crit_chance:[], crit_dmg_add:[],
    vuln_add:[], aps_bonus:[], maxhp:[], op_add:[], wpn_add:[],
    c_multi:[], c_gems:[],
    _wpn1:0, _wpn2:0,
  };

  const clsName = cls.mainStatName;

  for (const slot of currentSlots()) {
    const cfg = state.slots[slot.id];
    if (!cfg || !cfg.enabled) continue;
    const ip = cfg.itemPower || 900;

    // 词缀 — 三区分别处理
    for (const a of (cfg.affixes || [])) {
      const lib = findAffixByName(a.name);
      var cat, val, label;
      if (lib) {
        cat = lib.category;
        val = a.valOverride != null ? a.valOverride : (a.val || 0);
        label = (lib.name === '力量') ? clsName : lib.name;
      } else {
        cat = a.cat || 'A_ADD';
        val = a.val || 0;
        label = a.name;
      }
      if (cat === 'C_MULTI') {
        // 独立区(嬗变): 各自相乘
        agg.c_multi.push({ name: label, val });
        src.c_multi.push({ from: slot.name, name: label, val });
      } else {
        addToAgg(agg, src, cat, val, slot.name, label);
      }
    }

    // 回火
    for (const t of (cfg.tempers || [])) {
      const lib = TEMPER_LIBRARY.find(x => x.name === t.name);
      if (!lib) continue;
      const v = scaleAffix({base:lib.base, max:lib.max}, ip, 0);
      addToAgg(agg, src, lib.category, v, slot.name, t.name + '(回火)');
    }

    // 威能
    if (cfg.aspect) {
      const lib = ASPECT_LIBRARY.find(x => x.name === cfg.aspect.name);
      if (lib && lib.category === 'C_MULTI') {
        var v = lib.value;
        if (slot.id === 'amulet' && lib.amuletOk) v = Math.round(v * 1.5);
        agg.c_multi.push({ name: lib.name, val: v });
        src.c_multi.push({ from: slot.name, name: lib.name, val: v });
      }
    }

    // 宝石
    if (cfg.gem) {
      const lib = GEM_LIBRARY.find(x => x.name === cfg.gem.name);
      if (!lib) continue;
      if (lib.category === 'C_MULTI') {
        agg.c_multi.push({ name: lib.name, val: lib.value });
        src.c_gems.push({ from: slot.name, name: lib.name, val: lib.value });
      } else if (lib.category === 'MAXHP') {
        agg.maxhp += lib.value;
        src.maxhp.push({ from: slot.name, name: lib.name, val: lib.value });
      }
    }
  }

  computeWeaponBase(agg);
  return { agg, src };
}

function addToAgg(agg, src, cat, val, slotName, label) {
  switch (cat) {
    case 'MAIN_STAT':  agg.mainStat += val; src.mainStat.push({ from:slotName, name:label, val }); break;
    case 'A_ADD':      agg.a_add += val;     src.a_add.push({ from:slotName, name:label, val }); break;
    case 'B_ADD':      agg.b_add += val;     src.b_add.push({ from:slotName, name:label, val }); break;
    case 'CRIT_CHANCE':agg.crit_chance += val; src.crit_chance.push({ from:slotName, name:label, val }); break;
  }
}

function computeWeaponBase(agg) {
  const s = state.slots; const cls = currentClass();
  if (cls.id === 'barbarian') {
    if (state.weaponMode === 'dual') {
      agg.wpn1 = (s['mainhand']&&s['mainhand'].enabled) ? wpnDmg('mainhand', s['mainhand'].itemPower) : 0;
      agg.wpn2 = (s['offhand']&&s['offhand'].enabled) ? wpnDmg('offhand', s['offhand'].itemPower) : 0;
    } else if (state.weaponMode === 'bludgeon') {
      agg.wpn1 = (s['bludgeon']&&s['bludgeon'].enabled) ? wpnDmg('bludgeon', s['bludgeon'].itemPower) : 0;
    } else {
      agg.wpn1 = (s['slash']&&s['slash'].enabled) ? wpnDmg('slash', s['slash'].itemPower) : 0;
    }
  } else {
    agg.wpn1 = (s['mainhand']&&s['mainhand'].enabled) ? wpnDmg('mainhand', s['mainhand'].itemPower) : 0;
    if (state.weaponMode === 'both' && s['offhand'] && s['offhand'].enabled)
      agg.wpn2 = wpnDmg('offhand', s['offhand'].itemPower);
  }
}
function wpnDmg(slotId, ip) {
  const all = currentSlots(); const def = all.find(s => s.id === slotId);
  return def && def.baseDmg ? ipScale(ip, def.baseDmg, Math.round(def.baseDmg*1.4)) : 0;
}

// ================================================================
// S13 完整伤害计算
// ================================================================
function calcFullDamage(agg) {
  const wpnBase = agg.wpn1 + (agg.wpn2 || 0);
  const skillMult = (agg.skill_pct || 215) / 100;
  const afterSkill = wpnBase * (1 + (agg.wpn_add || 0)/100) * skillMult;
  const statMult = 1 + (agg.mainStat || 0) / 900;
  const afterStat = afterSkill * statMult;
  const aMult = 1 + (agg.a_add || 0) / 100;
  const afterA = afterStat * aMult;
  const bMult = 1 + (agg.b_add || 0) / 100;
  const afterB = afterA * bMult;
  var cMult = 1;
  (agg.c_multi || []).forEach(x => { cMult *= (1 + x.val/100); });
  const afterC = afterB * cMult;
  const isDot = !!agg.is_dot;
  const critMult = 1 + 0.5 + (agg.crit_dmg_add || 0)/100;
  const normalHit = afterC;
  const critHit = afterC * critMult;
  const afterCrit = (!isDot && agg.crit_active) ? critHit : normalHit;
  const vulnMult = agg.vuln_active ? 1.2 : 1.0;
  const afterVuln = afterCrit * vulnMult;
  var finalHit = afterVuln, opResult = null;
  if (!isDot && agg.op_active) {
    const opBonus = (agg.op_stack_add || 0) * (agg.op_stacks || 0);
    const opBase = (afterA * vulnMult * cMult) + (agg.maxhp || 0);
    const opAfter = opBase * (1 + opBonus/100);
    const opCritF = 0.5 + 0.5 * critMult;
    opResult = { normal: opAfter, crit: opAfter * critMult, expected: opAfter * opCritF, hp: agg.maxhp || 0 };
    finalHit = opResult.expected;
  }
  const finalDisplay = agg.apply_dr ? finalHit * (1 - (agg.monster_dr || 0)/100) : finalHit;
  const aps = (1.0 + (agg.aps_bonus || 0)/100);
  const vulnUptime = (agg.vuln_uptime || 80) / 100;
  const critRate = (agg.crit_chance || 0) / 100;
  const hitsPerCast = agg.hits || 1;
  const avgPerHit = (!isDot) ? normalHit * (1 - critRate) + critHit * critRate : normalHit;
  const avgPerHitVuln = avgPerHit * (1 + (vulnMult - 1) * vulnUptime);
  const dps = avgPerHitVuln * aps * hitsPerCast;
  return { wpnBase, afterSkill, afterStat, afterA, afterB, afterC,
    normalHit, critHit, afterCrit, afterVuln, finalHit, finalDisplay,
    statMult, aMult, bMult, cMult, critMult, vulnMult,
    aps, dps, avgPerHit, critRate, opResult, isDot };
}

function exportToSimulator() {
  const { agg } = aggregateStats();
  return {
    wpn1: agg.wpn1, wpn2: agg.wpn2, wpn_add: agg.wpn_add,
    aps: 1.0 + agg.aps_bonus/100, str: agg.mainStat,
    skill_pct: agg.skill_pct, is_dot: agg.is_dot, hits: agg.hits,
    add_gear: agg.a_add, add_paragon: 0,
    crit_dmg_add: agg.crit_dmg_add, crit_chance: agg.crit_chance, crit_active: agg.crit_active,
    vuln_add: agg.vuln_add, vuln_active: agg.vuln_active, vuln_uptime: agg.vuln_uptime,
    maxhp: agg.maxhp, op_stack_add: agg.op_stack_add, op_stacks: agg.op_stacks, op_active: agg.op_active,
    monster_dr: agg.monster_dr, apply_dr: agg.apply_dr,
    multi_leg: agg.c_multi, multi_gem: [],
  };
}
function pushToSimulator() { localStorage.setItem(TRANSFER_KEY, JSON.stringify(exportToSimulator())); }
