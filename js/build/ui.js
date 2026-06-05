// ══════════════════════════════════════════════════
// UI — DOM 渲染 & 交互
// 词缀行: text+datalist(库提示) + number(可覆盖值) + category(自动/手动)
// ══════════════════════════════════════════════════

function fmt(n) {
  if (n == null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(2)+'M';
  if (Math.abs(n) >= 1e4) return (n/1e3).toFixed(1)+'K';
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1);
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

function renderClassSelect() {
  document.getElementById('class-select').innerHTML = CLASSES.map(c =>
    `<option value="${c.id}" ${c.id===state.currentClass?'selected':''}>${c.icon} ${c.name}</option>`
  ).join('');
}
function onClassChange(cid) {
  if (cid === state.currentClass) return;
  switchClass(cid); saveState(); renderAll();
}

// ---- 紧凑摘要栏 ----
function renderSummaryBar() {
  const { agg } = aggregateStats();
  const cls = currentClass();
  const items = [
    { label:'武器伤害', val: fmt(agg.wpn1) + (agg.wpn2>0?' + '+fmt(agg.wpn2):''), em:true },
    { label:cls.mainStatName, val: fmt(agg.mainStat) },
    { label:'A区 [+]%', val: '+' + agg.a_add + '%' },
    { label:'B区 [×]%', val: '+' + agg.b_add + '%' },
    { label:'暴击率', val: agg.crit_chance + '%' },
    { label:'独立乘区', val: agg.c_multi.length + '个' },
    { label:'最大生命', val: fmt(agg.maxhp) },
  ];
  document.getElementById('summary-bar').innerHTML = items.map((it,i) =>
    `${i>0?'<div class="sb-sep"></div>':''}<div class="sb-item"><span class="sb-label">${it.label}</span><span class="sb-val${it.em?' em':''}">${it.val}</span></div>`
  ).join('');
}

// ---- 槽位网格 ----
let expandedSlot = null;

function renderSlotGrid() {
  const ctr = document.getElementById('slot-grid');
  const slots = currentSlots();
  if (!slots.length) {
    ctr.innerHTML = '<div class="empty-state"><div class="empty-icon">🛡️</div><div class="empty-text">请选择职业</div></div>';
    return;
  }
  ctr.innerHTML = slots.map(s => {
    const cfg = state.slots[s.id] || emptySlot();
    const ex = expandedSlot === s.id;
    return `<div class="slot-card">
      <div class="slot-card-hd" onclick="toggleSlot('${s.id}')">
        <div class="slot-card-left">
          <label class="cbrow" onclick="event.stopPropagation()" style="padding:0;gap:6px">
            <input type="checkbox" ${cfg.enabled?'checked':''} onchange="toggleSlotEnabled('${s.id}',this.checked)"><span></span>
          </label>
          <span class="slot-icon">${s.icon}</span>
          <span class="slot-name">${s.name}</span>
          <span class="slot-summary">${getSlotSummary(s.id, cfg)}</span>
        </div>
        <span class="slot-expand">${ex?'▶':'▼'}</span>
      </div>
      ${ex ? renderSlotDetail(s, cfg) : ''}
    </div>`;
  }).join('');
}

function getSlotSummary(sid, cfg) {
  if (!cfg.enabled) return '<span class="sum-muted">已禁用</span>';
  const p = [];
  if (cfg.affixes && cfg.affixes.length) p.push(cfg.affixes.length+'词缀');
  if (cfg.aspect) p.push(cfg.aspect.name);
  if (cfg.gem) p.push(cfg.gem.name);
  return p.length ? p.join(' · ') : '<span class="sum-muted">未配置</span>';
}

function toggleSlot(sid) { expandedSlot = (expandedSlot === sid) ? null : sid; renderSlotGrid(); }
function toggleSlotEnabled(sid, en) {
  if (!state.slots[sid]) state.slots[sid] = emptySlot();
  state.slots[sid].enabled = en; saveState(); renderAll();
}

// ================================================================
// 槽位详情 — 词缀行 = text(datalist) + number(可覆盖) + category
// ================================================================
function renderSlotDetail(sdef, cfg) {
  const sid = sdef.id, ip = cfg.itemPower||900;
  const avAspects = ASPECT_LIBRARY.filter(a => !a.cls || a.cls === state.currentClass);
  const allAff = filterAffixes(state.currentClass, sid);
  const affCount = (cfg.affixes||[]).length;

  return `<div class="slot-detail">
    <div class="detail-row">
      <div class="detail-field"><label>物品强度</label>
        <select onchange="updateSlotField('${sid}','itemPower',parseInt(this.value))">
          ${IP_PRESETS.map(p=>`<option value="${p}" ${p===ip?'selected':''}>${p}</option>`).join('')}
        </select></div>
      ${sdef.powerBonus?`<span class="ftag tag-x">护符×${sdef.powerBonus}</span>`:""}
    </div>

    <!-- 词缀区：无上限，datalist 自由输入 -->
    <div class="detail-section">
      <div class="detail-section-hd">词缀 (${affCount}条) — 下拉选择或直接输入自定义</div>
      <div class="affix-list">${renderAffixRows(sid, cfg.affixes||[], allAff)}</div>
      <button class="btn-add-sm" onclick="openAffixPicker('${sid}')">+ 添加词缀</button>
    </div>

    <div class="detail-section">
      <div class="detail-section-hd">回火 (${(cfg.tempers||[]).length}/2)</div>
      <div class="affix-list">${renderTemperRows(sid, cfg.tempers||[], ip)}</div>
      ${(cfg.tempers||[]).length < 2 ? `<button class="btn-add-sm" onclick="addTemper('${sid}')">+ 添加回火</button>` : ''}
    </div>
    <div class="detail-section">
      <div class="detail-section-hd">传奇威能</div>
      <select class="full" onchange="updateAspect('${sid}',this.value)">
        <option value="">— 无威能 —</option>
        ${avAspects.map(a=>`<option value="${a.name}" ${cfg.aspect&&cfg.aspect.name===a.name?'selected':''}>${a.name} — ${a.desc}</option>`).join('')}
      </select>
      ${cfg.aspect && sid==='amulet' ? `<label class="cbrow" style="margin-top:4px;font-size:11px"><input type="checkbox" ${cfg.aspect.amuletBoosted?'checked':''} onchange="toggleAmuletBoost('${sid}',this.checked)"><span>护符效果 ×1.5</span></label>` : ''}
    </div>
    ${renderGemSection(sid, cfg)}
  </div>`;
}

function renderGemSection(sid, cfg) {
  const gems = gemsForSlot(sid); if (!gems.length) return '';
  return `<div class="detail-section"><div class="detail-section-hd">宝石/符文</div>
    <select class="full" onchange="updateGem('${sid}',this.value)">
      <option value="">— 无宝石 —</option>
      ${gems.map(g=>`<option value="${g.name}" ${cfg.gem&&cfg.gem.name===g.name?'selected':''}>${g.name} (${g.category==='C_MULTI'?'[×]'+g.value+'%':'+'+g.value})</option>`).join('')}
    </select></div>`;
}

// ---- 词缀行：简化显示（添加通过弹窗完成）----
function renderAffixRows(sid, affixes, available) {
  const rows = affixes.map((a, i) => {
    const lib = findAffixByName(a.name);
    const isCustom = !lib;
    let displayVal;
    if (isCustom) {
      displayVal = a.val || 0;
    } else {
      displayVal = a.valOverride != null ? a.valOverride : (a.val || 0);
    }
    const cat = isCustom ? (a.cat || 'A_ADD') : lib.category;
    const catLabel = getCatLabel(cat);
    const suffix = (cat === 'MAXHP' || cat === 'MAIN_STAT') ? '' : '%';

    let valHtml = '<span class="affix-val-display">' + fmt(displayVal) + suffix + '</span>';
    if (a.valOverride != null) {
      valHtml += '<span class="affix-val-override-badge">手动</span>';
    }
    return '<div class="affix-row">' +
      '<div class="affix-name-cell"><span class="affix-name-text">' + escHtml(a.name) + '</span><span class="affix-cat-badge cat-' + cat + '">' + catLabel + '</span>' +
      (isCustom ? '<span class="affix-custom-dot" onclick="cycleAffixCat(\'' + sid + '\',' + i + ')" title="点击切换类别">●</span>' : '') +
      '</div>' +
      '<div class="affix-val-cell" onclick="toggleAffixOverride(\'' + sid + '\',' + i + ',this)" title="点击覆盖数值">' + valHtml + '</div>' +
      '<button class="btn-del-sm" onclick="removeAffix(\'' + sid + '\',' + i + ')" title="移除">×</button>' +
      '</div>';
  }).join('');
  return rows;
}

function escHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// 类别轮换(自定义词缀)
const CAT_CYCLE = ['A_ADD','B_ADD','MAIN_STAT','CRIT_CHANCE','CRIT_DMG','VULN_DMG','APS','MAXHP','OP_ADD','WPN_ADD','C_MULTI'];
function cycleAffixCat(sid, i) {
  const c = state.slots[sid]; if(!c||!c.affixes) return;
  const a = c.affixes[i]; if(!a || findAffixByName(a.name)) return; // 库内词缀不可切换
  const cur = a.cat || 'A_ADD';
  const idx = CAT_CYCLE.indexOf(cur);
  a.cat = CAT_CYCLE[(idx + 1) % CAT_CYCLE.length];
  saveState(); renderAll();
}

// ---- 回火行 ----
function renderTemperRows(sid, tempers, ip) {
  return (tempers||[]).map((t,i) => {
    const lib = TEMPER_LIBRARY.find(x=>x.name===t.name);
    const val = lib ? scaleAffix({base:lib.base,max:lib.max}, ip, 0) : 0;
    const sfx = lib ? lib.suffix : '';
    const cat = lib ? getCatLabel(lib.category) : '';
    return `<div class="affix-row">
      <select onchange="updateTemperName('${sid}',${i},this.value)" style="flex:1">
        <option value="">— 选择回火 —</option>
        ${TEMPER_LIBRARY.map(x=>`<option value="${x.name}" ${x.name===t.name?'selected':''}>${x.name}</option>`).join('')}
      </select>
      <span class="affix-val">${fmt(val)}${sfx}</span>
      <span class="affix-cat">${cat}</span>
      <button class="btn-del-sm" onclick="removeTemper('${sid}',${i})" title="移除">×</button>
    </div>`;
  }).join('');
}

function getCatLabel(cat) {
  const m = { MAIN_STAT:'主属性', A_ADD:'A区[+]', B_ADD:'B区[×]', CRIT_CHANCE:'暴率', C_MULTI:'独立×', MISC:'其他' };
  return m[cat] || cat;
}

// ---- 字段操作 ----
function updateSlotField(sid, f, v) { if(!state.slots[sid]) state.slots[sid]=emptySlot(); state.slots[sid][f]=v; saveState(); renderAll(); }

function addAffix(sid) {
  if(!state.slots[sid]) state.slots[sid]=emptySlot();
  const cfg=state.slots[sid]; if(!cfg.affixes) cfg.affixes=[];
  const av=filterAffixes(state.currentClass, sid);
  const used=new Set(cfg.affixes.map(a=>a.name));
  cfg.affixes.push({name:(av.find(a=>!used.has(a.name))||av[0]||{name:''}).name});
  saveState(); renderAll();
}
function removeAffix(sid,i) { const c=state.slots[sid]; if(!c||!c.affixes) return; c.affixes.splice(i,1); saveState(); renderAll(); }
function updateAffixName(sid,i,n) {
  const c=state.slots[sid]; if(!c||!c.affixes) return;
  if(!n || !n.trim()) { c.affixes.splice(i,1); saveState(); renderAll(); return; }
  c.affixes[i].name = n;
  // 如果匹配库，清除自定义字段
  const lib = findAffixByName(n);
  if (lib) { delete c.affixes[i].cat; delete c.affixes[i].val; delete c.affixes[i].valOverride; }
  else if (!c.affixes[i].cat) { c.affixes[i].cat = 'A_ADD'; }
  saveState(); renderAll();
}
function toggleAffixOverride(sid, i, cell) {
  const c = state.slots[sid]; if (!c || !c.affixes) return;
  const a = c.affixes[i]; if (!a) return;
  const lib = findAffixByName(a.name);
    

  // 如果已有覆盖值，单击清除覆盖（恢复自动值）
  if (a.valOverride != null) {
    delete a.valOverride;
    saveState(); renderAll();
    return;
  }

  // 内联编辑：替换为 input
  const curVal = a.valOverride != null ? a.valOverride : (a.val || 0);
  const suffix = '%';
  cell.innerHTML = '<input class="affix-val-input" type="number" value="' + curVal + '" min="0" style="width:60px;background:var(--ink-0);border:1.5px solid var(--fire-2);color:var(--fire-1);font-family:\'Share Tech Mono\',monospace;font-size:12px;padding:3px 4px;border-radius:3px;outline:none;text-align:center">';
  const inp = cell.querySelector('input');
  inp.focus();
  inp.select();

  const finish = () => {
    const v = parseFloat(inp.value);
    if (!isNaN(v)) { a.val = v; delete a.valOverride; }
    saveState(); renderAll();
  };
  inp.addEventListener('blur', finish);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { inp.blur(); } });
}
function updateAffixVal(sid,i,v) {
  const c=state.slots[sid]; if(!c||!c.affixes) return;
  const lib = findAffixByName(c.affixes[i].name);
  if (lib) c.affixes[i].valOverride = v;
  else c.affixes[i].val = v;
  saveState(); renderAll();
}

