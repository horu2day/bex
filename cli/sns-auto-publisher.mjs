#!/usr/bin/env node
/**
 * sns-auto-publisher.mjs — BEX Human-Tone SNS Publisher (Brave Browser Edition)
 *
 * Connects directly to the user's Brave Browser profile
 * (%LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data) on WinSta0\Default (CDP port 9335)
 * where Threads, LinkedIn, and X (x.com) are logged in.
 *
 * Strictly follows docs/sns-human-tone-guide.md (zero emoji spam, zero AI buzzwords,
 * candid Korean CAD/BIM engineer & indie developer voice).
 *
 * Usage:
 *   node cli/sns-auto-publisher.mjs --check                        # Verify logged-in tabs in Brave
 *   node cli/sns-auto-publisher.mjs --post --id=p01                # Post p01 to Threads, LinkedIn, and X
 *   node cli/sns-auto-publisher.mjs --post --id=p01 --only=threads # Post to specific platform
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright'

const ROOT = process.cwd()
const DATA_DIR = path.resolve(ROOT, 'cli/data')
const YT_DIR = path.resolve(ROOT, 'public/demos/youtube')
const SNS_LOG_PATH = path.resolve(DATA_DIR, 'sns-publish-log.json')

const LOCAL_APPDATA = process.env.LOCALAPPDATA || 'C:\\Users\\hyund\\AppData\\Local'
const BRAVE_EXE = [
  'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  path.join(LOCAL_APPDATA, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
].find(p => fs.existsSync(p))
const BRAVE_USER_DATA = path.join(LOCAL_APPDATA, 'BraveSoftware', 'Brave-Browser', 'User Data')
const BRAVE_DEBUG_PORT = 9335

const args = process.argv.slice(2)
const hasFlag = f => args.includes(f)
const getArg = (f, def) => {
  const eq = args.find(a => a.startsWith(`${f}=`))
  if (eq) return eq.split('=')[1]
  const idx = args.indexOf(f)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : def
}

// Human-written, zero-AI-smell drafts (synced with docs/sns-human-tone-guide.md)
const HUMAN_SNS_POSTS = [
  {
    id: 'p01',
    topic: 'vector-capture',
    videoFile: path.join(YT_DIR, 'short02-vector-capture.mp4'),
    threadsText: [
      '캐드 화면 캡처해서 워드 보고서에 넣을 때마다 시커먼 배경 박스에 흰 선 날아가고 확대하면 계단 현상 생기는 거 볼 때마다 답답해서 그냥 웹에서 바로 돌아가는 벡터 추출기 하나 만들었습니다.',
      '',
      '검은 배경 사각형은 알아서 날리고, 흰색 선(7번 색)만 검은 선으로 반전시켜서 여백 딱 맞게 자른 다음 WMF/SVG로 바로 뱉어줍니다. 선굵기 테이블도 먹여서 출력해도 안 깨집니다.',
      '',
      '설치 파일 같은 거 없고 브라우저에서 그냥 도면 던지면 됩니다.',
      'https://bimer.uk/vector-capture.html',
    ].join('\n'),
    xText: [
      '캐드 도면 워드 보고서에 넣을 때마다 검은 배경에 흰 선 날아가고 깨지는 거 답답해서 웹 벡터 추출기 하나 짰습니다.',
      '검은 배경 날리고 흰 선만 흑색 반전해 WMF/SVG로 바로 뽑아줍니다.',
      'https://bimer.uk/vector-capture.html',
    ].join('\n'),
    linkedinText: [
      '현업에서 2D CAD 도면을 기술 보고서나 시방서(Word/PPT)에 넣을 때 가장 번거로운 작업이 배경색 반전과 여백 크롭, 그리고 선가중치(Lineweight) 유지입니다. 화면을 캡처하면 해상도가 깨지고, 매번 플롯 설정을 만지작거리기엔 시간이 아깝습니다.',
      '',
      '이번에 브라우저에서 별도 설치 없이 동작하는 2-Pass 메타파일 재구축 엔진을 업데이트했습니다.',
      '- 뷰포트 배경 사각형 자동 제거 및 실제 정점 기준 타이트 바운딩 크롭',
      '- 어두운 배경의 7번 색상(흰색 선)만 인쇄용 흑색으로 선택 반전',
      '- 색상 인덱스(1~255)별 물리 선굵기(mm)를 2400 DPI 논리 펜 폭으로 변환해 WMF/EMF/SVG/DXF로 동시 출력',
      '',
      '사내 보고서나 논문 도면 작업 많으신 엔지니어분들께 도움이 될 것 같아 웹에 무료로 열어두었습니다.',
      '웹 도구: https://bimer.uk/vector-capture.html',
      '작동 원리 영상(4분): https://youtu.be/YPlVIueLKMk',
    ].join('\n'),
  },
  {
    id: 'p02',
    topic: 'dwg-to-3d',
    videoFile: path.join(YT_DIR, 'short01-cad-to-3d.mp4'),
    threadsText: [
      '2D 삼각법 도면(평면·정면·측면도) 던지면 3D 솔리드로 자동 복원하는 거 만들면서 제일 골치 아팠던 게 정면도 점선(은선) 처리였습니다.',
      '',
      '겉에서 보면 그냥 아치 블록인데 정면도 Z=25 위치에 점선이랑 측면도 U슬롯 교차시켜서 안쪽 포켓 파내는 로직 잡느라 꽤 고생했네요. 표준 도면 26개 기준으로는 이제 구멍 관통까지 오차 없이 딱 떨어집니다.',
      '',
      '돌아가는 원리 궁금하신 분들은 영상 짧게 찍어뒀습니다.',
      'https://youtu.be/9d9FCOb4bEg',
    ].join('\n'),
    xText: [
      '2D 삼각법 도면(평면·정면·측면) 던지면 3D 솔리드로 자동 복원하는 엔진 만들면서 정면도 점선(은선)이랑 측면 U슬롯 교차로 내부 포켓 파내는 과정 정리해 봤습니다.',
      'https://youtu.be/9d9FCOb4bEg',
    ].join('\n'),
    linkedinText: [
      '평면도·정면도·측면도로 작성된 2D CAD 도면에서 컴퓨터가 어떻게 내부 포켓과 관통 구멍까지 읽어서 3D 솔리드를 복원할 수 있을지, 그동안 개발하며 정리한 기하 위상 파이프라인을 영상으로 정리했습니다.',
      '',
      '핵심은 정면도의 은선(Hidden Line) 레벨과 측면도의 U-슬롯 루프를 3차원 유리 상자(Glass Box) 공간에서 교차 검증해 불리언 커터(CSG Subtract)를 자동 생성하는 부분입니다.',
      '',
      '브라우저에서 바로 테스트해 보실 수 있습니다: https://bimer.uk/dwg23d.html',
      '전체 원리 분석 영상: https://youtu.be/9d9FCOb4bEg',
    ].join('\n'),
  },
  {
    id: 'p03',
    topic: 'section-autodim',
    videoFile: path.join(YT_DIR, 'short03-section-autodim.mp4'),
    threadsText: [
      '3D 모델 단면 잘라서 2D 캐드로 넘기면 그때부터 치수선 찍고 겹친 글자 옆으로 옮기는 게 일이라, 부재 역할(벽체/슬래브/헌치) 읽어서 상하좌우 가장 가까운 쪽으로 치수선 자동 배치하는 걸 붙여봤습니다.',
      '',
      '안쪽은 상세 치수, 중간은 부재 체인, 바깥은 전체 폭으로 3단 트랙 나눠서 치수 문자끼리 절대 안 겹치게 짰습니다. 박스 암거랑 거더 단면에서 생각보다 꽤 깔끔하게 뽑힙니다.',
      'https://youtu.be/Dq_sPVqTlc0',
    ].join('\n'),
    xText: [
      '3D 모델 단면 잘라서 2D 캐드로 넘길 때 치수선 찍고 겹친 글자 옮기는 게 일이라, 부재 역할 읽어서 4방향 3단 트랙으로 치수선 자동 배치하는 로직 붙여봤습니다.',
      'https://youtu.be/Dq_sPVqTlc0',
    ].join('\n'),
    linkedinText: [
      '3D BIM 모델을 단면 절단하여 2D CAD 도면화할 때 가장 시간이 많이 드는 단순 반복 작업이 치수 기입과 치수 문자 간섭 정리입니다.',
      '',
      '단순 2D 선분만 보면 어떤 치수가 중요한지 알 수 없기 때문에, 3D 슬라이서 단계에서 부재의 의미 역할(슬래브·벽체·거더·헌치·개구부)을 보존해 넘기고 상·하·좌·우 최단 치수보조선 법칙과 3단 트랙 적층으로 충돌 없이 치수를 자동 기입하도록 구현했습니다.',
      '',
      '알고리즘 상세 영상: https://youtu.be/Dq_sPVqTlc0',
      '웹 통합 워크스페이스: https://bimer.uk',
    ].join('\n'),
  },
  {
    id: 'pw01',
    project: 'promptwars',
    topic: 'promptwars-railgun-vs-mirror',
    threadsText: [
      '웹 3D에서 두 명이 접속해서 프롬프트로 실시간 무기 만들어 싸우는 게임(Prompt Arena)을 만들고 있는데 테스트하다가 웃겨서 죽는 줄 알았음 ㅋㅋ',
      '',
      '상대가 초고압 레일건 뽑길래 급하게 45도 각도의 거울 방패라고 쳤더니 진짜 빔이 굴절돼서 상대 본진 맞고 끝남.',
      '무기 프리셋 없이 상상하는 모든 마법이랑 과학 병기를 다 허용해놨더니 밸런스 잡는 게 아니라 물리 판정 잡는 게 일이다..',
      '',
      '혹시 이 무기는 절대 못 막는다 싶은 프롬프트 있으면 댓글로 하나만 던져주세요. 오늘 밤에 방어 프롬프트로 막아봄.',
    ].join('\n'),
    xText: [
      '프롬프트로 실시간 3D 무기 만들어 싸우는 1:1 웹게임 테스트 중인데 상대가 레일건 뽑길래 45도 거울 방패 쳤더니 굴절돼서 상대 맞고 끝남 ㅋㅋ 못 막을 것 같은 무기 프롬프트 추천 좀',
    ].join('\n'),
    linkedinText: [
      '정해진 무기 테이블이 아예 없는 1:1 웹 3D 대전 게임을 실험하고 있습니다.',
      '',
      '플레이어 두 명이 아레나에 접속해서 각자 프롬프트로 무기, 방어구, 마법, 과학 병기를 실시간으로 생성해 서로 공격하는 구조입니다.',
      '방금 테스트에서는 상대가 초고압 전자기 레일건을 생성하자, 반대쪽에서 굴절 거울 방패를 생성해 궤적을 튕겨내는 장면이 나왔습니다.',
      '',
      '정적 에셋 없이 실시간 프롬프트 해석만으로 3D 메쉬 조합과 물리/상성 판정을 지연 시간 없이 돌리는 게 생각보다 까다롭지만, 매 판 전혀 다른 전투가 나오는 게 꽤 흥미롭습니다.',
    ].join('\n'),
  },
  {
    id: 'pw02',
    project: 'promptwars',
    topic: 'promptwars-magic-vs-science',
    threadsText: [
      '판타지 마법만 쓰는 유저랑 현대 과학 무기만 쓰는 유저가 프롬프트로 맞붙으면 누가 이길까 궁금해서 붙여봤다.',
      '',
      '한쪽은 심연의 화염 운석 낙하 치고 반대쪽은 대기권 요격 미사일 + 액체질소 분사기 치는데, 웹 3D 화면에서 운석이랑 요격 미사일이 공중에서 터지는 거 보니까 괜히 뿌듯함.',
      '설치 없이 브라우저 링크 하나로 바로 붙을 수 있게 해놨으니 심심할 때 한 판씩 때려보시길.',
    ].join('\n'),
    xText: [
      '마법 프롬프트 유저(화염 운석 낙하) vs 과학 병기 유저(대기권 요격 미사일 + 액체질소) 웹 3D 아레나에서 실시간으로 붙이면 벌어지는 일. 공중에서 진짜 요격됨 ㅋㅋ',
    ].join('\n'),
    linkedinText: [
      '판타지 마법 프롬프트와 현대 과학 병기 프롬프트가 같은 3D 물리 아레나에서 충돌할 때 상성 판정을 어떻게 처리할지 테스트 중입니다.',
      '',
      '한쪽 플레이어가 화염 운석 낙하를 생성하고 반대쪽 플레이어가 대기권 요격 미사일과 액체질소 분사기를 생성했을 때, 온도와 운동량 파라미터를 실시간으로 계산해 공중 요격이 일어나도록 구현했습니다.',
    ].join('\n'),
  },
]

async function connectBraveOnDefaultDesktop() {
  // 1. Try existing CDP port 9335 first
  try {
    const b = await chromium.connectOverCDP(`http://127.0.0.1:${BRAVE_DEBUG_PORT}`)
    return b
  } catch {}

  // 2. Restart Brave with --remote-debugging-port=9335 --restore-last-session on WinSta0\Default
  console.log(`[BEX SNS] Enabling CDP port ${BRAVE_DEBUG_PORT} on Brave Browser (preserving open tabs & session)...`)
  const cmdLine = `"${BRAVE_EXE}" --user-data-dir="${BRAVE_USER_DATA}" --remote-debugging-port=${BRAVE_DEBUG_PORT} --restore-last-session --no-first-run --no-default-browser-check`

  const pyScript = [
    'import ctypes, subprocess, sys, time',
    'from ctypes import wintypes',
    'cmd_line = sys.argv[1]',
    'subprocess.run(["taskkill", "/IM", "brave.exe"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)',
    'time.sleep(2.0)',
    'subprocess.run(["taskkill", "/F", "/IM", "brave.exe"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)',
    'time.sleep(1.0)',
    'class STARTUPINFOW(ctypes.Structure):',
    '    _fields_ = [',
    '        ("cb", wintypes.DWORD), ("lpReserved", wintypes.LPWSTR), ("lpDesktop", wintypes.LPWSTR), ("lpTitle", wintypes.LPWSTR),',
    '        ("dwX", wintypes.DWORD), ("dwY", wintypes.DWORD), ("dwXSize", wintypes.DWORD), ("dwYSize", wintypes.DWORD),',
    '        ("dwXCountChars", wintypes.DWORD), ("dwYCountChars", wintypes.DWORD), ("dwFillAttribute", wintypes.DWORD),',
    '        ("dwFlags", wintypes.DWORD), ("wShowWindow", wintypes.WORD), ("cbReserved2", wintypes.WORD),',
    '        ("lpReserved2", ctypes.c_void_p), ("hStdInput", wintypes.HANDLE), ("hStdOutput", wintypes.HANDLE), ("hStdError", wintypes.HANDLE),',
    '    ]',
    'class PROCESS_INFORMATION(ctypes.Structure):',
    '    _fields_ = [("hProcess", wintypes.HANDLE), ("hThread", wintypes.HANDLE), ("dwProcessId", wintypes.DWORD), ("dwThreadId", wintypes.DWORD)]',
    'si = STARTUPINFOW()',
    'si.cb = ctypes.sizeof(si)',
    'si.lpDesktop = "WinSta0\\\\Default"',
    'si.dwFlags = 1',
    'si.wShowWindow = 1',
    'pi = PROCESS_INFORMATION()',
    'buf = ctypes.create_unicode_buffer(cmd_line)',
    'ok = ctypes.windll.kernel32.CreateProcessW(None, buf, None, None, False, 0x00000010, None, None, ctypes.byref(si), ctypes.byref(pi))',
    'if not ok: sys.exit(1)',
    'print(f"Launched Brave on WinSta0\\\\Default with CDP port (PID={pi.dwProcessId})")',
  ].join('\n')

  execFileSync('python', ['-c', pyScript, cmdLine], { stdio: 'inherit' })

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 700))
    try {
      return await chromium.connectOverCDP(`http://127.0.0.1:${BRAVE_DEBUG_PORT}`)
    } catch {}
  }
  throw new Error(`Failed to connect to Brave over CDP port ${BRAVE_DEBUG_PORT}`)
}

async function checkBraveSessions() {
  const browser = await connectBraveOnDefaultDesktop()
  const context = browser.contexts()[0]
  await new Promise(r => setTimeout(r, 2000))
  const pages = context.pages()
  const tabs = []
  for (const p of pages) {
    const url = p.url()
    const title = await p.title().catch(() => '')
    tabs.push({ url, title })
  }
  return {
    ok: true,
    browser: 'Brave',
    cdpPort: BRAVE_DEBUG_PORT,
    openTabsCount: tabs.length,
    tabs,
  }
}

async function postToThreads(context, post) {
  let page = context.pages().find(p => /threads\.(net|com)/i.test(p.url()))
  if (!page) {
    page = await context.newPage()
    await page.goto('https://www.threads.com/', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {})
  }
  await page.bringToFront().catch(() => {})
  await page.waitForTimeout(3000)

  // Click composer trigger on Threads feed
  const clicked = await page
    .evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('[role="button"], button, span, div'))
      const trigger = candidates.find(el => {
        const txt = (el.textContent || '').trim()
        return txt === '새로운 소식이 있나요?' || txt === "What's new?" || txt === '스레드를 시작하세요...'
      })
      if (trigger) {
        trigger.click()
        return true
      }
      return false
    })
    .catch(() => false)

  if (!clicked) {
    await page.click('svg[aria-label="글쓰기"], svg[aria-label="Create"], [aria-label="새로운 스레드"]', { timeout: 6000 }).catch(() => {})
  }
  await page.waitForTimeout(1800)

  const editor = await page.waitForSelector('[role="dialog"] [contenteditable="true"], [contenteditable="true"]', { timeout: 10000 })
  await editor.click()
  await page.keyboard.insertText(post.threadsText)
  await page.waitForTimeout(1000)

  // Click Post button inside dialog
  await page
    .evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]') || document.body
      const btns = Array.from(dialog.querySelectorAll('[role="button"], button'))
      const postBtn = btns.reverse().find(b => {
        const t = (b.textContent || '').trim()
        return t === '게시' || t === 'Post'
      })
      if (postBtn) postBtn.click()
    })
  await page.waitForTimeout(5000)
  return { platform: 'threads', ok: true, url: page.url() }
}

async function postToLinkedIn(context, post) {
  let page = context.pages().find(p => /linkedin\.com/i.test(p.url()))
  if (!page) {
    page = await context.newPage()
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {})
  } else if (!page.url().includes('/feed')) {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {})
  }
  await page.bringToFront().catch(() => {})
  await page.waitForTimeout(3500)

  // Click "글 올리기" / "Start a post"
  await page
    .evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, [role="button"]'))
      const startBtn = btns.find(b => {
        const t = (b.textContent || '').trim()
        return t.includes('글 올리기') || t.includes('업데이트 시작') || t.includes('Start a post')
      })
      if (startBtn) startBtn.click()
    })
  await page.waitForTimeout(2000)

  const editor = await page.waitForSelector('.ql-editor, [role="textbox"][contenteditable="true"]', { timeout: 12000 })
  await editor.click()
  await page.keyboard.insertText(post.linkedinText)
  await page.waitForTimeout(1500)

  await page.click('button.share-actions__primary-action, button:has-text("게시"), button:has-text("Post")', { timeout: 10000 })
  await page.waitForTimeout(5000)
  return { platform: 'linkedin', ok: true, url: page.url() }
}

async function postToX(context, post) {
  let page = context.pages().find(p => /(?:x\.com|twitter\.com)/i.test(p.url()))
  if (!page) {
    page = await context.newPage()
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {})
  }
  await page.bringToFront().catch(() => {})
  await page.waitForTimeout(3500)

  const editor = await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 12000 })
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Backspace')
  await page.keyboard.insertText(post.xText)
  await page.keyboard.type(' ')
  await page.waitForTimeout(1200)

  await page.click('[data-testid="tweetButtonInline"], [data-testid="tweetButton"]', { timeout: 10000 })
  await page.waitForTimeout(5000)
  return { platform: 'x', ok: true, url: page.url() }
}

function saveSnsLog(entry) {
  let list = []
  try {
    list = JSON.parse(fs.readFileSync(SNS_LOG_PATH, 'utf8'))
  } catch {}
  list.unshift(entry)
  fs.writeFileSync(SNS_LOG_PATH, JSON.stringify(list, null, 2), 'utf8')
}

function pickNextUnpublishedSnsPost() {
  let list = []
  try {
    list = JSON.parse(fs.readFileSync(SNS_LOG_PATH, 'utf8'))
  } catch {}
  const doneIds = new Set(
    list.filter(item => Array.isArray(item.results) && item.results.some(r => r.ok)).map(item => item.postId)
  )
  const next = HUMAN_SNS_POSTS.find(p => !doneIds.has(p.id))
  return next ? next.id : null
}

if (hasFlag('--check')) {
  const res = await checkBraveSessions()
  console.log(JSON.stringify(res, null, 2))
  process.exit(0)
} else if (hasFlag('--post') || hasFlag('--post-next')) {
  const postId = hasFlag('--post-next') ? pickNextUnpublishedSnsPost() : getArg('--id', 'p01')
  if (!postId) {
    console.log(JSON.stringify({ ok: true, status: 'all-published' }, null, 2))
    process.exit(0)
  }
  const only = getArg('--only', 'all').toLowerCase()
  const post = HUMAN_SNS_POSTS.find(p => p.id === postId) || HUMAN_SNS_POSTS[0]
  const browser = await connectBraveOnDefaultDesktop()
  const context = browser.contexts()[0]
  const results = []

  if (only === 'all' || only.includes('threads')) {
    try {
      results.push(await postToThreads(context, post))
    } catch (e) {
      results.push({ platform: 'threads', ok: false, error: e.message })
    }
  }
  if (only === 'all' || only.includes('linkedin')) {
    try {
      results.push(await postToLinkedIn(context, post))
    } catch (e) {
      results.push({ platform: 'linkedin', ok: false, error: e.message })
    }
  }
  if (only === 'all' || only.includes('x')) {
    try {
      results.push(await postToX(context, post))
    } catch (e) {
      results.push({ platform: 'x', ok: false, error: e.message })
    }
  }

  const logItem = {
    postId: post.id,
    topic: post.topic,
    publishedAt: new Date().toISOString(),
    results,
  }
  saveSnsLog(logItem)
  console.log(JSON.stringify({ ok: true, ...logItem }, null, 2))
  process.exit(0)
} else {
  console.log(
    JSON.stringify(
      {
        ok: true,
        browser: 'Brave',
        braveExe: BRAVE_EXE,
        braveUserData: BRAVE_USER_DATA,
        readyDrafts: HUMAN_SNS_POSTS,
      },
      null,
      2
    )
  )
}
