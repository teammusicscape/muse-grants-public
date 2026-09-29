# MUSE Grants 설치 안내 (내 것으로 만들기)

지원사업·용역·교육·대관 공고를 모아서, 내 조건에 맞는 것만 골라 보고, AI와 지원서 초안까지 준비하는 앱이에요.
이 안내를 따라 하면 **나만 쓰는 앱**이 생겨요. 개발 지식이 없어도 됩니다.

- ⏱ 걸리는 시간: 처음 한 번, 약 40분
- 💰 비용: 0원 (무료 계정 3개, 카드 등록 없음)
- 🔒 내 정보(지원 주체, ★, 지원 관리, 초안, 파일)는 **내 계정에만** 저장돼요. 앱을 만든 사람을 포함해 누구도 볼 수 없어요.

---

## 왜 계정이 3개 필요한가요?

| 서비스 | 쉽게 말하면 | 하는 일 |
|---|---|---|
| **GitHub** | 24시간 일하는 **자동 일꾼** | 하루 2번(오전 6시, 오후 6시) 공고 사이트를 돌며 새 공고를 모아요 |
| **Supabase** | 인터넷 위의 **내 전용 수첩** | 모은 공고와 내 정보·★·초안을 보관해요. PC와 휴대폰이 같은 수첩을 봐요 |
| **Vercel** | **내 전용 앱 주소** | PC·휴대폰 브라우저로 여는 화면을 띄워줘요 |

> 💡 세 곳 모두 **GitHub 계정으로 가입**하면 비밀번호를 하나만 기억하면 돼요.

설치하면서 나오는 값들을 적어 둘 **메모장**을 하나 열어 두세요.

---

## 1단계. GitHub — 앱 복사해 오기 (5분)