function addTemper(sid) {
  if(!state.slots[sid]) state.slots[sid]=emptySlot();
  const c=state.slots[sid]; if(!c.tempers) c.tempers=[];
  if(c.tempers.length>=2) return;
  const used=new Set(c.tempers.map(t=>t.name));
  c.tempers.push({name:(TEMPER_LIBRARY.find(t=>!used.has(t.name))||TEMPER_LIBRARY[0]).name});
  saveState(); renderAll();
}
function removeTemper(sid,i) { const c=state.slots[sid]; if(!c||!c.tempers) return; c.tempers.splice(i,1); saveState(); renderAll(); }
function updateTemperName(sid,i,n) { const c=state.slots[sid]; if(!c||!c.tempers) return; if(!n) c.tempers.splice(i,1); else c.tempers[i].name=n; saveState(); renderAll(); }
function updateAspect(sid,n) { if(!state.slots[sid]) state.slots[sid]=emptySlot(); state.slots[sid].aspect=n?{name:n,amuletBoosted:false}:null; saveState(); renderAll(); }
function toggleAmuletBoost(sid,b) { const c=state.slots[sid]; if(!c||!c.aspect) return; c.aspect.amuletBoosted=b; saveState(); renderAll(); }
function updateGem(sid,n) { if(!state.slots[sid]) state.slots[sid]=emptySlot(); state.slots[sid].gem=n?{name:n}:null; saveState(); renderAll(); }

