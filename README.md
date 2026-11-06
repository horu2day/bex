# AGENTS.md — [프롬프트 아레나 · BLAZE FORGE] (PromptWars 3D) & 벡스(BEX / Vex)

## 1. 즉시 실행 가이드 ("벡스 셋팅 완료, 유튜브 영상 만들어서 올려")

이 저장소에는 마케팅·유튜브·쇼츠·SNS 자동화 총괄 에이전트 **벡스(BEX / Vex / 아르곤)**와 **[프롬프트 아레나 · BLAZE FORGE]** 전용 영상 빌더 및 인증 세션이 모두 포함되어 있습니다.

### A. [프롬프트 아레나 · BLAZE FORGE] 홍보 영상(16:9) + 쇼츠(9:16) 즉시 렌더링
```bash
node cli/build-blaze-forge-video.mjs
```
- 생성 산출물 (이미 사전 렌더링되어 `public/demos/youtube/` 에도 포함됨):
  - 16:9 메인 영상: `public/demos/youtube/blaze-forge-promo.mp4` (`ep10-metadata.json`, `blaze-forge-promo-thumb.png`)
  - 9:16 쇼츠 영상: `public/demos/youtube/short04-blaze-forge.mp4` (`short04-metadata.json`, `short04-blaze-forge-thumb.png`)

### B. 유튜브 자동 업로드 (YouTube Studio 세션 쿠키 `cli/data/youtube-studio-storage-state.json` 포함)
```bash
# 9:16 쇼츠 업로드
node cli/youtube-auto-publisher.mjs --upload --ep short04

# 16:9 메인 홍보 영상 업로드
node cli/youtube-auto-publisher.mjs --upload --ep ep10
```

### C. SNS 인간 톤앤매너 자동 홍보 (Threads / LinkedIn / X)
```bash
node cli/sns-auto-publisher.mjs --id pw01
```

## 2. 핵심 문서 및 스킬 경로
- **스킬 정의**: `.agents/skills/bex/SKILL.md` / `.agents/skills/vex/SKILL.md` / `vex/SKILL.md` / `bex/SKILL.md`
- **프롬프트 아레나(BLAZE FORGE) 전용 플레이북**: `docs/bex-promptwars-playbook.md`
- **5단계 릴스/쇼츠 파이프라인**: `docs/video/reels-production-pipeline.md`
- **SNS AI 티 제거 가이드**: `docs/sns-human-tone-guide.md`