1. [github.com](https://github.com) 에 가입해요. (이미 있으면 로그인)
2. 안내받은 **MUSE Grants 공개 저장소** 주소를 열어요.
3. 오른쪽 위 **Fork** 버튼 → 아래 **Create fork** 를 눌러요.
   → 내 계정에 `내아이디/muse-grants-public` 같은 저장소가 생겨요. 이게 **내 앱**이에요.
4. 내 저장소 위쪽 **Actions** 탭 → 초록 버튼 **I understand my workflows, go ahead and enable them** 을 눌러요.
   (복사해 온 저장소는 자동 일꾼이 꺼져 있어서, 이걸 눌러야 켜져요)

> 복사해 온 저장소에는 코드만 있고 개인 정보는 없어요. 내 정보는 다음 단계의 Supabase에만 저장돼요.

---

## 2단계. Supabase — 내 수첩 만들기 (15분)

### 2-1. 프로젝트 만들기
1. [supabase.com](https://supabase.com) → **Start your project** → **Continue with GitHub**
2. **New project** 를 누르고:
   - Name: `muse-grants` (아무거나)
   - Database Password: **Generate a password** → 메모장에 적어 두기 (이 안내에서는 다시 안 써요)
   - Region: **Northeast Asia (Seoul)**
3. **Create new project** → 1~2분 기다려요.

### 2-2. 수첩 안에 칸 만들기 (SQL 한 번 실행)
1. 왼쪽 메뉴 **SQL Editor** → **New query**
2. 내 GitHub 저장소에서 `cloud/supabase/setup.sql` 파일을 열고, 오른쪽 위 **복사 버튼(Copy raw file)** 을 눌러요.
3. SQL Editor에 붙여넣고 오른쪽 아래 **Run** → 아래에 **Success. No rows returned** 가 나오면 성공이에요.
   - "destructive operation" 경고가 뜨면 그대로 진행(**Run this query**)하면 돼요.

### 2-3. 앱이 수첩을 읽을 수 있게 열어 주기
1. 왼쪽 아래 **Project Settings**(톱니바퀴) → **Data API**
2. **Exposed schemas** 칸에 `grants` 를 추가 → **Save**
   (이걸 안 하면 앱에서 공고가 안 보여요)

### 2-4. 나를 사용자로 등록하기
1. 왼쪽 **Authentication** → **Users** → 오른쪽 위 **Add user** → **Create new user**
2. 로그인에 쓸 **내 이메일**을 넣고, 비밀번호는 아무거나, **Auto Confirm User** 체크 → **Create user**

> 이 앱은 **새 가입을 막아 두어서**, 여기 등록한 이메일만 로그인할 수 있어요. 내 앱 주소를 누가 알아도 들어올 수 없어요.
> 더 확실하게 하려면: Authentication → **Sign In / Providers** → **Allow new users to sign up** 을 끄고 저장하세요.

### 2-5. 로그인 메일에 6자리 코드 넣기
1. **Authentication** → **Emails**(또는 Email Templates) → **Magic Link**
2. 본문(Body) 맨 위에 아래 한 줄을 추가하고 **Save**

```html
<h2>로그인 코드: {{ .Token }}</h2>
```

(휴대폰에서 메일 링크를 누르기 번거로울 때, 이 6자리 코드를 앱에 입력하면 돼요)

### 2-6. 연결 값 3개 메모하기
**Project Settings** → **API Keys** (또는 Data API) 에서 아래 3개를 메모장에 복사해 두세요.

| 메모 이름 | 어디 있나요 | 모양 |
|---|---|---|
| ① 수첩 주소 (Project URL) | Data API 또는 프로젝트 첫 화면 | `https://abcdefg.supabase.co` |
| ② 공개 키 (Publishable / anon) | API Keys | `sb_publishable_...` 또는 `eyJ...` |
| ③ 비밀 키 (Secret / service_role) | API Keys → **Reveal** | `sb_secret_...` 또는 `eyJ...` |

> ⚠️ **③ 비밀 키는 비밀번호와 같아요.** 다음 단계의 GitHub 비밀값에만 넣고, 다른 곳(카톡, Vercel 등)에는 절대 붙여넣지 마세요.

---

## 3단계. GitHub — 자동 일꾼에게 수첩 열쇠 주기 (5분)

1. 내 GitHub 저장소 → **Settings** → 왼쪽 **Secrets and variables** → **Actions**
2. **New repository secret** 을 두 번 눌러 아래처럼 등록해요.

| Name (그대로 입력) | Secret (값) |
|---|---|
| `SUPABASE_URL` | ① 수첩 주소 |
| `SUPABASE_SERVICE_ROLE_KEY` | ③ 비밀 키 |

3. 위쪽 **Actions** 탭 → 왼쪽 **공고 수집** → 오른쪽 **Run workflow** → **Run workflow**
4. 3~5분 뒤 초록 체크 ✅ 가 뜨면 첫 공고 수집 완료예요. (빨간 ❌ 면 아래 "문제 해결" 참고)

이후로는 매일 오전 6시·오후 6시에 알아서 모아요.

---

## 4단계. Vercel — 내 앱 주소 만들기 (5분)

1. [vercel.com](https://vercel.com) → **Sign Up** → **Continue with GitHub**
2. **Add New…** → **Project** → 목록에서 내 저장소(`muse-grants-public`) 옆 **Import**
   - 저장소가 안 보이면 **Adjust GitHub App Permissions** 에서 이 저장소를 허용해 주세요.
3. 설정 화면에서:
   - **Root Directory** → **Edit** → `apps/web` 선택 → Continue
   - **Environment Variables** 를 펼쳐 두 개 추가

| Key (그대로 입력) | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ① 수첩 주소 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ② 공개 키 |

4. **Deploy** → 2~3분 뒤 축하 화면이 나오면 완료! 화면의 주소(예: `https://muse-grants-public-abc.vercel.app`)를 메모해요.
   → 이게 **내 앱 주소**예요.

---

## 5단계. Supabase — 로그인 링크가 내 앱으로 오게 하기 (2분)

1. Supabase → **Authentication** → **URL Configuration**
2. **Site URL**: 내 앱 주소 (예: `https://muse-grants-public-abc.vercel.app`) → Save
3. **Redirect URLs** → **Add URL**: `https://내앱주소/**` (끝에 `/**` 붙이기) → Save

---

## 6단계. 로그인하고 내 정보 넣기 (5분)

1. 내 앱 주소를 열어요.
2. 2-4에서 등록한 이메일을 넣고 **로그인 메일 받기** → 메일의 **6자리 코드** 입력 (메일이 안 오면 스팸함 확인)
3. **설정 → 지원 주체**: 개인/단체 정보(주거지·활동지역·활동 시작 연도·보유 서류)를 넣어요. 이걸 기준으로 공고마다 지원 가능 여부가 나와요.
4. **설정 → 키워드·지역·공고 종류**: 내 분야 키워드를 골라요.
5. **휴대폰에서도 쓰기**: 휴대폰으로 같은 주소를 열고 로그인 →
   - iPhone(Safari): 공유 버튼 □↑ → **홈 화면에 추가**
   - Android(Chrome): ⋮ → **홈 화면에 추가** 또는 **앱 설치**

🎉 끝이에요!

---

## 업데이트 받기 (가끔)

앱이 좋아지면 원본 저장소가 바뀌어요. 내 앱에 반영하려면:

1. 내 GitHub 저장소 첫 화면 → **Sync fork** → **Update branch**
2. Vercel이 알아서 새 버전으로 다시 올려요 (2~3분).
3. 업데이트 안내에 **"새 SQL을 실행하세요"** 라는 말이 있으면, 알려준 파일(`cloud/supabase/migrations/00xx_...sql`)을 2-2처럼 SQL Editor에서 한 번 실행해요.

---

## 선택 기능

- **공공데이터 공고 더 받기 (K-Startup · 나라장터 용역 입찰)**: [공공데이터포털](https://www.data.go.kr)에서 "조달청_나라장터 입찰공고정보서비스"(와 K-Startup 사업공고)를 활용 신청하고, 마이페이지의 일반 인증키를 GitHub 비밀값 `DATA_GO_KR_KEY` 로 등록
- **로그인 없는 체험 모드 (다른 사람에게 둘러보게 할 때)**: Supabase에서 `cloud/supabase/migrations/0005_guest_read.sql` 실행 → Vercel 환경변수 `NEXT_PUBLIC_GUEST_MODE` = `1` 추가 후 Redeploy. 체험 링크는 `내앱주소/?try`
- **로그인 메일 제한 풀기**: Supabase 기본 메일은 시간당 몇 통만 보내요. 자주 막히면 Authentication → Emails → **SMTP Settings** 에 내 Gmail + [앱 비밀번호](https://myaccount.google.com/apppasswords)를 연결하세요. (Host `smtp.gmail.com`, Port `465`)

---

## 문제 해결

| 증상 | 확인할 것 |
|---|---|
| 앱에 공고가 하나도 없어요 | ① 3단계 **Run workflow** 가 초록 체크인지 ② 2-3 **Exposed schemas** 에 `grants` 가 있는지 |
| "등록된 사용자만 이용할 수 있어요" | 2-4에서 그 이메일을 등록했는지 (철자 확인) |
| 로그인 메일이 안 와요 | 스팸함 확인 → 몇 분 뒤 다시 → 계속 안 오면 위 "로그인 메일 제한 풀기" |
| 메일 링크를 누르니 이상한 주소로 가요 | 5단계 Site URL·Redirect URLs 확인 |
| 저장할 때 빨간 알림이 떠요 | 알림 문구를 확인하고, 2-2 SQL을 한 번 더 실행해 보세요 (여러 번 실행해도 안전) |
| 수집이 빨간 ❌ 예요 | 3단계 비밀값 이름(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)과 값 확인 → Run workflow 다시 |
| 오래 안 썼더니 안 열려요 | Supabase 무료 프로젝트는 활동이 없으면 잠들어요. Supabase 대시보드에서 **Restore** 를 누르세요 |

## 자주 묻는 질문

**Q. 정말 무료인가요?**  개인 사용량이면 세 서비스 모두 무료 범위 안이에요. (단, Vercel 무료 플랜은 비상업적 용도 전용이에요)

**Q. 내 정보를 누가 볼 수 있나요?**  내 Supabase 계정에만 저장되고, 내 이메일로 로그인해야만 보여요. 앱을 만든 사람도 볼 수 없어요.

**Q. 그만 쓰려면요?**  Supabase 프로젝트 → Settings → **Delete project**, Vercel 프로젝트 → Settings → **Delete**, GitHub 저장소 → Settings → **Delete this repository** 를 하면 모두 지워져요.
