(function () {
  const SUPABASE_URL = 'https://jlsylkdjsjiiuitmwdpz.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_Or19pdIs6WAUH-tWaxbj-Q_Ku0qkiC2';

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
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
            item_type: 'word',
            item_id: Number(li.dataset.questionIndex),
            question,
            is_correct: isCorrect,
          }]),
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    recordVisitAndShowStreak();
    wireQuiz();
  });
})();