// ---- 详细汇总面板 (不变) ----
function renderDetailSummary() {
  const { agg, src } = aggregateStats();
  const cls = currentClass();
  const r = calcFullDamage(agg);
  const ctr = document.getElementById('detail-summary-wrap');

  const hasSrc = src.mainStat.length + src.a_add.length + src.b_add.length +
    src.crit_chance.length + src.crit_dmg_add.length + src.vuln_add.length +
    src.maxhp.length + src.c_multi.length + src.c_gems.length > 0;

  ctr.innerHTML = `<div class="detail-summary">
    <div class="ds-header">
      <span class="ds-header-title">装备属性汇总 &amp; 伤害链路</span>
      <span class="ds-header-badge">${cls.name} ${cls.icon}</span>
    </div>
    <div class="ds-body">
      <div class="detail-section-hd" style="margin-bottom:6px">S13 完整伤害计算</div>
      <div class="ds-formula">
        <div><span class="f-label">① 武器基础</span> <span class="f-var">${fmt(agg.wpn1)}</span>${agg.wpn2>0?` <span class="f-op">+</span> <span class="f-var">${fmt(agg.wpn2)}</span>`:''}${agg.wpn_add>0?` <span class="f-op">×</span><span class="f-var">(1+${agg.wpn_add}%)</span>`:''} <span class="f-op">=</span> <span class="f-highlight">${fmt(Math.round(r.wpnBase*(1+agg.wpn_add/100)))}</span></div>
        <div class="f-indent"><span class="f-op">×</span> <span class="f-label">② 主属区</span> <span class="f-var">(1 + ${fmt(agg.mainStat)} / 900)</span> <span class="f-op">=</span> <span class="f-emerald">×${r.statMult.toFixed(3)}</span></div>
        <div class="f-indent"><span class="f-op">×</span> <span class="f-label">③ A类区[+]%</span> <span class="f-var">(1 + ${agg.a_add}%)</span> <span class="f-op">=</span> <span class="f-emerald">×${r.aMult.toFixed(3)}</span></div>
        <div class="f-indent"><span class="f-op">×</span> <span class="f-label">④ B类区[×]%</span> <span class="f-var">(1 + ${agg.b_add}%)</span> <span class="f-op">=</span> <span class="f-emerald">×${r.bMult.toFixed(3)}</span> <span style="font-size:10px;color:var(--amber)"> S13新增 内部加法</span></div>
        ${agg.c_multi.length>0 ? `<div class="f-indent"><span class="f-op">×</span> <span class="f-label">⑤ 独立乘区</span> ${agg.c_multi.map(x=>`[${x.name} ×${(1+x.val/100).toFixed(2)}]`).join(' ')}</div>` : ''}
        <div class="f-indent"><span class="f-op">×</span> <span class="f-label">⑥ 暴击区</span> <span class="f-var">(1.5 + ${agg.crit_dmg_add}%)</span> <span class="f-op">=</span> <span class="f-emerald">×${r.critMult.toFixed(3)}</span> <span class="f-label">暴率 ${agg.crit_chance}%</span></div>
        <div class="f-indent"><span class="f-op">×</span> <span class="f-label">⑦ 易伤区</span> <span class="f-var">1.2</span></div>
        ${r.opResult ? `<div class="f-indent"><span class="f-op">×</span> <span class="f-label">⑧ 压制区</span> <span class="f-var">(基础 + HP ${fmt(r.opResult.hp)}) × 加成</span></div>` : ''}
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border-faint)">
          <span class="f-label">单次暴击命中</span> <span class="f-op">=</span> <span class="f-result">${fmt(Math.round(r.critHit))}</span>
          <span class="f-label" style="margin-left:8px">DPS</span> <span class="f-op">=</span> <span class="f-result">${fmt(Math.round(r.dps))}</span>
          ${r.opResult ? `<div style="margin-top:2px"><span class="f-label">压制期望</span> <span class="f-op">=</span> <span class="f-result" style="color:var(--amber)">${fmt(Math.round(r.opResult.expected))}</span></div>` : ''}
        </div>
      </div>
      ${!hasSrc ? '<div class="empty-sources">尚未配置装备，添加词缀/威能/宝石后显示属性来源</div>' : ''}
      ${srcTable(cls.mainStatName, src.mainStat, agg.mainStat, '')}
      ${srcTable('A类区 [+]% (内部加法)', src.a_add, agg.a_add, '%')}
      ${srcTable('B类区 [×]% (内部加法)', src.b_add, agg.b_add, '%', true)}
      ${srcTable('暴击率 [+]%', src.crit_chance, agg.crit_chance, '%')}
                        ${srcTable('最大生命值', src.maxhp, agg.maxhp, '')}
                  ${src.c_multi.length ? srcMultiGrouped(src.c_multi, "独立乘区 — 威能") : ""}
      ${src.c_gems.length ? srcMultiGrouped(src.c_gems, "独立乘区 — 宝石") : ""}
    </div>
  </div>`;
}

