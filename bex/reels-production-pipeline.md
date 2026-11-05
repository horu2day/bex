# BEX (Argon) 릴스(Reels) 자동 제작 파이프라인

릴스(숏폼 영상)를 제작할 때 **벡스(BEX / 아르곤)**가 지휘자(Orchestrator)로 실행하는 5단계 표준 파이프라인입니다.

---

## 제작 순서 (원문)

> 제 릴스가 만들어지는 순서
> 1. **폰으로 찍기** — 여기까지가 제 일
> 2. **위스퍼 (faster-whisper)** — 받아쓰기 + 단어마다 시간
>    👉 https://github.com/SYSTRAN/faster-whisper
> 3. **하이퍼프레임즈 (Hyperframes)** — 말에 맞춘 위쪽 그래픽
>    👉 https://github.com/heygen-com/hyperframes
> 4. **파이캡컷 (pyCapCut)** — 컷·자막·그래픽 올린 캡컷 초안
>    👉 https://github.com/GuanYixuan/pyCapCut
> 5. **FFmpeg** — 목소리 볼륨 맞추기
>    👉 https://github.com/FFmpeg/FFmpeg
> 이 순서를 돌리는 지휘자는 **벡스(아르곤)** 입니다.

---

## 단계별 역할 및 입출력 명세

| 단계 | 도구 / 저장소 | 역할 | 입력 → 출력 |
|---|---|---|---|
| **1. 원본 촬영** | 스마트폰 카메라 | 사용자 직접 촬영 (이후 전 과정은 BEX 자동화) | 원본 세로 영상 (`.mp4` / `.mov`) |
| **2. 음성 인식 & 단어 타임스탬프** | [`SYSTRAN/faster-whisper`](https://github.com/SYSTRAN/faster-whisper) (`word_timestamps=True`) | 대사 받아쓰기 + 단어 단위 시작·종료 시각 추출, 무음 구간 감지 | 원본 오디오 → 단어별 타임스탬프 JSON / SRT |
| **3. 상단 모션 그래픽 생성** | [`heygen-com/hyperframes`](https://github.com/heygen-com/hyperframes) | 발화 내용·타이밍에 맞춘 상단(위쪽 영역) 인포그래픽·모션 그래픽 렌더링 | 대본 + 단어 타임스탬프 → 상단 오버레이 클립 (`.mp4` / `.mov`) |
| **4. 캡컷(CapCut) 초안 조립** | [`GuanYixuan/pyCapCut`](https://github.com/GuanYixuan/pyCapCut) | 무음 점프컷 편집 + 단어 싱크 자막 트랙 + 상단 그래픽 트랙을 조합한 CapCut 프로젝트(`draft_content.json`) 생성 | 원본 + 타임스탬프 + 그래픽 → CapCut 초안 폴더 |
| **5. 오디오 라우드니스 정규화** | [`FFmpeg/FFmpeg`](https://github.com/FFmpeg/FFmpeg) (`loudnorm` / 컴프레서) | 목소리 볼륨 균일화(`-14 LUFS` 등) 및 최종 스트림 패키징 | 원본/편집 오디오 → 볼륨 정규화된 오디오·최종 마스터 |
| **지휘자 (Orchestrator)** | **벡스 (BEX / 아르곤)** | 2~5단계 전 과정을 파이프라인으로 순차 호출·검증 | 촬영본 1개 → 완성된 캡컷 초안 & 마스터 영상 |
