# 🎮 Voice Taboo - Web Edition

[![Web](https://img.shields.io/badge/Web-HTML5%20%26%20JS-blue.svg)](https://developer.mozilla.org)
[![Speech API](https://img.shields.io/badge/Speech-Web%20Speech%20API-green.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)

**브라우저 기반 AI 음성 금지어 게임**

플레이어가 금지어를 피해서 목표어를 설명하면, AI가 추측하는 혁신적인 음성 게임의 웹 버전입니다.

## ✨ 주요 기능

### 🎯 게임 시스템
- **실시간 음성 인식**: Web Speech API를 통한 한국어 음성 인식
- **간단한 AI 추측**: 키워드 기반 추측 로직 (OpenAI API 연동 가능)
- **두 가지 게임 모드**:
  - **Time Attack**: 제한 시간 내 최대한 많은 정답
  - **Speed Run**: 목표 개수를 가장 빠르게 달성

### 💻 UI/UX
- **모던 웹 디자인** 인터페이스
- **네온 효과**와 **반응형 디자인**
- **간단한 컨트롤**: 클릭으로 녹음 시작/중지

### 📊 데이터 관리
- **JSON 기반** 단어 데이터베이스
- **브라우저 로컬** 실행 (서버 불필요)

## 🚀 실행 방법

### 브라우저에서 바로 실행
1. `index.html` 파일을 브라우저로 열기
2. **OpenAI API 키 입력** (선택사항 - 입력하지 않으면 간단한 키워드 매칭 사용)
3. 마이크 권한 허용 (한 번만 요청됨)
4. 게임 모드 선택 후 플레이 시작

### OpenAI API 키 설정 (권장)
- `.env.example`을 복사해서 `.env` 파일 생성
- 실제 OpenAI API 키 입력
- 게임 실행 시 자동으로 로드됨

```bash
cp .env.example .env
# .env 파일에 실제 API 키 입력
```

### 수동 입력 방식
- 게임 시작 전 메뉴에서 직접 API 키 입력
- 브라우저에 저장되지 않음 (새로고침 시 재입력 필요)

### 필수 요구사항
- 최신 브라우저 (Chrome, Firefox, Safari 등)
- 마이크가 있는 환경
- 인터넷 연결 (데이터 로드용, API 사용 시)

## 🎮 게임 플레이 방법

### 기본 조작
- **메뉴**: 게임 모드 버튼 클릭
- **게임 중**: 🎤 버튼으로 음성 녹음 시작/중지 (한 번 권한 허용 후 지속 사용)
- **기타**: SKIP, RESET 버튼

### 음성 인식 특징
- **지속 청취 모드**: 버튼을 누르면 계속 듣다가 다시 누르면 중지
- **실시간 피드백**: 말하는 동안 "듣는 중" 표시
- **자동 처리**: 말하기가 끝나면 자동으로 AI 추측 실행

### 게임 규칙
1. 화면에 표시된 **목표어**를 AI가 맞추도록 설명하세요
2. **금지어 5개**는 절대 사용하면 안 됩니다
3. **목표어 자체**도 말하면 실패입니다
4. AI가 정답을 맞히면 성공!

### 게임 모드
- **Time Attack**: 2분 동안 최대한 많은 단어 맞추기 (점수: 맞춘 개수)
- **Speed Run**: 5단어를 가장 빠르게 맞추기 (점수: 걸린 시간)

## 📊 순위 시스템

### 현재 구현 (브라우저별 개인 순위)
- 각 브라우저/기기마다 별도의 순위표 유지
- 상위 10개 기록 자동 저장
- 점수 내보내기 기능으로 다른 기기와 공유 가능

## 🔧 Supabase 통합 순위 시스템 설정

### 1. Supabase 프로젝트 생성
1. [supabase.com](https://supabase.com)에서 계정 생성
2. "New Project" 클릭
3. 프로젝트 이름 입력 (예: `game-leaderboards`)
4. Database Password 설정
5. Region 선택 (가장 가까운 지역 권장)

### 2. 데이터베이스 테이블 생성
Supabase 대시보드에서 **Table Editor** → **New Table** 클릭:

```sql
-- leaderboard 테이블 생성
CREATE TABLE leaderboard (
  id SERIAL PRIMARY KEY,
  game_name TEXT NOT NULL,        -- 게임 구분 (voice_taboo, game2, game3 등)
  game_mode TEXT NOT NULL,        -- TIME_ATTACK, SPEED_RUN
  score INTEGER NOT NULL,         -- 점수
  device_id TEXT NOT NULL,        -- 기기 식별자
  player_name TEXT DEFAULT 'Player', -- 플레이어 이름 (향후 확장)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (성능 향상)
CREATE INDEX idx_leaderboard_game_mode ON leaderboard(game_name, game_mode);
CREATE INDEX idx_leaderboard_score ON leaderboard(game_mode, score DESC);
```

### 3. Row Level Security (RLS) 설정
**Authentication** → **Policies**에서:

```sql
-- 모든 사용자가 읽기 가능
CREATE POLICY "Anyone can read leaderboard" ON leaderboard
  FOR SELECT USING (true);

-- 익명 사용자도 쓰기 가능
CREATE POLICY "Anyone can insert leaderboard" ON leaderboard
  FOR INSERT WITH CHECK (true);
```

### 4. API 키 확인
**Settings** → **API**에서:
- `Project URL`: `https://xxxxx.supabase.co`
- `anon public` 키: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 5. 게임 코드에 키 입력
`index.html`에서 다음 부분 수정:

```javascript
// Supabase configuration
const SUPABASE_URL = 'https://xxxxx.supabase.co';  // 실제 URL 입력
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';  // 실제 키 입력
```

### 6. 여러 게임 지원
각 게임마다 `game_name`을 다르게 설정:

```javascript
// Voice Taboo 게임
game_name: 'voice_taboo'

// 다른 게임들
game_name: 'puzzle_game'
game_name: 'racing_game'
```

### 6. 실시간 순위 갱신 (Realtime) 설정 (선택사항)

**실시간 순위 갱신**을 원한다면 Supabase Realtime을 활성화하세요:

#### Realtime 활성화
1. Supabase 대시보드 → **Database** → **Replication**
2. **Tables** 탭에서 `leaderboard` 테이블 선택
3. **Enable Realtime** 토글 ON ✅

#### Realtime 작동 방식
- **INSERT 이벤트**만 구독 (새 점수 추가 시)
- **RLS 정책** 적용 (익명 사용자도 읽기/쓰기 가능)
- **자동 갱신**: 다른 플레이어가 점수를 기록하면 즉시 모든 클라이언트의 순위표가 업데이트됨

#### Realtime 장점
- **라이브 이벤트**: 행사나 대회에서 실시간 순위 경쟁 가능
- **150명 규모**: 부하 문제 거의 없음
- **자동화**: 수동 새로고침 불필요

#### 폴링 vs Realtime 비교
```javascript
// Realtime 사용 (권장)
supabase.channel('leaderboard-updates')
  .on('postgres_changes', { event: 'INSERT', table: 'leaderboard' }, 
    () => loadGlobalLeaderboard() // 즉시 갱신
  );

// 폴링 사용 (대안)
setInterval(loadGlobalLeaderboard, 5000); // 5초마다 갱신
```

**권장**: 행사나 다중 플레이어 환경에서는 **Realtime ON**, 개인 플레이에서는 **폴링**으로 충분합니다.

---

# 🧭 Project Context — VoiceTaboo Web + Supabase Integration

## 🎯 목적

PyGame 기반의 "Voice Taboo" 프로젝트를 **정적 웹 버전으로 이식**하고,
플레이어 점수를 **Supabase 데이터베이스에 저장 및 공유**하기 위한 백엔드 최소화 구성.

> 로그인 없이도 점수 저장/조회가 가능한 **익명 공개 리더보드** 구축이 목표.

---

## ⚙️ 현재까지 완료된 Supabase 설정

### ✅ 1. Database Table: `leaderboard`

**Table schema (public.leaderboard):**

| Column        | Type                    | Default    | Note                     |
| ------------- | ----------------------- | ---------- | ------------------------ |
| `id`          | `int8` (auto increment) | —          | Primary key              |
| `created_at`  | `timestamptz`           | `now()`    | Auto timestamp           |
| `game_name`   | `text`                  | —          | 게임 이름 (`voice_taboo`) |
| `game_mode`   | `text`                  | —          | 게임 모드 (`TIME_ATTACK`, `SPEED_RUN`) |
| `score`       | `int4`                  | —          | 점수 (TIME_ATTACK: 단어 수, SPEED_RUN: 시간) |
| `device_id`   | `text`                  | —          | 고유 장치 UUID               |
| `player_name` | `text`                  | `'Player'` | 플레이어 표시 이름               |

---

### ✅ 2. Row Level Security (RLS)

* **RLS:** Enabled ✅

---

### ✅ 3. Policies

| Policy Name                            | Command | Applied to | Description             |
| -------------------------------------- | ------- | ---------- | ----------------------- |
| **Enable insert access for all users** | INSERT  | public     | 익명 포함 모든 사용자 점수 업로드 허용  |
| **Enable read access for all users**   | SELECT  | public     | 익명 포함 모든 사용자 리더보드 조회 허용 |

> ⚠️ 기존의 `Enable insert for authenticated users only` 정책은 삭제하여,
> 익명 사용자도 자유롭게 INSERT 가능하게 함.

---

### ✅ 4. Optional: Realtime (선택)

* **Database → Replication → Tables → `leaderboard` → Enable Realtime** ✅
  (새로운 점수 INSERT 시 모든 클라이언트가 실시간 업데이트 받음)

---

## 🔑 5. API Keys

* **Project URL** → `https://xxxxx.supabase.co`
* **anon public key** → `eyJhbGciOiJIUzI1NiIs...`
  → 프론트엔드에서 Supabase JS 클라이언트 생성 시 사용됨.

---

## 💾 6. Frontend Integration (이미 구현됨)

**Library:** `@supabase/supabase-js@2` (CDN 사용)

### Initialization

```js
// index.html에 이미 구현됨
const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';

let supabase = null;
if (SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY_HERE') {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  script.onload = () => {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase initialized');
    initRealtimeSubscription();
    loadGlobalLeaderboard();
  };
  document.head.appendChild(script);
}
```

---

### Insert (점수 업로드) - 이미 구현됨

```js
async function saveGlobalScore(mode, score) {
  if (!supabase) {
    console.log('Supabase not initialized, saving locally only');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .insert([{
        game_name: 'voice_taboo',
        game_mode: mode, // 'TIME_ATTACK' or 'SPEED_RUN'
        score: score,
        device_id: getDeviceId(),
        player_name: 'Player'
      }]);

    if (error) throw error;
    console.log('Global score saved successfully');
    loadGlobalLeaderboard();
  } catch (error) {
    console.error('Failed to save global score:', error);
  }
}
```

---

### Select (리더보드 조회) - 이미 구현됨

```js
async function loadGlobalLeaderboard() {
  if (!supabase) return;

  try {
    // TIME_ATTACK: 높은 점수 우선
    const { data: timeAttackData } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('game_name', 'voice_taboo')
      .eq('game_mode', 'TIME_ATTACK')
      .order('score', { ascending: false })
      .limit(10);

    // SPEED_RUN: 낮은 점수 우선
    const { data: speedRunData } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('game_name', 'voice_taboo')
      .eq('game_mode', 'SPEED_RUN')
      .order('score', { ascending: true })
      .limit(10);

    // UI 업데이트 로직...
  } catch (error) {
    console.error('Failed to load global leaderboard:', error);
  }
}
```

---

### Realtime (선택적) - 이미 구현됨

```js
function initRealtimeSubscription() {
  if (!supabase) return;

  realtimeChannel = supabase.channel('leaderboard-updates');
  realtimeChannel
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'leaderboard'
    }, (payload) => {
      console.log('[Realtime] New score added:', payload.new);
      loadGlobalLeaderboard(); // 즉시 갱신
    })
    .subscribe((status) => {
      console.log('Realtime subscription status:', status);
    });

  // 페이지 떠날 때 정리
  window.addEventListener('beforeunload', () => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
    }
  });
}
```

---

## 🚀 최종 상태

* ✅ Supabase DB 구조 완성
* ✅ 공개 읽기/쓰기 정책 설정 완료
* ✅ 익명 사용자의 점수 저장/조회 가능
* ✅ 실시간 리더보드 활성화됨
* ✅ 프론트엔드(JS) 연결 및 구현 완료
* ✅ 로컬 서버 테스트 환경 구축됨

---

## 🧩 Copilot 추가 지시 예시

```
Convert the existing VoiceTaboo PyGame project into a static web game
that uses HTML5 Canvas and Web Speech API for speech recognition,
and integrate the Supabase leaderboard (as defined above) for storing scores.
Use Tone.js for audio, and make sure the project runs entirely in the browser.
```

---

## 📊 데이터베이스 구조

### Leaderboard 테이블
| 필드 | 타입 | 설명 |
|------|------|------|
| id | SERIAL | 자동 증가 ID |
| game_name | TEXT | 게임 식별자 |
| game_mode | TEXT | 게임 모드 |
| score | INTEGER | 점수 |
| device_id | TEXT | 기기 식별자 |
| player_name | TEXT | 플레이어 이름 |
| created_at | TIMESTAMP | 생성 시간 |

### 쿼리 예시
```sql
-- 특정 게임의 타임어택 상위 10개
SELECT * FROM leaderboard
WHERE game_name = 'voice_taboo' AND game_mode = 'TIME_ATTACK'
ORDER BY score DESC
LIMIT 10;

-- 특정 게임의 스피드런 상위 10개 (낮은 점수 우선)
SELECT * FROM leaderboard
WHERE game_name = 'voice_taboo' AND game_mode = 'SPEED_RUN'
ORDER BY score ASC
LIMIT 10;
```

## � 배포 및 환경변수 설정

### GitHub Pages 배포
1. Repository를 GitHub에 푸시
2. Settings > Pages에서 배포 활성화
3. `.env` 파일은 `.gitignore`에 의해 제외됨

### Vercel 배포
1. GitHub repository 연결
2. Environment Variables 설정:
   - `OPENAI_API_KEY`: 실제 API 키 값
3. 배포 완료

### Netlify 배포
1. GitHub repository 연결
2. Site settings > Environment variables:
   - `OPENAI_API_KEY`: 실제 API 키 값

### 로컬 개발
```bash
# .env 파일 생성 및 API 키 설정
cp .env.example .env
# .env 파일에 실제 API 키 입력

# 로컬 서버 실행
python -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

## 🎯 단어 데이터베이스

현재 103개의 엄선된 단어가 포함되어 있으며, 각 단어마다 브랜드명과 핵심 키워드가 금지어로 설정되어 있습니다.

### 새로운 단어 추가
`data/words.json` 파일을 편집하여 새로운 목표어와 금지어를 추가할 수 있습니다:

```json
{"target": "새로운단어", "forbidden": ["금지어1", "금지어2", "금지어3"]}
```

## 🔧 확장 기능

### OpenAI API 연동 (선택사항)
현재는 간단한 키워드 매칭을 사용하지만, OpenAI API를 연동하여 더 정확한 AI 추측을 구현할 수 있습니다.

`index.html`의 `simpleGuess` 함수를 다음으로 교체:

```javascript
// OpenAI API integration placeholder
async function simpleGuess(history) {
    try {
        const response = await fetch('/api/whisper', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: history })
        });
        const data = await response.json();
        return data.reply;
    } catch (error) {
        console.error('API call failed:', error);
        return "API 호출 실패. [[모름]]";
    }
}
```

## 🐛 문제 해결

### 음성 인식 권한 문제
- 브라우저에서 마이크 권한을 허용했는지 확인
- HTTPS 환경에서 실행 (localhost 포함)
- 권한이 거부되었을 경우 브라우저 설정에서 재설정

### OpenAI API 오류
- API 키가 올바른지 확인 (`sk-`로 시작하는지)
- API 사용량 한도를 초과하지 않았는지 확인
- 네트워크 연결 상태 확인

### 데이터 로드 실패
- `data/words.json` 파일 존재 확인
- CORS 정책 확인 (로컬 파일의 경우 브라우저 제한 있을 수 있음)

### 기타 브라우저 호환성
- Chrome 브라우저 권장 (Web Speech API 지원 최적)
- 최신 브라우저 버전 사용

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## ⚠️ 보안 주의사항

- Web Speech API는 클라이언트 사이드에서 실행되므로 민감한 데이터 처리 시 주의
- OpenAI API 연동 시 API 키 노출 방지

## ✨ 주요 기능

### 🎯 게임 시스템
- **실시간 음성 인식**: OpenAI Whisper를 통한 정확한 한국어 음성 인식
- **AI 추측**: GPT-4o-mini가 설명을 듣고 단어를 추측
- **시간 동결**: 음성 처리 중에는 게임 시간이 정지되어 공정한 플레이
- **두 가지 게임 모드**: 
  - **Time Attack**: 제한 시간 내 최대한 많은 정답
  - **Speed Run**: 목표 개수를 가장 빠르게 달성

### � UI/UX
- **8bit 레트로 아케이드** 스타일 인터페이스
- **네온 효과**와 **픽셀 애니메이션**
- **CRT 모니터** 느낌의 스캔라인 효과
- **아케이드 스타일 메뉴** 시스템

### 📊 데이터 관리
- **플레이어 이름** 시스템
- **모드별 점수 저장** (JSON 파일)
- **실시간 리더보드**
- **103개의 다양한 단어** 데이터베이스

## 🚀 설치 및 실행

### 필수 요구사항
- Python 3.8 이상
- OpenAI API 키
- 마이크가 있는 환경

### 1. 저장소 복제
```bash
git clone https://github.com/yourusername/voice-taboo.git
cd voice-taboo
```

### 2. 패키지 설치
```bash
pip install pygame openai sounddevice numpy python-dotenv
```

### 3. 환경 변수 설정
`.env.example` 파일을 복사해서 `.env` 파일을 만들고 OpenAI API 키를 입력하세요:

```bash
cp .env.example .env
```

`.env` 파일 내용:
```env
OPENAI_API_KEY=your_openai_api_key_here
SAMPLE_RATE=16000
RECORD_SECONDS=3.0
```

### 4. 게임 실행
```bash
python main_arcade.py
```

## 🎮 게임 플레이 방법

### 기본 조작
- **메인 메뉴**: ↑↓ 방향키로 선택, Enter로 확인
- **게임 중**: SPACE 키를 누르고 있는 동안 음성 녹음
- **종료**: ESC 키

### 게임 규칙
1. 화면에 표시된 **목표어**를 AI가 맞추도록 설명하세요
2. **금지어 5개**는 절대 사용하면 안 됩니다
3. **목표어 자체**도 말하면 실패입니다
4. AI가 정답을 맞히면 성공!

### 게임 모드
- **Time Attack**: 60초 동안 최대한 많은 문제 해결
- **Speed Run**: 5개 문제를 가장 빠르게 해결

## 🎮 조작법

- **[방향키]**: 메인 메뉴 내비게이션 (Start Game / Swap Mode / Help)
- **[Enter]**: 메뉴 선택 실행
- **[SPACE]**: 음성 녹음 (누르는 동안 녹음, 떼면 중단)
- **[ESC]**: 게임 종료 / 메인 메뉴로 돌아가기

## 🎯 게임 모드

### TIME ATTACK
- 60초 제한시간 내에 최대한 많은 단어 맞히기
- 성공 시: +10점
- 실패 시: -5점

### SPEED RUN
- 5개 문제를 최대한 빠르게 해결
- 총 소요 시간으로 점수 측정

## 🚀 설치 및 실행

### 1. 저장소 클론
```bash
git clone https://github.com/your-username/voice-taboo-game.git
cd voice-taboo-game
```

### 2. 의존성 설치
```bash
pip install pygame sounddevice numpy openai python-dotenv
```

### 3. OpenAI API 키 설정
```bash
# .env 파일 생성
copy .env.example .env

# .env 파일을 열어서 실제 API 키 입력
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 4. 게임 실행
```bash
python main_arcade.py
```

## 📁 프로젝트 구조

```
voice-taboo-game/
├── main_arcade.py           # 메인 실행 파일
├── main_menu.py            # 메인 메뉴 시스템
├── game.py                 # 게임 핵심 로직
├── config.py               # 게임 설정 및 상수
├── models.py               # 데이터 모델
├── utils.py                # 유틸리티 함수
├── openai_helper.py        # OpenAI API 인터페이스
├── taboo_bank.json         # 단어 데이터베이스 (103개 단어)
├── scores_time_attack.json # 타임어택 점수 기록
├── scores_speed_run.json   # 스피드런 점수 기록
├── .env                    # 환경 변수 (생성 필요)
├── .gitignore             # Git 무시 파일
└── README.md              # 프로젝트 문서
```

## ⚙️ 환경 변수 설정

`.env` 파일에서 다음 설정을 커스터마이징할 수 있습니다:

```bash
# 필수 설정
OPENAI_API_KEY=sk-your-api-key-here

# 게임 설정
TABOO_JSON=taboo_bank.json          # 단어 데이터 파일
ROUNDS=5                            # 세션당 라운드 수

# 음성 설정
SAMPLE_RATE=16000                   # 샘플링 레이트
CHUNK_SIZE=1024                     # 오디오 청크 크기

# 게임 모드 설정
TIME_ATTACK_SECONDS=60              # 타임어택 제한시간
SPEED_RUN_TARGET_COUNT=5            # 스피드런 목표 개수

# UI 설정
FONT_NAME=malgun gothic             # 사용할 폰트명
```

## 🎯 단어 데이터베이스

현재 103개의 엄선된 단어가 포함되어 있으며, 각 단어마다 브랜드명과 핵심 키워드가 금지어로 설정되어 있습니다:

- **치킨**: 닭, 튀긴, KFC, 교촌, 굽네치킨, 후라이드 등
- **햄버거**: 맥도날드, 롯데리아, 버거킹, 맘스터치, 패티 등
- **커피**: 아메리카노, 에스프레소, 스타벅스, 이디야, 원두 등

### 새로운 단어 추가
`taboo_bank.json` 파일을 편집하여 새로운 목표어와 금지어를 추가할 수 있습니다:

```json
{"target": "새로운단어", "forbidden": ["금지어1", "금지어2", "금지어3"]}
```

## 🔧 커스터마이징

### 게임 설정 변경
`config.py` 파일에서 다음을 변경할 수 있습니다:
- UI 색상 및 스타일
- 게임 시간 제한
- 점수 계산 방식
- 음성 인식 설정

### 새로운 게임 모드 추가
1. `config.py`에 새로운 모드 추가
2. `models.py`에 모드별 로직 구현
3. `main_menu.py`에 UI 요소 추가

## 🐛 문제 해결

### 한글 깨짐 현상
- Windows: "맑은 고딕" 폰트 자동 사용
- 다른 OS: 시스템에 설치된 한글 폰트로 자동 대체
- 수동 설정: `config.py`의 `FONT_NAME` 수정

### 음성 인식 오류
- 마이크 권한 확인
- 인터넷 연결 상태 확인
- OpenAI API 키 유효성 확인
- 오디오 장치 설정 확인

### API 비용 관리
- 한 게임당 예상 비용: 5,000-7,000원 (KRW)
- Whisper API: ~$0.006/분
- GPT-4o-mini: ~$0.001/질문
- 비용 절약: 짧은 설명 권장

## 📊 API 사용량

### 예상 비용 (한화 기준)
- **타임어택 모드**: 약 5,000-6,000원
- **스피드런 모드**: 약 3,000-4,000원
- **주요 비용**: Whisper API (음성 인식)

### 최적화 팁
- 명확하고 간결한 설명 사용
- 불필요한 배경 소음 제거
- API 키 사용량 모니터링

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## ⚠️ 보안 주의사항

- **절대로** OpenAI API 키를 코드에 직접 입력하지 마세요
- `.env` 파일을 공개 저장소에 커밋하지 마세요
- API 키는 환경 변수로만 관리하세요
- 정기적으로 API 사용량을 모니터링하세요