function srcTable(title, sources, total, suffix, isB) {
  if (!sources || sources.length === 0) return '';
  const tag = isB ? '<span style="color:var(--amber);font-size:9px;margin-left:6px">S13 新增</span>' : '';
  const plus = suffix === '%' ? '+' : '';
  
  // 按 name 分组
  const groups = new Map();
  for (const s of sources) {
    if (!groups.has(s.name)) groups.set(s.name, []);
    groups.get(s.name).push(s);
  }
  
  // 渲染每一组
  let rows = '';
  for (const [gname, items] of groups) {
    if (items.length === 1) {
      const s = items[0];
      rows += `<tr><td class="td-from">${s.from}</td><td>${s.name}</td><td class="td-val">${plus}${fmt(s.val)}${suffix}</td></tr>`;
    } else {
      // 多个相同词缀：展开每行 + 小计行
      const sum = items.reduce((a,b) => a + b.val, 0);
      rows += items.map(s => 
        `<tr><td class="td-from">${s.from}</td><td>${s.name}</td><td class="td-val">${plus}${fmt(s.val)}${suffix}</td></tr>`
      ).join('');
      // 小计行 - 显示合并过程
      const expr = items.map(s => `${s.from} ${plus}${fmt(s.val)}${suffix}`).join(' <span style="color:var(--text-muted)">+</span> ');
      rows += `<tr style="border-top:1px dashed var(--border-faint)">
        <td colspan="2" style="font-size:10px;color:var(--text-muted);padding:3px 8px">
          ${expr} <span class="f-op">=</span> <span style="font-weight:600;color:var(--fire-1)">${gname}</span> <span style="color:var(--emerald);font-weight:600">${plus}${fmt(sum)}${suffix}</span>
        </td>
        <td class="td-val" style="color:var(--emerald);font-weight:600">${plus}${fmt(sum)}${suffix}</td>
      </tr>`;
    }
  }
  
  return `<div class="detail-section-hd" style="margin-top:8px">${title}${tag}</div>
    <table class="ds-table">
      ${rows}
      <tr><td colspan="2" style="font-weight:600;color:var(--text-primary)">合计</td><td class="td-total">${plus}${fmt(total)}${suffix}</td></tr>
    </table>`;
}
function srcMultiGrouped(sources, title) {
  if (!sources || sources.length === 0) return '';
  const groups = new Map();
  for (const s of sources) {
    if (!groups.has(s.name)) groups.set(s.name, []);
    groups.get(s.name).push(s);
  }
  let rows = '';
  for (const [gname, items] of groups) {
    if (items.length === 1) {
      const s = items[0];
      rows += `<tr><td class="td-from">${s.from}</td><td>${s.name}</td><td class="td-val">[×]${s.val}%</td></tr>`;
    } else {
      const sum = items.reduce((a,b) => a + b.val, 0);
      rows += items.map(s =>
        `<tr><td class="td-from">${s.from}</td><td>${s.name}</td><td class="td-val">[×]${s.val}%</td></tr>`
      ).join('');
      const expr = items.map(s => `${s.from} [×]${s.val}%`).join(' <span style="color:var(--text-muted)">+</span> ');
      rows += `<tr style="border-top:1px dashed var(--border-faint)">
        <td colspan="2" style="font-size:10px;color:var(--text-muted);padding:3px 8px">
          ${expr} <span class="f-op">=</span> <span style="font-weight:600;color:var(--fire-1)">${gname}</span> <span style="color:var(--emerald);font-weight:600">[×]${sum}%</span>
        </td>
        <td class="td-val" style="color:var(--emerald);font-weight:600">[×]${sum}%</td>
      </tr>`;
    }
  }
  return `<div class="detail-section-hd" style="margin-top:8px">${title}</div><table class="ds-table">${rows}</table>`;
}



