#!/usr/bin/env node
/**
 * build-youtube-shorts.mjs — BEX (Argon) 5-Step Reels/Shorts Automated Production Engine
 *
 * Implements docs/video/reels-production-pipeline.md:
 *   1. Raw source footage (existing 1080p CAD/BIM showcase videos)
 *   2. Timed speech & phrase timestamps (ko-KR-SunHiNeural +12% fast Shorts pacing)
 *   3. Hyperframes-style Top Motion/Infographic Header (top 32% of 1080x1920 frame)
 *   4. pyCapCut-style Vertical Cut + Highlighted Word-Sync Captions (bottom 22% of 1080x1920)
 *   5. FFmpeg Loudness Normalization (-14 LUFS mobile audio standard)
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright'

const ROOT = process.cwd()
const YT_DIR = path.resolve(ROOT, 'public/demos/youtube')
const WORK_DIR = path.resolve(ROOT, 'docs/video/shorts_build')
fs.mkdirSync(YT_DIR, { recursive: true })
fs.mkdirSync(WORK_DIR, { recursive: true })

const SHORTS_SPECS = [
  {
    id: 'short01',
    outMp4: path.join(YT_DIR, 'short01-cad-to-3d.mp4'),
    outThumb: path.join(YT_DIR, 'short01-thumbnail.png'),
    outMeta: path.join(YT_DIR, 'short01-metadata.json'),
    sourceVideo: path.resolve(ROOT, 'public/demos/youtube/dwg23d-video-01-arch-bridge.mp4'),
    relatedYoutubeUrl: 'https://youtu.be/9d9FCOb4bEg',
    accentColor: '#38bdf8',
    badgeText: '2D CAD ➔ 3D BIM 3초 자동 복원',
    topHeadline: '2D 도면 넣으면 3초 만에\n3D 솔리드가 된다고?!',
    title: '2D CAD 도면 넣으면 3초 만에 3D 솔리드 완성?! (은선·3면도 자동 복원) #Shorts',
    description:
      '평면도·정면도·측면도로 그려진 2D CAD 도면, 아직도 일일이 선 따서 3D로 올리시나요?\n결정론적 기하 위상 엔진이 은선(Hidden Line)과 3면도 교차 검증으로 관통 구멍과 포켓까지 100% 자동 복원합니다.\n\n🎬 전체 원리 본편 영상 보기: https://youtu.be/9d9FCOb4bEg\n🚀 설치 없이 브라우저에서 바로 체험: https://bimer.uk/dwg23d.html\n\n#Shorts #2DCAD #3DCAD #3D모델링 #CAD자동화 #토목BIM #건축BIM #기계설계 #솔리드모델링',
    tags: [
      'Shorts',
      '2D CAD 3D 변환',
      'CAD 자동화',
      '2D 도면 3D',
      '3D 모델링',
      '삼각법 도면',
      '솔리드모델링',
      '토목BIM',
      '건축BIM',
      '기계제도',
    ],
    beats: [
      {
        srcStart: 5,
        stepTag: 'HOOK · 문제 제기',
        topSub: '2D 삼각법 도면 ➔ 일일이 3D 모델링?',
        captionHtml: '아직도 <span class="hl">2D CAD 도면</span> 보고<br/>일일이 선 따서 <span class="cy">3D</span>로 올리세요?',
        tts: '아직도 2D CAD 도면을 보고, 일일이 선을 따서 3D로 올리고 계신가요?',
      },
      {
        srcStart: 62,
        stepTag: 'STEP 1 · 3면도 자동 정렬',
        topSub: '평면도(XY) · 정면도(XZ) · 측면도(YZ)',
        captionHtml: '평면·정면·측면 <span class="hl">3면도</span>가<br/>3D 유리 상자로 <span class="cy">자동 폴딩</span>됩니다!',
        tts: '평면도, 정면도, 측면도 3면도가 3D 유리 상자처럼 공간에서 자동으로 접혀 올라갑니다.',
      },
      {
        srcStart: 132,
        stepTag: 'STEP 2 · 아치 본체 돌출',
        topSub: 'Half-Edge 폐곡선 ➔ +Y축 50mm 돌출',
        captionHtml: '정면도 <span class="hl">R30 아치 단면</span>을 찾아<br/>즉시 <span class="cy">50mm 솔리드</span>로 돌출!',
        tts: '정면도의 R30 아치 단면을 스스로 찾아내어 즉시 50밀리미터 입체 솔리드로 돌출시킵니다.',
      },
      {
        srcStart: 205,
        stepTag: 'STEP 3 · 은선(점선) 포켓 가공',
        topSub: '은선(Z=25) × 측면 U슬롯 교차 커팅',
        captionHtml: '도면 속 <span class="hl">점선(은선)</span>까지 읽어서<br/>내부 포켓을 <span class="cy">자동 커팅</span>합니다!',
        tts: '심지어 도면 속 점선인 은선까지 정확히 읽어서, 보이지 않는 내부 포켓을 자동으로 깎아냅니다.',
      },
      {
        srcStart: 262,
        stepTag: 'STEP 4 · 중공 보어 완전 관통',
        topSub: '상단 원통 보스 + Ø25 중공 홀 관통',
        captionHtml: '상단 원통 보스와 <span class="hl">Ø25 관통홀</span>까지<br/>오차 없이 <span class="cy">완벽 복원</span>!',
        tts: '상단 원통 보스와 직경 25밀리미터 중앙 관통홀까지 오차 없이 단숨에 복원합니다.',
      },
      {
        srcStart: 355,
        stepTag: 'CTA · 무료 웹 체험',
        topSub: 'bimer.uk · 본편 링크 고정 댓글 확인!',
        captionHtml: '설치 없는 무료 웹 CAD <span class="hl">bimer.uk</span><br/>아래 <span class="cy">관련 동영상</span>을 눌러보세요!',
        tts: '설치 없이 브라우저에서 바로 되는 무료 웹 캐드, 지금 아래 관련 동영상을 눌러 전체 원리를 확인해 보세요!',
      },
    ],
  },
  {
    id: 'short02',
    outMp4: path.join(YT_DIR, 'short02-vector-capture.mp4'),
    outThumb: path.join(YT_DIR, 'short02-thumbnail.png'),
    outMeta: path.join(YT_DIR, 'short02-metadata.json'),
    sourceVideo: path.resolve(ROOT, 'docs/video/vector-capture-engine-youtube.mp4'),
    relatedYoutubeUrl: 'https://youtu.be/YPlVIueLKMk',
    accentColor: '#a855f7',
    badgeText: 'CAD 도면 ➔ 보고서 칼선 벡터 캡처',
    topHeadline: '아직도 CAD 검은 화면 캡처해\n보고서에 넣으세요?!',
    title: '아직도 CAD 검은 화면 캡처해서 워드·보고서에 넣으세요? 1초 칼선 벡터 변환! #Shorts',
    description:
      'CAD 도면을 화면 캡처해서 워드·보고서에 붙여넣으면 시커먼 배경에 토너만 낭비되고 확대하면 픽셀이 다 깨집니다.\n2-Pass 벡터 캡처 엔진이 검은 배경 제거·7번 흰색 선 자동 반전·타이트 여백 크롭·256 색상 선굵기 매핑까지 1초 만에 끝냅니다!\n\n🎬 전체 원리 본편 영상 보기: https://youtu.be/YPlVIueLKMk\n🚀 무료 웹 워크스페이스 체험: https://bimer.uk\n\n#Shorts #2DCAD #CAD팁 #보고서작성 #벡터캡처 #WMF #SVG #DXF #설계자동화 #엔지니어링',
    tags: [
      'Shorts',
      'CAD 도면 워드 붙여넣기',
      'CAD 검은 배경 제거',
      'CAD 보고서',
      '벡터 캡처',
      'WMF 변환',
      '2D CAD 팁',
      '선가중치',
      '설계엔지니어',
    ],
    beats: [
      {
        srcStart: 6,
        stepTag: 'HOOK · 보고서 도면 참사',
        topSub: '시커먼 배경 · 광활한 여백 · 픽셀 깨짐',
        captionHtml: 'CAD 화면 <span class="hl">캡처해서 보고서</span> 넣으면<br/>시커먼 배경에 <span class="cy">선도 다 깨지죠?</span>',
        tts: '캐드 화면을 캡처해서 보고서에 넣으면, 시커먼 배경에 확대할 때마다 선이 다 깨지죠?',
      },
      {
        srcStart: 42,
        stepTag: 'STEP 1 · 배경 제거 & 타이트 크롭',
        topSub: 'Pass 1: 배경 사각형 제거 + 정점 바운딩',
        captionHtml: '<span class="hl">검은 배경</span>은 싹 날리고<br/>실제 도면 외곽만 <span class="cy">타이트 크롭</span>!',
        tts: '투패스 벡터 엔진이 검은 배경은 싹 날리고, 실제 도면 외곽선만 타이트하게 잘라냅니다.',
      },
      {
        srcStart: 75,
        stepTag: 'STEP 2 · 흰색 선 ➔ 검은 선 자동 반전',
        topSub: '배경 명도 판별 ➔ 7번 인덱스 색상 반전',
        captionHtml: '어두운 배경의 <span class="hl">흰색 도면선</span>만 골라<br/>선명한 <span class="cy">검은 실선</span>으로 반전!',
        tts: '어두운 화면에서 쓰던 흰색 도면선만 똑똑하게 골라내어, 인쇄용 검은 실선으로 자동 반전시킵니다.',
      },
      {
        srcStart: 132,
        stepTag: 'STEP 3 · 256 색상 선굵기 매핑',
        topSub: '외곽선 0.5mm · 치수선 0.13mm (2400 DPI)',
        captionHtml: '색상 번호별로 <span class="hl">선굵기(mm)</span>를 살려<br/>2400 DPI <span class="cy">출판 품질</span> 완성!',
        tts: '색상 번호별 물리 선굵기를 그대로 살려, 이천사백 디피아이 출판 품질 도면을 만듭니다.',
      },
      {
        srcStart: 252,
        stepTag: 'CTA · WMF · EMF · SVG · DXF 출력',
        topSub: '1000% 확대해도 깨짐 0% 순수 벡터!',
        captionHtml: '<span class="hl">1000% 확대</span>해도 안 깨지는 벡터!<br/>아래 <span class="cy">관련 동영상</span>에서 확인하세요!',
        tts: '천 퍼센트를 확대해도 절대 깨지지 않는 벡터 캡처 기술, 지금 아래 관련 동영상을 눌러 확인해 보세요!',
      },
    ],
  },
  {
    id: 'short03',
    outMp4: path.join(YT_DIR, 'short03-section-autodim.mp4'),
    outThumb: path.join(YT_DIR, 'short03-thumbnail.png'),
    outMeta: path.join(YT_DIR, 'short03-metadata.json'),
    sourceVideo: path.resolve(ROOT, 'docs/video/bim-section-autodim-youtube.mp4'),
    relatedYoutubeUrl: 'https://youtu.be/Dq_sPVqTlc0',
    accentColor: '#10b981',
    badgeText: '3D BIM 단면 ➔ 2D 치수 1초 자동화',
    topHeadline: '3D 구조물 자르면 2D 치수가\n1초 만에 자동 기입?!',
    title: '3D BIM 자르면 2D CAD 치수가 1초 만에 자동 기입! (치수선 충돌 0건) #Shorts',
    description:
      '3D BIM 모델을 단면으로 자른 뒤, 2D CAD에서 일일이 치수선 찍고 겹친 글자 옮기느라 야근하시나요?\n부재의 의미 역할(슬래브·벽체·헌치·개구부)과 최단 보조선 법칙으로 상·하·좌·우 4방향 치수를 충돌 0건으로 1초 만에 자동 배치합니다!\n\n🎬 전체 원리 본편 영상 보기: https://youtu.be/Dq_sPVqTlc0\n🚀 무료 웹 BIM 체험하기: https://bimer.uk\n\n#Shorts #3DBIM #2DCAD #자동치수 #단면도 #구조설계 #토목BIM #건축BIM #설계자동화',
    tags: [
      'Shorts',
      'CAD 자동 치수',
      '3D BIM 단면도',
      '2D CAD 치수',
      '단면도 자동화',
      '구조설계',
      '토목BIM',
      '건축BIM',
      '설계자동화',
    ],
    beats: [
      {
        srcStart: 5,
        stepTag: 'HOOK · 단면 치수 기입 야근',
        topSub: '엉키는 보조선 · 중복 치수 · 텍스트 겹침',
        captionHtml: '3D 단면 자르고 <span class="hl">2D 치수선</span> 찍느라<br/>아직도 <span class="cy">수작업 야근</span>하세요?',
        tts: '3D 모델을 단면으로 자르고, 2D 치수선을 일일이 찍느라 아직도 야근하고 계신가요?',
      },
      {
        srcStart: 42,
        stepTag: 'STEP 1 · 3D 부재 역할(Role) 보존',
        topSub: '슬래브 · 외벽 · 격벽 · 헌치 의미 인식',
        captionHtml: '단순 선분이 아니라 <span class="hl">벽체·슬래브·헌치</span><br/>부재 역할을 <span class="cy">스스로 구분</span>합니다!',
        tts: '단순한 선분이 아니라 벽체, 슬래브, 헌치 같은 부재의 역할을 컴퓨터가 스스로 구분합니다.',
      },
      {
        srcStart: 98,
        stepTag: 'STEP 2 · 4방향 최단 치수보조선',
        topSub: '상 · 하 · 좌 · 우 가장 가까운 외측 배치',
        captionHtml: '상·하·좌·우 <span class="hl">가장 가까운 방향</span>으로<br/>보조선 교차 없이 <span class="cy">깔끔 배치</span>!',
        tts: '상하좌우 가장 가까운 외측 방향으로 치수보조선을 빼내어 선이 절대 엉키지 않습니다.',
      },
      {
        srcStart: 130,
        stepTag: 'STEP 3 · 3단 트랙 적층 & 중복 제거',
        topSub: '내측 상세 ➔ 부재 체인 ➔ 전체 마감폭',
        captionHtml: '내측 상세부터 <span class="hl">외곽 전체 치수</span>까지<br/>3단 트랙으로 <span class="cy">충돌 0건</span> 정렬!',
        tts: '내측 상세 치수부터 최외곽 전체 마감 치수까지 3단 트랙으로 겹침 없이 정렬합니다.',
      },
      {
        srcStart: 220,
        stepTag: 'CTA · 실전 단면 자동 치수 완성',
        topSub: '박스 암거 · 거더 · 건축 단면 1초 완성',
        captionHtml: '박스 암거·거더·건축 단면 <span class="hl">1초 완성!</span><br/>아래 <span class="cy">관련 동영상</span>을 눌러보세요!',
        tts: '박스 암거부터 거더, 건축 단면까지 1초 만에 끝나는 자동 치수 기술, 아래 관련 동영상에서 확인하세요!',
      },
    ],
  },
]

function buildOverlayHtml(spec, beat, beatIdx, totalBeats) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 1080px;
    height: 1920px;
    background: transparent;
    font-family: 'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
    overflow: hidden;
  }
  /* STEP 3: Hyperframes-style Top Graphic Card (y: 60..470) */
  .top-card {
    position: absolute;
    top: 56px;
    left: 44px;
    right: 44px;
    height: 410px;
    border-radius: 32px;
    background: linear-gradient(145deg, rgba(15,23,42,0.96), rgba(30,41,59,0.92));
    border: 3px solid ${spec.accentColor};
    box-shadow: 0 20px 50px rgba(0,0,0,0.65), 0 0 32px ${spec.accentColor}44;
    padding: 28px 36px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .badge-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .pill-badge {
    background: ${spec.accentColor};
    color: #020617;
    font-weight: 900;
    font-size: 28px;
    padding: 8px 22px;
    border-radius: 999px;
    letter-spacing: -0.5px;
  }
  .step-counter {
    color: #f8fafc;
    background: rgba(255,255,255,0.12);
    border: 1.5px solid rgba(255,255,255,0.24);
    font-weight: 800;
    font-size: 25px;
    padding: 7px 20px;
    border-radius: 999px;
  }
  .headline {
    color: #ffffff;
    font-size: 56px;
    font-weight: 900;
    line-height: 1.22;
    letter-spacing: -1.5px;
    white-space: pre-line;
    text-shadow: 0 4px 16px rgba(0,0,0,0.6);
  }
  .sub-bar {
    display: flex;
    align-items: center;
    gap: 14px;
    background: rgba(2,6,23,0.75);
    border-left: 6px solid #facc15;
    padding: 14px 20px;
    border-radius: 14px;
  }
  .sub-tag {
    color: #facc15;
    font-size: 26px;
    font-weight: 900;
    flex-shrink: 0;
  }
  .sub-text {
    color: #e2e8f0;
    font-size: 27px;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Center Viewport Frame Border (y: 500..1420) */
  .viewport-border {
    position: absolute;
    top: 496px;
    left: 40px;
    width: 1000px;
    height: 920px;
    border-radius: 28px;
    border: 4px solid ${spec.accentColor};
    box-shadow: 0 0 40px rgba(0,0,0,0.75), inset 0 0 24px ${spec.accentColor}33;
    pointer-events: none;
  }

  /* STEP 4: pyCapCut-style Pop-In Word-Synced Caption Box (y: 1450..1830) */
  .caption-card {
    position: absolute;
    top: 1452px;
    left: 44px;
    right: 44px;
    height: 360px;
    border-radius: 32px;
    background: linear-gradient(180deg, rgba(2,6,23,0.94), rgba(15,23,42,0.97));
    border: 3px solid rgba(250,204,21,0.85);
    box-shadow: 0 18px 45px rgba(0,0,0,0.75);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 36px;
    text-align: center;
  }
  .caption-text {
    color: #ffffff;
    font-size: 52px;
    font-weight: 900;
    line-height: 1.32;
    letter-spacing: -1px;
    text-shadow: 0 4px 12px rgba(0,0,0,0.85);
  }
  .caption-text .hl {
    color: #facc15;
    background: rgba(250,204,21,0.16);
    padding: 2px 12px;
    border-radius: 12px;
  }
  .caption-text .cy {
    color: ${spec.accentColor};
    text-decoration: underline;
    text-underline-offset: 8px;
  }
  .progress-bar-wrap {
    margin-top: 26px;
    width: 86%;
    height: 12px;
    background: rgba(255,255,255,0.14);
    border-radius: 999px;
    overflow: hidden;
  }
  .progress-bar-fill {
    width: ${Math.round(((beatIdx + 1) / totalBeats) * 100)}%;
    height: 100%;
    background: linear-gradient(90deg, ${spec.accentColor}, #facc15);
  }
  .footer-brand {
    margin-top: 14px;
    color: #94a3b8;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
</style>
</head>
<body>
  <div class="top-card">
    <div class="badge-row">
      <div class="pill-badge">${spec.badgeText}</div>
      <div class="step-counter">${beatIdx + 1} / ${totalBeats}</div>
    </div>
    <div class="headline">${spec.topHeadline}</div>
    <div class="sub-bar">
      <div class="sub-tag">${beat.stepTag}</div>
      <div class="sub-text">${beat.topSub}</div>
    </div>
  </div>

  <div class="viewport-border"></div>

  <div class="caption-card">
    <div class="caption-text">${beat.captionHtml}</div>
    <div class="progress-bar-wrap"><div class="progress-bar-fill"></div></div>
    <div class="footer-brand">🌐 bimer.uk · 무설치 2D·3D 파라메트릭 CAD/BIM</div>
  </div>
</body>
</html>`
}

function getAudioDuration(filePath) {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
    { encoding: 'utf8' }
  ).trim()
  return Math.max(2.5, parseFloat(out) || 5.0)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
  const page = await context.newPage()

  try {
    for (const spec of SHORTS_SPECS) {
      if (!fs.existsSync(spec.sourceVideo)) {
        console.warn(`⚠️ Skipping ${spec.id}: sourceVideo missing (${spec.sourceVideo})`)
        continue
      }
      console.log(`\n🎬 [BEX Shorts Engine] Building ${spec.id}: ${spec.title}`)
      const specDir = path.join(WORK_DIR, spec.id)
      fs.mkdirSync(specDir, { recursive: true })

      // Step 2: Synthesize Korean Neural Voiceover (+12% snappy Shorts cadence)
      const pyTts = [
        'import asyncio, edge_tts, json, sys',
        'beats = json.loads(sys.argv[1])',
        'out_dir = sys.argv[2]',
        'async def run():',
        '    for i, b in enumerate(beats):',
        '        out_mp3 = f"{out_dir}/b{i:02d}_raw.mp3"',
        '        comm = edge_tts.Communicate(b["tts"], "ko-KR-SunHiNeural", rate="+12%")',
        '        await comm.save(out_mp3)',
        'asyncio.run(run())',
      ].join('\n')
      execFileSync('python', ['-c', pyTts, JSON.stringify(spec.beats), specDir.replace(/\\/g, '/')], { stdio: 'inherit' })

      const segFiles = []
      let totalDur = 0

      for (let i = 0; i < spec.beats.length; i++) {
        const beat = spec.beats[i]
        const rawMp3 = path.join(specDir, `b${String(i).padStart(2, '0')}_raw.mp3`)
        const normWav = path.join(specDir, `b${String(i).padStart(2, '0')}_norm.wav`)

        // Step 5: FFmpeg Loudness Normalization (-14 LUFS for Shorts/Reels mobile volume)
        execFileSync(
          'ffmpeg',
          ['-y', '-i', rawMp3, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '44100', '-ac', '2', normWav],
          { stdio: 'ignore' }
        )

        const dur = Number((getAudioDuration(normWav) + 0.25).toFixed(2))
        totalDur += dur

        // Step 3 & 4: Render 1080x1920 transparent PNG overlay (Hyperframes Top + pyCapCut Bottom)
        const html = buildOverlayHtml(spec, beat, i, spec.beats.length)
        await page.setContent(html, { waitUntil: 'load' })
        const overlayPng = path.join(specDir, `overlay_${String(i).padStart(2, '0')}.png`)
        await page.screenshot({ path: overlayPng, omitBackground: true })

        // Composite 9:16 vertical beat segment (background dark slate + center zoomed source video + PNG overlay)
        const segMp4 = path.join(specDir, `seg_${String(i).padStart(2, '0')}.mp4`)
        const filterComplex = [
          `color=c=0x090d16:s=1080x1920:r=30:d=${dur}[bg]`,
          `[0:v]trim=start=${beat.srcStart}:duration=${dur},setpts=PTS-STARTPTS,fps=30,scale=1380:912,crop=992:912:(iw-992)/2:0[vid]`,
          `[bg][vid]overlay=44:500[tmp]`,
          `[tmp][1:v]overlay=0:0:shortest=1[outv]`,
        ].join(';')

        execFileSync(
          'ffmpeg',
          [
            '-y',
            '-i',
            spec.sourceVideo,
            '-loop',
            '1',
            '-t',
            String(dur),
            '-i',
            overlayPng,
            '-i',
            normWav,
            '-filter_complex',
            filterComplex,
            '-map',
            '[outv]',
            '-map',
            '2:a',
            '-t',
            String(dur),
            '-c:v',
            'libx264',
            '-preset',
            'fast',
            '-crf',
            '20',
            '-pix_fmt',
            'yuv420p',
            '-c:a',
            'aac',
            '-b:a',
            '192k',
            segMp4,
          ],
          { stdio: 'ignore' }
        )
        segFiles.push(segMp4)
        console.log(`  ✓ Beat ${i + 1}/${spec.beats.length} (${dur}s): ${beat.stepTag}`)
      }

      // Concatenate beats into final 1080x1920 Short MP4
      const concatTxt = path.join(specDir, 'concat.txt')
      fs.writeFileSync(concatTxt, segFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n'), 'utf8')
      execFileSync(
        'ffmpeg',
        ['-y', '-f', 'concat', '-safe', '0', '-i', concatTxt, '-c', 'copy', '-movflags', '+faststart', spec.outMp4],
        { stdio: 'ignore' }
      )

      // Save first beat frame as Thumbnail
      execFileSync(
        'ffmpeg',
        ['-y', '-ss', '1.0', '-i', spec.outMp4, '-frames:v', '1', spec.outThumb],
        { stdio: 'ignore' }
      )

      const finalSecs = Math.round(totalDur)
      const mins = Math.floor(finalSecs / 60)
      const secs = String(finalSecs % 60).padStart(2, '0')
      const meta = {
        episodeId: spec.id,
        isShort: true,
        aspectRatio: '9:16',
        resolution: '1080x1920',
        voiceEngine: 'ko-KR-SunHiNeural',
        targetYouTubeAccount: 'horu2day@gmail.com',
        videoFile: spec.outMp4,
        srtFile: '',
        thumbnailFile: spec.outThumb,
        relatedYoutubeUrl: spec.relatedYoutubeUrl,
        durationSeconds: finalSecs,
        durationFormatted: `${mins}:${secs}`,
        title: spec.title,
        description: spec.description,
        tags: spec.tags,
        categoryId: '28',
        privacyStatus: 'public',
        language: 'ko',
        createdAt: new Date().toISOString(),
      }
      fs.writeFileSync(spec.outMeta, JSON.stringify(meta, null, 2), 'utf8')
      const sizeMb = (fs.statSync(spec.outMp4).size / (1024 * 1024)).toFixed(2)
      console.log(`✅ Built Short ${spec.id}: ${spec.outMp4} (${finalSecs}s, ${sizeMb} MB)`)
    }
  } finally {
    await browser.close()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
