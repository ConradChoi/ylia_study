# 매일 영어공부 + 성경구절 자동 발행 — 설계 문서

날짜: 2026-08-01

## 목적

매일 아침 정해진 시간에 자동으로
1. 영단어/숙어 학습 콘텐츠(단어, 발음, 뜻, 예문, 퀴즈)
2. 성경 66권을 순환하는 짧은 구절(한국어/영어/원어 + 원어 어휘 분석)

을 생성해 웹페이지로 발행하고, 카카오톡으로 링크를 알려준다. 사용자가 매일 앱/사이트를 열어보는 습관을 만드는 개인용 학습 도구다.

## 배포 아키텍처

- **GitHub 저장소**: `https://github.com/ConradChoi/ylia_study` (기존 빈 public 저장소, 최초 1회 로컬 콘텐츠 push 필요)
- **호스팅**: AWS Amplify — 사용자가 저장소를 GitHub에 올린 뒤 **직접** Amplify 앱을 새로 만들고 이 저장소에 연결한다 (Amplify 앱 생성/도메인 연결은 이 작업 범위 밖).
- **커스텀 도메인**: `https://ylia.life` (사용자가 이미 보유, Amplify에 직접 연결 예정)
- **일일 자동화**: Claude Code 클라우드 루틴(cron)이 매일 정적 사이트 파일을 생성해 저장소에 commit + push → Amplify가 push를 감지해 자동 빌드/배포

이 구조상 매일 실행되는 클라우드 루틴은 저장소에 **쓰기(push) 권한**이 필요하다. 루틴 생성 직후 수동으로 1회 실행(`RemoteTrigger run`)해 push가 실제로 성공하는지 확인하고, 실패 시 인증 방식을 별도로 해결한다.

## 콘텐츠 뱅크 (저장소에 파일로 저장, 읽기 전용 데이터)

`study/data/` 아래 3개 JSON 파일. 클라우드 루틴은 매일 이 파일을 읽어 오늘 날짜 기준으로 결정론적으로 순환 선택한다 (별도 히스토리/진행 상태 파일 불필요 — 같은 날짜엔 항상 같은 결과가 나오는 순수 함수 방식).

| 파일 | 내용 | 규모 | 일일 사용량 | 순환 주기 |
|---|---|---|---|---|
| `words.json` | 영단어 (단어, 발음, 뜻) | 600개 | 10개 | 60일 |
| `idioms.json` | 영어 숙어 (숙어, 뜻) | 100개 | 1개 | 100일 |
| `verses.json` | 성경 구절 (66권 각 1구절, 1~2절) | 66개 | 1개 | 66일 |

### `verses.json` 항목 구조

```json
{
  "book_ko": "창세기",
  "book_en": "Genesis",
  "testament": "OT",
  "reference": "창세기 1:1",
  "krv": "태초에 하나님이 천지를 창조하시니라",
  "niv": "In the beginning God created the heavens and the earth.",
  "kjv": "In the beginning God created the heaven and the earth.",
  "original_language": "Hebrew",
  "original_text": "בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ׃",
  "vocab": [
    {"word": "בְּרֵאשִׁית", "translit": "bereshit", "gloss": "태초에"},
    {"word": "בָּרָא", "translit": "bara", "gloss": "창조하셨다"}
  ]
}
```

- 구약(39권) → `original_language: "Hebrew"`, 신약(27권) → `"Greek"`
- `vocab`은 구절에 나오는 단어를 순서대로 전부 나열 (원어 단어 / 발음(음역) / 뜻)
- 영어는 `niv`/`kjv` 둘 다 저장해두고, 표시 시점에 날짜의 홀/짝으로 하나를 고른다 (홀수일=NIV, 짝수일=KJV)
- **정확성 참고**: 원어 본문·어휘 분석은 잘 알려진 짧은 구절 위주로 선정해 오차 가능성을 최소화하지만, 완벽한 원전 대조는 아니므로 중요한 학습 시점엔 별도 원어 성경 자료와 대조를 권장한다.

## 일일 선택 로직 (결정론적)

```
epoch = 2026-08-01
day_index = (오늘 날짜 - epoch).days

word_start   = (day_index * 10) mod 600
words_today  = words[word_start : word_start+10]   # 600 넘어가면 wrap-around

idiom_today  = idioms[day_index mod 100]
verse_today  = verses[day_index mod 66]

en_translation = "NIV" if (오늘 day-of-month) is odd else "KJV"
```

## 매일 생성되는 페이지 구성

1. **오늘의 영단어 10개** — 단어, 발음, 뜻, (그 자리에서 새로 생성하는) 예문 문장
2. **오늘의 숙어 1개** — 숙어, 뜻, 예문 문장
3. **오늘의 퀴즈** — 위 단어 10개 + 숙어 1개를 기준으로 (그 자리에서 새로 생성하는) 문제
4. **오늘의 성경구절** — 참조, 개역개정, 영어(NIV/KJV 중 하나, 어떤 번역인지 표시), 원어 본문, 원어 어휘 분석 표

예문/퀴즈 문장 자체는 저장하지 않고 매일 새로 생성한다 (같은 단어라도 60일/100일 뒤 다시 나올 때 다른 문장으로 학습 가능).

## 사이트 구조

```
site/                       (Amplify가 배포할 루트)
├── index.html              항상 "오늘" 콘텐츠로 덮어씀
├── archive/
│   ├── index.html          과거 날짜 목록 (링크 모음)
│   └── 2026-08-01.html      날짜별 스냅샷 (매일 추가, 계속 누적)
```

- `amplify.yml` — Amplify 빌드 설정 (정적 파일이므로 별도 빌드 없이 `site/`를 publish 디렉터리로 지정)

## 클라우드 루틴 (RemoteTrigger)

- **스케줄**: 매일 06:40 KST (`cron_expression`은 UTC 기준으로 변환)
- **환경**: `YLIA` (env_01GYrPM4CiV2AYpVTKiQffk5)
- **저장소**: `https://github.com/ConradChoi/ylia_study`
- **MCP 연결**: PlayMCP (카카오톡)
- **매일 하는 일**:
  1. 저장소 clone
  2. 오늘 날짜로 위 로직에 따라 단어/숙어/구절 결정
  3. 예문 문장·퀴즈 생성, `site/index.html`과 `site/archive/YYYY-MM-DD.html` 작성, `site/archive/index.html`에 오늘 링크 추가
  4. git add/commit/push
  5. 카카오톡 나에게 메모 전송 (200자 이내): 짧은 인사 + `https://ylia.life` 링크

## 에러 처리 / 검증

- 복잡한 재시도 로직 없이 "실패하면 그날은 발행 안 됨" 수준으로 단순하게 둔다 (개인용 습관 도구이므로 과설계하지 않음).
- 루틴 생성 직후 1회 수동 실행(run now)으로 전체 파이프라인(콘텐츠 생성 → push → Amplify 감지 → 카카오톡 전송)이 실제로 동작하는지 확인한다.
- push 실패 시 클라우드 환경의 git 인증 방식을 별도로 점검한다.

## 이 작업 범위에 포함되지 않는 것

- AWS Amplify 앱 생성 및 `ylia.life` 도메인 연결 (사용자가 직접 진행)
- 원어(히브리어/그리스어) 성경 본문의 학술적 정확성 대조