// ---- 天梯配装选择 ----

// ---- 选中状态 ----
let _selectedLadderId = null;
let _selectedSavedId = null;
function renderLadderBuildCards() {
  const ctr = document.getElementById("ladder-cards");
  if (!ctr) return;
  const builds = getLadderBuildsForClass(state.currentClass);
  if (builds.length === 0) { ctr.innerHTML = '<div class="saved-empty">暂无配装模版</div>'; return; }
  ctr.innerHTML = builds.map(b => {
    const applied = state.buildName === (b.name + " (天梯)");
    const sel = _selectedLadderId === b.id;
    var cls = 'ladder-card';
    if (applied) cls += ' applied';
    if (sel) cls += ' selected';
    return '<div class="' + cls + '" onclick="selectLadderCard(\x27' + b.id + '\x27)">' +
      '<div class="lc-name">' + escHtml(b.name) + '</div>' +
      '<div class="lc-desc">' + escHtml(b.desc) + '</div>' +
      '<button class="lc-apply" onclick="event.stopPropagation();handleApplyLadderCard(\x27' + b.id + '\x27)">应用</button>' +
      '</div>';
  }).join("");
}







function selectLadderCard(buildId) {
  _selectedLadderId = (_selectedLadderId === buildId) ? null : buildId;
  _selectedSavedId = null;
  renderLadderBuildCards();
  renderSavedBuilds();
}
function handleApplyLadderCard(buildId) {
  const build = LADDER_BUILDS.find(b => b.id === buildId);
  if (!build) return;
  if (!confirm('确定加载天梯配装 "' + build.name + '"？当前配置将被替换。')) return;
  if (applyLadderBuild(buildId)) { _selectedLadderId = null; _selectedSavedId = null; toast('已加载天梯配装: ' + build.name); } else { toast('加载失败'); }
}

