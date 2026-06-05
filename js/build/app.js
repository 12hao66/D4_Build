// ══════════════════════════════════════════════════
// APP — 入口
// ══════════════════════════════════════════════════

// Apply theme immediately to prevent flash
initTheme();
document.addEventListener('DOMContentLoaded', async () => {
  await loadAffixPool();
  await loadLadderBuilds();
  loadState();
  renderAll();
});

window.addEventListener('beforeunload', () => { saveState(); });