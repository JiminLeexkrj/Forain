# Forain

Forain(결숲)은 자체 아이디·비밀번호 인증과 서버 세션을 사용하는 개인 일기·성장 시각화 애플리케이션입니다. 남긴 일기(편린)에서 AI가 실제 수행한 활동을 추출하고, 확정된 활동만큼 카테고리별 "결숲"이 자랍니다.

Next.js 16(App Router) 기반이며, [Vercel](https://vercel.com)에 배포되고 [Turso](https://turso.tech)(libSQL)를 데이터베이스로 사용합니다.

## 기술 스택

- **프레임워크**: Next.js 16 + React 19
- **데이터베이스**: Turso(libSQL), `@libsql/client` + Drizzle ORM(`drizzle-orm/sqlite-core`)
- **인증**: 자체 아이디/비밀번호 (PBKDF2-SHA256 해시, opaque 세션 토큰, HttpOnly 쿠키), 계정 단위 로그인 시도 제한 포함
- **AI 분석**: OpenAI Responses API(JSON Schema 강제) 또는 규칙 기반 Mock 분석기
- **UI**: Tailwind CSS 4, Radix/shadcn 계열 컴포넌트

## Prerequisites

- Node.js `>=22.13.0`
- [Turso](https://turso.tech) 계정과 데이터베이스 (무료 플랜으로 충분)
- (선택) OpenAI API 키 — 없으면 `AI_MOCK_MODE=true`로 규칙 기반 분석기를 사용합니다

## 로컬 설정

```sh
npm install
cp .env.example .env   # 아래 "환경변수" 참고해 값 채우기
npm run db:migrate      # Turso DB에 마이그레이션 적용
npm run dev
```

터미널에 표시되는 `http://localhost:3000`으로 접속합니다.

### 환경변수

`.env.example`을 참고합니다.

| 변수 | 설명 |
| --- | --- |
| `TURSO_DATABASE_URL` | Turso 데이터베이스 URL (`libsql://...`) |
| `TURSO_AUTH_TOKEN` | Turso 인증 토큰 |
| `AI_MOCK_MODE` | `true`면 네트워크 없이 규칙 기반 분석기를 사용합니다 |
| `OPENAI_API_KEY` | 실제 OpenAI 분석을 사용할 때 서버 환경에만 설정합니다 |
| `OPENAI_ACTIVITY_MODEL` | 기본 분석 모델 |
| `OPENAI_FALLBACK_MODEL` | 향후 재시도 정책을 위한 예약 변수(현재 코드에서는 사용하지 않음) |

비밀키를 클라이언트 코드나 Git에 저장하지 마세요 (`.env*`는 gitignore 처리되어 있습니다).

## 데이터베이스 마이그레이션

스키마는 `db/schema.ts`에 있습니다. 스키마를 변경한 뒤:

```sh
npm run db:generate   # drizzle/ 아래 새 마이그레이션 파일 생성
npm run db:migrate     # .env의 Turso DB에 적용
```

기존에 적용된 마이그레이션 파일은 수정하지 말고 새 파일만 추가하세요. `drizzle-kit generate`가 만드는 SQL 파일에는 문(statement) 사이에 `--> statement-breakpoint` 구분자가 있어야 합니다 — 이 구분자가 없으면 Turso의 HTTP 프로토콜이 "한 번에 여러 SQL문을 보냄" 에러로 마이그레이션 적용을 거부합니다. 파일을 손으로 편집했다면 이 구분자가 잘 들어있는지 확인하세요.

## 명령어

- `npm run dev` — 개발 서버 (`next dev`)
- `npm run build` — 프로덕션 빌드 (`next build`)
- `npm run start` — 빌드된 앱 로컬 실행 (`next start`)
- `npm run lint` — ESLint
- `npm run db:generate` — 스키마 변경 후 마이그레이션 파일 생성
- `npm run db:migrate` — Turso DB에 마이그레이션 적용

## 배포 (Vercel)

GitHub 저장소를 Vercel 프로젝트에 연결하면 `main` 브랜치 push마다 자동 배포됩니다. Vercel 프로젝트 환경변수에 위 표의 값들을 동일하게 등록해야 합니다 (Production/Preview 모두).

## 인증

회원가입은 표시 이름, 로그인 아이디, 비밀번호를 받습니다. 로그인 아이디는 소문자로 정규화되어 고유해야 합니다. 비밀번호는 PBKDF2-SHA256 해시(사용자별 salt)로만 저장되며, 세션은 랜덤 opaque 토큰을 발급하고 데이터베이스에는 토큰의 SHA-256 해시만 저장합니다. `forain_session` 쿠키는 HttpOnly, SameSite=Lax이며 프로덕션에서는 Secure입니다.

같은 계정에 비밀번호를 5회 연속 틀리면 15분간 로그인이 잠깁니다(계정 단위 잠금). 잠금 시간이 지나면 다음 로그인 시도 때 자동으로 해제됩니다.

## 주요 파일

- `app/forain-app.tsx` — 대시보드, 편린 작성/조회, 활동 분석 결과, 결숲 시각화(SVG), 설정 UI
- `app/auth.ts` — 비밀번호 해싱, 세션 발급/검증, 로그인 시도 제한
- `app/auth-screen.tsx` — 로그인/회원가입 화면
- `app/api/` — 일기, 활동 분석, 확정, 인증 API 라우트
- `lib/database.ts` — Turso(libSQL)를 D1과 동일한 인터페이스(`prepare/bind/first/all/run/batch`)로 감싸는 어댑터
- `lib/forain-server.ts` — Mock/실제 AI 분석, 일일 생장 재계산
- `db/schema.ts` — Turso 데이터 모델 (Drizzle)
- `public/forain-logo.png` — 브랜드 로고

## Learn More

- [Turso Documentation](https://docs.turso.tech)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Next.js Documentation](https://nextjs.org/docs)