function renderSavedBuilds() {
  const ctr = document.getElementById("saved-builds-list");
  if (!ctr) return;
  const builds = getSavedBuilds();
  if (builds.length === 0) { ctr.innerHTML = '<div class="saved-empty">暂无保存方案<br>点击上方按钮保存</div>'; return; }
  const clsMap = {}; CLASSES.forEach(c => { clsMap[c.id] = c.name; });
  ctr.innerHTML = builds.map(b => {
    const clsName = clsMap[b.class] || b.class;
    const sel = _selectedSavedId === b.id;
    return '<div class="saved-item' + (sel ? ' selected' : '') + '" onclick="selectSavedBuild(\x27' + b.id + '\x27)">' +
      '<div class="si-name" title="' + escHtml(b.name) + '">' + escHtml(b.name) + '</div>' +
      '<div class="si-class">' + clsName + ' · ' + (b.weaponMode || 'main') + '</div>' +
      '<div class="si-actions">' +
        '<button class="si-load" onclick="event.stopPropagation();handleLoadSavedBuild(\x27' + b.id + '\x27)">加载</button>' +
        '<button class="si-del" onclick="event.stopPropagation();handleDeleteSavedBuild(\x27' + b.id + '\x27)">删除</button>' +
      '</div></div>';
  }).join("");
}




function selectSavedBuild(buildId) {
  _selectedSavedId = (_selectedSavedId === buildId) ? null : buildId;
  _selectedLadderId = null;
  renderLadderBuildCards();
  renderSavedBuilds();
}
function handleSaveBuild() {
  const name = prompt("请输入方案名称:", state.buildName || "新方案");
  if (!name || !name.trim()) return;
  if (saveCurrentBuild(name.trim())) { toast("方案已保存: " + name.trim()); renderSavedBuilds(); }
}

function handleLoadSavedBuild(buildId) {
  const builds = getSavedBuilds();
  const build = builds.find(b => b.id === buildId);
  if (!build) return;
  if (!confirm('确定加载方案 "' + build.name + '"？当前配置将被替换。')) return;
  if (loadSavedBuild(buildId)) { _selectedLadderId = null; _selectedSavedId = null; toast('已加载方案: ' + build.name); }
}

