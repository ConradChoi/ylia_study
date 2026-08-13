const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const TABS_PATH = path.join(__dirname, 'tabs.js');

function makeClassList(initial) {
  const list = new Set(initial);
  return {
    toggle(cls, on) {
      if (on) list.add(cls);
      else list.delete(cls);
    },
    contains(cls) {
      return list.has(cls);
    },
  };
}

function loadTabs() {
  global.document = { addEventListener: () => {}, querySelectorAll: () => [] };
  delete require.cache[require.resolve(TABS_PATH)];
  return require(TABS_PATH);
}

test('wireTabs switches active class to the clicked tab button and its matching panel only', () => {
  const mod = loadTabs();

  const wordsPanel = { id: 'tab-words', classList: makeClassList(['tab-panel', 'active']) };
  const versePanel = { id: 'tab-verse', classList: makeClassList(['tab-panel']) };
  const sqldPanel = { id: 'tab-sqld', classList: makeClassList(['tab-panel']) };

  function makeButton(tab, active) {
    const btn = {
      dataset: { tab },
      classList: makeClassList(active ? ['tab-btn', 'active'] : ['tab-btn']),
    };
    btn.addEventListener = (evt, handler) => { btn._click = handler; };
    return btn;
  }
  const wordsBtn = makeButton('words', true);
  const verseBtn = makeButton('verse', false);
  const sqldBtn = makeButton('sqld', false);

  global.document.querySelectorAll = (sel) => {
    if (sel === '.tab-btn') return [wordsBtn, verseBtn, sqldBtn];
    if (sel === '.tab-panel') return [wordsPanel, versePanel, sqldPanel];
    return [];
  };

  mod.wireTabs();
  sqldBtn._click();

  assert.equal(sqldBtn.classList.contains('active'), true);
  assert.equal(wordsBtn.classList.contains('active'), false);
  assert.equal(verseBtn.classList.contains('active'), false);
  assert.equal(sqldPanel.classList.contains('active'), true);
  assert.equal(wordsPanel.classList.contains('active'), false);
  assert.equal(versePanel.classList.contains('active'), false);
});
