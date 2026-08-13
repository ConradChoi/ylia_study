(function () {
  function wireTabs() {
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.toggle('active', b === btn);
        });
        document.querySelectorAll('.tab-panel').forEach(panel => {
          panel.classList.toggle('active', panel.id === `tab-${target}`);
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', wireTabs);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { wireTabs };
  }
})();