function handleDeleteSavedBuild(buildId) {
  const builds = getSavedBuilds();
  const build = builds.find(b => b.id === buildId);
  if (!build) return;
  if (!confirm('确定删除方案 "' + build.name + '"？')) return;
  deleteSavedBuild(buildId); _selectedSavedId = null; renderSavedBuilds(); toast('方案已删除');
}

// ---- 主题切换 ----
function switchTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("d4_theme_v1", theme);
  // Update button active states
  document.querySelectorAll(".theme-select-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.theme === theme);
  });
}

function initTheme() {
  const saved = localStorage.getItem("d4_theme_v1") || "dark-fantasy";
  switchTheme(saved);
}
function renderAll() { renderClassSelect(); renderLadderBuildCards(); renderSavedBuilds(); renderSummaryBar(); renderSlotGrid(); renderDetailSummary(); }

function handlePushToSim() { pushToSimulator(); toast('⚔️ 已推送到模拟器'); }
function handleExportJSON() {
  const data = exportToSimulator();
  const blob = new Blob([JSON.stringify({name:state.buildName,data},null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=`D4_Build_${state.buildName.replace(/[\\/:*?"<>|]/g,'_')}_${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
  toast('📤 已导出 JSON');
}
function handleImportJSON() { document.getElementById('import-file-input').value=''; document.getElementById('import-file-input').click(); }
function handleImportFile(input) {
  const f=input.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=e=>{ try{ const o=JSON.parse(e.target.result); if(!o||!o.name||!o.data){toast('❌ 格式错误');return;} state.buildName=o.name+' (导入)'; if(o.data.slots){ state.slots=o.data.slots; } if(o.data.weaponMode){ state.weaponMode=o.data.weaponMode; } if(o.data.currentClass){ state.currentClass=o.data.currentClass; } saveState(); renderAll(); toast('📥 已导入：'+o.name); }catch(err){toast('❌ 解析失败');} };
  r.onerror=()=>toast('❌ 读取失败');
  r.readAsText(f,'utf-8');
}
function handleClearAll() { if(!confirm('确认清空？')) return; initState(); saveState(); renderAll(); toast('已清空'); }



// ══════════════════════════════════════════════════
// AFFIX PICKER MODAL
// ══════════════════════════════════════════════════

let _pickerSlot = null;
let _pickerSelected = {};

function openAffixPicker(sid) {
  _pickerSlot = sid;
  const sdef = currentSlots().find(s => s.id === sid);
  document.getElementById('picker-slot-name').innerText = '选择词缀 — ' + (sdef ? sdef.name : sid);
  // 初始化已选 = 当前槽位已有词缀
  const cfg = state.slots[sid] || emptySlot();
  _pickerSelected = {};
  _pickerValues = {};
  (cfg.affixes || []).forEach(a => { _pickerSelected[a.name] = true; _pickerValues[a.name] = a.val || 0; });
  document.getElementById('picker-search-input').value = '';
  renderAffixPickerContent(sid, '');
  document.getElementById('affix-picker-overlay').classList.remove('hidden');
}

function closeAffixPicker() {
  document.getElementById('affix-picker-overlay').classList.add('hidden');
  _pickerSlot = null;
  _pickerSelected = {};
  _pickerValues = {};
}

function renderAffixPickerContent(sid, filter) {
  const body = document.getElementById('picker-body');
  const all = filterAffixes(state.currentClass, sid);
  const f = (filter || '').toLowerCase();
  const filtered = f ? all.filter(a => a.name.toLowerCase().includes(f)) : all;

  // 按类别分组
  const catNames = { A_ADD:'A区 [+] 加法', B_ADD:'B区 [×] 前缀', C_MULTI:'独立乘区', MAIN_STAT:'主属性', CRIT_CHANCE:'暴击率', MISC:'其他' };
  const groups = {};
  Object.keys(catNames).forEach(k => { groups[k] = []; });
  groups.OTHER = [];
  filtered.forEach(a => {
    const cat = a.category || 'OTHER';
    if (groups[cat]) groups[cat].push(a);
    else groups.OTHER.push(a);
  });

  let html = '';
    

  for (const [cat, affixes] of Object.entries(groups)) {
    if (!affixes.length) continue;
    html += '<div class="picker-group-label">' + (catNames[cat] || cat) + '</div>';
    affixes.forEach(a => {
      const sel = _pickerSelected[a.name];
      const suffix = a.suffix || '%';
      html += '<div class="picker-row' + (sel ? ' selected' : '') + '" onclick="togglePickerAffix(\'' + escHtml(a.name) + '\',this)">';
      html += '<label class="plabel"><input type="checkbox" ' + (sel ? 'checked' : '') + ' onchange="togglePickerCheckbox(this, \'' + escHtml(a.name) + '\')">' + a.name + '</label>';
      html += '<input class="picker-val-input" type="number" value="' + (_pickerValues[a.name] || '') + '" placeholder="数值" onclick="event.stopPropagation()" oninput="updatePickerValue(\'' + escHtml(a.name) + '\', this.value)" style="width:70px;background:var(--ink-0);border:1.5px solid var(--border-faint);color:var(--text-primary);font-family:\'Share Tech Mono\',monospace;font-size:12px;padding:3px 5px;border-radius:3px;outline:none;text-align:center">';
      html += '<span class="prange">' + (catNames[a.category] || a.category || '其他') + '</span>';
            html += '</div>';
    });
  }

  // 自定义词缀行
  html += '<div class="picker-custom-row">';
  html += '<input class="p-cust-name" id="picker-cust-name" placeholder="自定义词缀名称...">';
  html += '<input class="p-cust-val" id="picker-cust-val" type="number" placeholder="值" min="0">';
  html += '<select id="picker-cust-cat">';
  const catLabels = { A_ADD:'A区[+]', B_ADD:'B区[×]', C_MULTI:'独立×', MAIN_STAT:'主属性', CRIT_CHANCE:'暴率', MISC:'其他' };
  for (const [k, v] of Object.entries(catLabels)) {
    html += '<option value="' + k + '">' + v + '</option>';
  }
  html += '</select>';
  html += '<button onclick="addCustomAffix()" title="添加自定义词缀">+</button>';
  html += '</div>';

  body.innerHTML = html;
  updatePickerSummary();
}

function togglePickerAffix(name, row) {
  if (_pickerSelected[name]) { delete _pickerSelected[name]; } else { _pickerSelected[name] = true; }
  if (row) {
    row.classList.toggle('selected', _pickerSelected[name]);
    const cb = row.querySelector('input[type=checkbox]');
    if (cb) cb.checked = _pickerSelected[name];
  }
  updatePickerSummary();
}

function togglePickerCheckbox(cb, name) {
  if (cb.checked) { _pickerSelected[name] = true; } else { delete _pickerSelected[name]; }
  const row = cb.closest('.picker-row');
  if (row) row.classList.toggle('selected', cb.checked);
  updatePickerSummary();
}

function removePickerAffix(name) {
  delete _pickerSelected[name];
  const filter = document.getElementById('picker-search-input').value;
  renderAffixPickerContent(_pickerSlot, filter);
}

function addCustomAffix() {
  const nameEl = document.getElementById('picker-cust-name');
  const valEl = document.getElementById('picker-cust-val');
  const catEl = document.getElementById('picker-cust-cat');
  const name = (nameEl.value || '').trim();
  if (!name) return;
  const val = parseFloat(valEl.value) || 0;
  const cat = catEl.value;
  _pickerSelected[name] = true;
  // 存储自定义数据
  if (!window._pickerCustom) window._pickerCustom = {};
  window._pickerCustom[name] = { val, cat };
  nameEl.value = ''; valEl.value = '';
  const filter = document.getElementById('picker-search-input').value;
  renderAffixPickerContent(_pickerSlot, filter);
}

function updatePickerValue(name, val) { _pickerValues[name] = val; }

function filterAffixPicker() {
  const v = document.getElementById('picker-search-input').value;
  renderAffixPickerContent(_pickerSlot, v);
}

function updatePickerSummary() {
  const names = Object.keys(_pickerSelected);
  const el = document.getElementById('picker-selected-summary');
  const btn = document.getElementById('picker-btn-confirm');
  if (names.length === 0) {
    el.innerHTML = '<span class="no-select">未选择词缀</span>';
    btn.innerText = '确认添加';
  } else {
    el.innerHTML = names.map(n => '<span>· ' + n + '</span>').join(' ');
    btn.innerText = '确认添加 ' + names.length + ' 个';
  }
}

function confirmAffixSelection() {
  if (!_pickerSlot) return;
  const sid = _pickerSlot;
  if (!state.slots[sid]) state.slots[sid] = emptySlot();
  const cfg = state.slots[sid];
  const names = Object.keys(_pickerSelected);
  cfg.affixes = names.map(name => {
    const lib = findAffixByName(name);
    const val = parseFloat(_pickerValues[name]) || 0;
    if (lib) return { name, val };
    const custom = (window._pickerCustom && window._pickerCustom[name]) || {};
    return { name, cat: custom.cat || 'A_ADD', val: val || custom.val || 0 };
  });
  window._pickerCustom = {};
  closeAffixPicker();
  saveState();
  renderAll();
}
