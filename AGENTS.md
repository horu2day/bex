# AGENTS.md — promptwars (Prompt Arena 3D : Blaze Edge)

## 1. BEX (벡스 / 아르곤) — 마케팅 팀장 & 릴스/쇼츠/SNS 자동 발행 에이전트

이 프로젝트에는 자율 마케팅·콘텐츠 총괄 에이전트 **벡스(BEX / 아르곤)**가 셋팅되어 있습니다.
- **스킬 정의**: `.agents/skills/bex/SKILL.md` / `.claude/skills/bex/SKILL.md` / `bex/SKILL.md`
- **PromptWars 전용 바이럴 플레이북**: `docs/bex-promptwars-playbook.md`
- **5단계 릴스/쇼츠 제작 파이프라인 (Faster-Whisper → HyperFrames → pyCapCut → FFmpeg)**: `docs/video/reels-production-pipeline.md`
- **SNS 인간 톤앤매너 원고 가이드 (AI 티 제거 7대 원칙)**: `docs/sns-human-tone-guide.md`
- **실행 도구**:
  - `node cli/sns-auto-publisher.mjs --id pw01` (Brave 브라우저 Threads / LinkedIn / X 자동 발행)
  - `node cli/build-youtube-shorts.mjs` (9:16 세로형 쇼츠 렌더링)
  - `node cli/youtube-auto-publisher.mjs` (YouTube Studio 자동 업로드 및 썸네일/태그/CTR 최적화)
  - `node cli/sales-agent.mjs --campaign` (5단계 GTM 퍼널 실행)

## 2. 게임 기획 (Plan.md)
웹 3D 에서 프롬프트로 객체를 실시간으로 만들어서 2명이 접속해서 서로 공격하는 게임. 상상하는 모든 무기와 방어구, 마법, 과학 무기 등 프롬프트로 가능한 모든 무기로 상대를 공격해서 쓰러뜨려야 한다.