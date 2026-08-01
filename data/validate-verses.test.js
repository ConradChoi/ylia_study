const test = require('node:test');
const assert = require('node:assert/strict');
const verses = require('./verses.json');

const OT_BOOKS = ['창세기','출애굽기','레위기','민수기','신명기','여호수아','사사기','룻기','사무엘상','사무엘하','열왕기상','열왕기하','역대상','역대하','에스라','느헤미야','에스더','욥기','시편','잠언','전도서','아가','이사야','예레미야','예레미야애가','에스겔','다니엘','호세아','요엘','아모스','오바댜','요나','미가','나훔','하박국','스바냐','학개','스가랴','말라기'];
const NT_BOOKS = ['마태복음','마가복음','누가복음','요한복음','사도행전','로마서','고린도전서','고린도후서','갈라디아서','에베소서','빌립보서','골로새서','데살로니가전서','데살로니가후서','디모데전서','디모데후서','디도서','빌레몬서','히브리서','야고보서','베드로전서','베드로후서','요한일서','요한이서','요한삼서','유다서','요한계시록'];
const ALL_BOOKS = [...OT_BOOKS, ...NT_BOOKS];

test('verses.json has exactly 66 entries, one per canonical book, no duplicates', () => {
  assert.equal(verses.length, 66);
  const booksInFile = verses.map(v => v.book_ko).sort();
  assert.deepEqual(booksInFile, [...ALL_BOOKS].sort());
});

test('every verse has required fields and correct original_language for its testament', () => {
  for (const v of verses) {
    assert.equal(typeof v.reference, 'string');
    assert.ok(v.krv.length > 0);
    assert.ok(v.niv.length > 0);
    assert.ok(v.kjv.length > 0);
    assert.ok(v.original_text.length > 0);
    assert.ok(Array.isArray(v.vocab) && v.vocab.length > 0);
    for (const entry of v.vocab) {
      assert.ok(entry.word && entry.translit && entry.gloss);
    }
    if (OT_BOOKS.includes(v.book_ko)) {
      assert.equal(v.testament, 'OT');
      assert.equal(v.original_language, 'Hebrew');
    } else {
      assert.equal(v.testament, 'NT');
      assert.equal(v.original_language, 'Greek');
    }
  }
});
