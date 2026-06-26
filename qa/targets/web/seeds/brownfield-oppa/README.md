# board-service

> 이 시드 = `brownfield-bare` + **AgentOppa 생성 하네스** (`case3b`/`lc1-3` 입력). 아래 "하네스 없음"은 베이스(brownfield-bare) 설명이고, 이 시드엔 `.harness/`·`.claude/`·`.codex/`가 이미 깔려 있다.

이미 개발된 web 서비스 — **회원가입 / 로그인 / 프로필 / 게시판**. AgentOppa의 *브라운필드* QA 시드다(하네스 없음). 하네스를 여기 깔 때 **기존 컨벤션에 피팅**되는지(case2)·**원본을 안 건드리는지**(`git diff`=∅)를 본다.

## 컨벤션 (피팅 대상)

- 런타임: Node 빌트인만 (zero-install). HTTP는 `node:http`, 저장은 인메모리.
- 테스트 러너: **`node --test`** (`npm test`). ← 하네스는 이걸 *재사용*해야 한다(2번째 프레임워크 추가 X).
- 레이아웃: `src/server.mjs`(라우팅) · `src/routes/*`(핸들러) · `src/lib/*`(공용) · `test/*.test.mjs`.

## 엔드포인트

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| POST | `/signup` | — | 회원가입 `{username,password}` |
| POST | `/login` | — | 로그인 → `{token}` |
| GET | `/profile` | Bearer | 내 프로필 |
| PUT | `/profile` | Bearer | 프로필 수정 `{bio}` |
| GET | `/posts` | — | 글 목록 |
| POST | `/posts` | Bearer | 글 작성 `{title,body}` |
| GET | `/posts/:id` | — | 글 1건 |
| DELETE | `/posts/:id` | Bearer | 글 삭제(작성자만) |

## 실행 / 테스트

```bash
npm start     # :3000
npm test      # node --test (headless)
```
