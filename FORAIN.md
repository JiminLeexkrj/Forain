# Forain MVP

Forain은 사용자가 남긴 편린에서 실제로 수행한 활동을 추출하고, 확인된 활동을 개인 결숲의 생장으로 시각화하는 PC 우선 웹앱입니다.

## 구현된 흐름

1. ChatGPT 계정으로 로그인
2. 편린 작성 및 저장
3. 활동 분석
4. 추출 결과의 이름과 카테고리 수정 또는 삭제
5. 결과 확정
6. 카테고리별 일일 상한과 전체 일일 상한 계산
7. 결숲에서 활동 식물 확인
8. 식물 선택 후 근거 문장과 생장도 확인

같은 활동 분석 결과를 다시 확정해도 activity_mention_id 고유 제약으로 생장 이벤트가 중복 생성되지 않습니다. 편린이나 활동을 수정 또는 삭제하면 해당 날짜의 생장도를 다시 계산합니다.

## 환경변수

.env.example을 참고합니다.

- AI_MOCK_MODE: true면 네트워크 없이 규칙 기반 분석기를 사용합니다.
- OPENAI_API_KEY: 실제 OpenAI 분석을 사용할 때 서버 환경에만 설정합니다.
- OPENAI_ACTIVITY_MODEL: 기본 분석 모델입니다.
- OPENAI_FALLBACK_MODEL: 향후 재시도 정책에 사용할 대체 모델입니다.

비밀키를 클라이언트 코드나 Git에 저장하지 마세요.

## 로컬 실행

    npm ci
    npm run db:generate
    npm run build
    node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_thin_talkback.sql
    npm run dev

개발 서버가 표시하는 Local URL을 사용합니다. 로컬 미리보기는 테스트 계정으로 로그인 흐름을 제공합니다.

## 데이터베이스 마이그레이션

스키마는 db/schema.ts에 있습니다. 스키마를 변경한 후 npm run db:generate로 새 마이그레이션을 생성합니다.

기존에 적용된 마이그레이션은 수정하지 않고 새 파일을 추가합니다. Sites 배포 시 drizzle/ 아래의 미적용 마이그레이션이 순서대로 적용됩니다.

## Mock AI

기본값은 Mock AI입니다. 실행, 계획, 타인의 활동, 과거 회상, 실패한 시도를 구분하는 기본 규칙을 포함합니다.

    오늘 기타를 연습했다.
    내일은 운동해야겠다.
    친구가 축구를 했고 나는 옆에서 책을 읽었다.
    오늘은 아무것도 하지 않고 쉬었다.

기대 결과는 기타 연습, 독서, 휴식입니다.

## 실제 OpenAI API

Sites 환경변수에 OPENAI_API_KEY를 저장하고 AI_MOCK_MODE=false로 설정합니다. 서버 라우트만 API 키를 읽으며, 일기 원문을 로그에 남기지 않습니다. 분석 결과는 JSON Schema로 제한합니다.

## 주요 파일

- app/forain-app.tsx: 대시보드, 편린, 분석 결과, 결숲, 설정 UI
- app/globals.css: 결숲과 종이 질감의 시각 시스템 및 반응형 레이아웃
- app/api/: 일기, 활동 분석, 확정, 생장도 API
- lib/forain-server.ts: Mock/실제 AI 분석과 일일 상한 재계산
- db/schema.ts: D1 데이터 모델
- drizzle/0000_thin_talkback.sql: 최초 마이그레이션

## 현재 미구현

- 공개 결숲과 사용자 간 공명
- 날씨, 계절, 시간대 효과
- 자동 맥 생성과 복잡한 덩굴 애니메이션
- 3D 생태계
- 소셜 로그인과 결제
- 음성 일기
- 감정 또는 성격 분석

향후 브랜드 디자인이 확정되면 결숲 식물 렌더러, 로그인 표면, 편린 종이 질감 컴포넌트를 우선 교체할 수 있습니다.
