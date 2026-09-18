# GitHub · Vercel 이전 메모

## 유지할 수 있는 인증 구조

- 회원가입·로그인 API는 상대 경로(`/api/auth/*`)를 사용한다.
- 비밀번호는 Web Crypto의 PBKDF2-SHA-256으로 해시하며 평문을 저장하지 않는다.
- 세션은 추측 불가능한 토큰을 발급하고, 데이터베이스에는 토큰의 SHA-256 해시만 저장한다.
- 브라우저에는 `HttpOnly`, `SameSite=Lax`, 프로덕션 `Secure` 쿠키만 저장한다.
- 인증 판단은 모든 보호 API에서 서버 측으로 수행한다.

이 부분은 Vercel의 Node.js 또는 Edge 런타임에서도 동일한 방식으로 유지할 수 있다.

## 이전할 때 교체할 부분

현재 데이터 저장소는 Sites의 Cloudflare D1이며 연결 지점은 `lib/database.ts`에 모여 있다. Vercel 배포 전에는 이 어댑터와 D1 쿼리를 Vercel Postgres, Neon 또는 다른 영속 SQL 데이터베이스로 교체해야 한다. 서버리스 인스턴스의 메모리나 로컬 파일에는 사용자·세션 데이터를 저장하지 않는다.

SQLite 마이그레이션의 `users`, `auth_sessions` 및 기존 Forain 테이블을 새 데이터베이스 스키마로 옮기고, 다음 제약 조건을 유지한다.

- `users.login_id` 고유 제약
- `auth_sessions.token_hash` 고유 제약
- 세션의 사용자 외래 키와 사용자 삭제 시 세션 삭제
- 사용자 소유 데이터 조회 시 항상 `user_id` 조건 적용

## 배포 전 추가 권장 사항

- 로그인 시도 속도 제한
- 비밀번호 재설정 또는 계정 복구 정책
- 만료 세션 정리 작업
- 운영 데이터베이스 백업과 마이그레이션 리허설
