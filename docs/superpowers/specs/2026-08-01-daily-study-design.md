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

## Supabase (콘텐츠 뱅크 + 학습 기록)

- **Project URL**: `https://jlsylkdjsjiiuitmwdpz.supabase.co`
- **Publishable key** (공개 가능, 브라우저/클라우드 루틴에서 그대로 사용): `sb_publishable_Or19pdIs6WAUH-tWaxbj-Q_Ku0qkiC2`
- **Secret key는 절대 저장소/프롬프트에 넣지 않는다** — 초기 콘텐츠 seed 작업(단어 600/숙어 100/구절 66 최초 입력)에만 사용자 로컬 환경에서 1회성으로 사용
- 스키마/RLS 정의: [supabase/migrations/0001_init.sql](../../../supabase/migrations/0001_init.sql) — Supabase SQL Editor에서 실행

콘텐츠 뱅크(`words`, `idioms`, `verses`)는 이제 git JSON 파일이 아니라 **Supabase 테이블이 진실 공급원**이다. 사이트와 클라우드 루틴 모두 publishable key로 REST API(`/rest/v1/...`)를 통해 읽는다. 콘텐츠 뱅크는 RLS로 읽기만 공개, 쓰기는 service_role(로컬 seed 스크립트)로만 가능하다.

### 테이블 구조

| 테이블 | 용도 | 접근 권한(publishable key) |
|---|---|---|
| `words` | 영단어 600개 (단어, 발음, 뜻) | 읽기 전용 |
| `idioms` | 영어 숙어 100개 (숙어, 뜻) | 읽기 전용 |
| `verses` | 성경 구절 66개 (아래 구조) | 읽기 전용 |
| `daily_log` | 날짜별 발행 기록 (오늘 어떤 word_ids/idiom_id/verse_id가 나갔는지) | 읽기 + 쓰기(insert/update) |
| `visits` | 사이트 방문 로그 (연속 출석 계산용) | 읽기 + 쓰기(insert) |
| `quiz_results` | 퀴즈 문항별 정답/오답 기록 | 읽기 + 쓰기(insert) |

일일 사용량과 순환 주기는 기존과 동일: 단어 10개/60일 주기, 숙어 1개/100일 주기, 구절 1개/66일 주기 — 다만 배열 slice 대신 `order by id` 로 가져온 행 목록에 동일한 인덱스 공식을 적용한다.

### `verses` 테이블 항목 구조 (jsonb `vocab` 컬럼 포함)

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

words   = select * from words order by id        -- 600행
idioms  = select * from idioms order by id        -- 100행
verses  = select * from verses order by id        -- 66행

word_start   = (day_index * 10) mod 600
words_today  = words[word_start : word_start+10]   # 600 넘어가면 wrap-around

idiom_today  = idioms[day_index mod 100]
verse_today  = verses[day_index mod 66]

en_translation = "NIV" if (오늘 day-of-month) is odd else "KJV"
```

콘텐츠 자체는 결정론적이라 별도 진행 상태가 필요 없지만, **무엇이 나갔는지 기록**은 `daily_log` upsert로 남긴다 (word_ids, idiom_id, verse_id, en_translation, log_date). 리포트/디버깅용이며 선택 로직 자체는 이 기록에 의존하지 않는다.

## 매일 생성되는 페이지 구성

1. **오늘의 영단어 10개** — 단어, 발음, 뜻, (그 자리에서 새로 생성하는) 예문 문장
2. **오늘의 숙어 1개** — 숙어, 뜻, 예문 문장
3. **오늘의 퀴즈** — 위 단어 10개 + 숙어 1개를 기준으로 (그 자리에서 새로 생성하는) 문제. 클라이언트에서 답을 제출하면 `quiz_results`에 insert
4. **오늘의 성경구절** — 참조, 개역개정, 영어(NIV/KJV 중 하나, 어떤 번역인지 표시), 원어 본문, 원어 어휘 분석 표
5. **연속 출석(streak) 배지** — 페이지 로드 시 클라이언트 JS가 `visits`에 오늘 날짜로 insert하고, `visits`를 조회해 연속 일수를 계산해 "🔥 N일째" 형태로 표시

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
  2. Supabase REST API(publishable key)로 `words`/`idioms`/`verses` 조회 → 위 로직에 따라 오늘의 단어/숙어/구절 결정
  3. 예문 문장·퀴즈 생성, `site/index.html`과 `site/archive/YYYY-MM-DD.html` 작성, `site/archive/index.html`에 오늘 링크 추가 (`visits`/`quiz_results` 기록·조회용 클라이언트 JS는 publishable key를 사용해 페이지에 내장)
  4. Supabase `daily_log`에 오늘 행 upsert (word_ids, idiom_id, verse_id, en_translation)
  5. git add/commit/push
  6. 카카오톡 나에게 메모 전송 (200자 이내): 짧은 인사 + `https://ylia.life` 링크

## 에러 처리 / 검증

- 복잡한 재시도 로직 없이 "실패하면 그날은 발행 안 됨" 수준으로 단순하게 둔다 (개인용 습관 도구이므로 과설계하지 않음).
- 루틴 생성 직후 1회 수동 실행(run now)으로 전체 파이프라인(콘텐츠 생성 → push → Amplify 감지 → 카카오톡 전송)이 실제로 동작하는지 확인한다.
- push 실패 시 클라우드 환경의 git 인증 방식을 별도로 점검한다.

## 보안 참고

- Publishable key는 공개를 전제로 설계된 키이므로 사이트/저장소에 그대로 노출해도 된다. 다만 RLS 정책상 `visits`/`quiz_results`/`daily_log`에 아무나 insert할 수 있으므로, 개인용 소규모 도구 수준의 위험(장난성 더미 행 추가)은 감수한다 — 인증 시스템은 만들지 않는다(YAGNI).
- Secret(service_role) key는 절대 저장소, 프롬프트, 클라우드 루틴에 넣지 않는다. 최초 콘텐츠 seed(로컬 1회 실행)에만 사용자 로컬 환경에서 사용한다.

## 이 작업 범위에 포함되지 않는 것

- AWS Amplify 앱 생성 및 `ylia.life` 도메인 연결 (사용자가 직접 진행)
- 원어(히브리어/그리스어) 성경 본문의 학술적 정확성 대조
- 사용자 인증/로그인 (단일 사용자 개인 도구이므로 불필요)
