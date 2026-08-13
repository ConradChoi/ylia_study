(function () {
  const SUPABASE_URL = 'https://jlsylkdjsjiiuitmwdpz.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_Or19pdIs6WAUH-tWaxbj-Q_Ku0qkiC2';

  function todayStr() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
  }

  async function recordVisitAndShowStreak() {
    const date = todayStr();
    await fetch(`${SUPABASE_URL}/rest/v1/visits`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify([{ visited_date: date }]),
    });

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/visits?select=visited_date&order=visited_date.desc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const rows = await res.json();
    const uniqueDates = [...new Set(rows.map(r => r.visited_date))];

    let streak = 0;
    const cursor = new Date(`${date}T00:00:00Z`);
    for (const d of uniqueDates) {
      const cursorStr = cursor.toISOString().slice(0, 10);
      if (d === cursorStr) {
        streak += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      } else if (d < cursorStr) {
        break;
      }
    }

    const badge = document.getElementById('streak-badge');
    if (badge) badge.textContent = `🔥 연속 ${streak}일째`;
  }

  function wireQuiz() {
    const scriptTag = document.querySelector('script[data-quiz-date]');
    const quizDate = scriptTag ? scriptTag.dataset.quizDate : todayStr();

    document.querySelectorAll('.quiz .quiz-check').forEach(button => {
      button.addEventListener('click', async () => {
        const li = button.closest('li');
        const input = li.querySelector('.quiz-input');
        const feedback = li.querySelector('.quiz-feedback');
        const question = li.querySelector('p').textContent;
        const expected = li.dataset.answer.trim();
        const given = input.value.trim();
        const isCorrect = given === expected;

        feedback.textContent = isCorrect ? '✅ 정답' : `❌ 오답 (정답: ${expected})`;

        await fetch(`${SUPABASE_URL}/rest/v1/quiz_results`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify([{
            quiz_date: quizDate,
            item_type: li.dataset.itemType,
            item_id: Number(li.dataset.itemId),
            question,
            is_correct: isCorrect,
          }]),
        });
      });
    });
  }

  function wireSqldQuiz() {
    const scriptTag = document.querySelector('script[data-quiz-date]');
    const quizDate = scriptTag ? scriptTag.dataset.quizDate : todayStr();

    document.querySelectorAll('.sqld-list > li').forEach(li => {
      const answerIndex = Number(li.dataset.answerIndex);
      const sqldId = Number(li.dataset.sqldId);

      li.querySelectorAll('.sqld-choice').forEach(button => {
        button.addEventListener('click', async () => {
          const feedback = li.querySelector('.sqld-feedback');
          const explanation = li.querySelector('.sqld-explanation');
          const question = li.querySelector('.sqld-question').textContent;
          const chosenIndex = Number(button.dataset.choiceIndex);
          const isCorrect = chosenIndex === answerIndex;

          feedback.textContent = isCorrect ? '✅ 정답' : '❌ 오답';
          explanation.hidden = false;

          await fetch(`${SUPABASE_URL}/rest/v1/quiz_results`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify([{
              quiz_date: quizDate,
              item_type: 'sqld',
              item_id: sqldId,
              question,
              is_correct: isCorrect,
            }]),
          });

          showSqldScore();
        });
      });
    });
  }

  async function showSqldScore() {
    const scriptTag = document.querySelector('script[data-quiz-date]');
    const quizDate = scriptTag ? scriptTag.dataset.quizDate : todayStr();

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/quiz_results?select=is_correct&item_type=eq.sqld&quiz_date=eq.${quizDate}`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const rows = await res.json();
    const correct = rows.filter(r => r.is_correct).length;

    const scoreEl = document.getElementById('sqld-score');
    if (scoreEl) scoreEl.textContent = `오늘 정답률: ${correct} / ${rows.length} (총 40문제 중 응시)`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    recordVisitAndShowStreak();
    wireQuiz();
    wireSqldQuiz();
    showSqldScore();
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { todayStr, recordVisitAndShowStreak, wireQuiz, wireSqldQuiz, showSqldScore };
  }
})();
