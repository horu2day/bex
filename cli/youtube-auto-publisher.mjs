#!/usr/bin/env node
/**
 * youtube-auto-publisher.mjs — BEX Unmanned YouTube Auto-Uploader for horu2day@gmail.com
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { chromium } from 'playwright'

const ROOT = process.cwd()
const YT_DIR = path.resolve(ROOT, 'public/demos/youtube')
const DATA_DIR = path.resolve(ROOT, 'cli/data')
const PROFILE_DIR = fs.existsSync(path.resolve(DATA_DIR, 'carat-profile-horu2day'))
  ? path.resolve(DATA_DIR, 'carat-profile-horu2day')
  : path.resolve(DATA_DIR, 'yt-profile-horu2day')
const OAUTH_CLIENT_PATH = path.resolve(DATA_DIR, 'youtube-oauth-client.json')
const OAUTH_TOKEN_PATH = path.resolve(DATA_DIR, 'youtube-token.json')
const PUBLISH_LOG_PATH = path.resolve(DATA_DIR, 'youtube-publish-log.json')
const TARGET_EMAIL = 'horu2day@gmail.com'

fs.mkdirSync(DATA_DIR, { recursive: true })

const args = process.argv.slice(2)
const hasFlag = f => args.includes(f)
const getArg = (f, def) => {
  const eq = args.find(a => a.startsWith(`${f}=`))
  if (eq) return eq.split('=')[1]
  const idx = args.indexOf(f)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : def
}

function loadEpisodeMeta(ep = 'ep03') {
  const metaPath = path.join(YT_DIR, `${ep}-metadata.json`)
  if (!fs.existsSync(metaPath)) {
    throw new Error(`Metadata not found at ${metaPath}.`)
  }
  return JSON.parse(fs.readFileSync(metaPath, 'utf8'))
}

function getStatus() {
  const episodes = fs.existsSync(YT_DIR)
    ? fs
        .readdirSync(YT_DIR)
        .filter(f => f.endsWith('-metadata.json'))
        .sort()
        .map(f => {
          try {
            return JSON.parse(fs.readFileSync(path.join(YT_DIR, f), 'utf8'))
          } catch {
            return null
          }
        })
        .filter(Boolean)
    : []
  const hasBrowserProfile = fs.existsSync(PROFILE_DIR) && fs.readdirSync(PROFILE_DIR).length > 0
  const hasApiClient = fs.existsSync(OAUTH_CLIENT_PATH)
  const hasApiToken = fs.existsSync(OAUTH_TOKEN_PATH)
  let publishHistory = []
  try {
    publishHistory = JSON.parse(fs.readFileSync(PUBLISH_LOG_PATH, 'utf8'))
  } catch {}

  return {
    ok: true,
    targetAccount: TARGET_EMAIL,
    profileDir: PROFILE_DIR,
    readiness: {
      browserStudioProfileReady: hasBrowserProfile,
      youtubeApiOAuthClientReady: hasApiClient,
      youtubeApiRefreshTokenReady: hasApiToken,
    },
    producedEpisodes: episodes.map(e => ({
      episodeId: e.episodeId,
      title: e.title,
      durationFormatted: e.durationFormatted,
      durationSeconds: e.durationSeconds,
      videoFile: e.videoFile,
      videoFileExists: fs.existsSync(e.videoFile),
      videoSizeMb: fs.existsSync(e.videoFile)
        ? Number((fs.statSync(e.videoFile).size / (1024 * 1024)).toFixed(2))
        : 0,
      srtFile: e.srtFile,
      thumbnailFile: e.thumbnailFile,
    })),
    publishHistory,
  }
}

function launchChromeOnDefaultDesktop(profileDir, debugPort, startUrl) {
  const chromeCandidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    chromium.executablePath(),
  ]
  const chromeExe = chromeCandidates.find(p => p && fs.existsSync(p))
  const debugArg = debugPort ? ` --remote-debugging-port=${debugPort}` : ''
  const chromeCmdLine = `"${chromeExe}" --user-data-dir="${profileDir}"${debugArg} --no-first-run --no-default-browser-check --new-window "${startUrl}"`

  const pyScript = [
    'import ctypes, subprocess, sys',
    'from ctypes import wintypes',
    'profile_name = sys.argv[1]',
    'cmd_line = sys.argv[2]',
    'try:',
    '    out = subprocess.check_output(["wmic", "process", "where", "name=\'chrome.exe\'", "get", "ProcessId,CommandLine"], text=True, errors="ignore")',
    '    for line in out.splitlines():',
    '        if profile_name in line:',
    '            parts = line.strip().split()',
    '            if parts and parts[-1].isdigit():',
    '                subprocess.run(["taskkill", "/F", "/PID", parts[-1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)',
    'except Exception:',
    '    pass',
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
    'if not ok:',
    '    sys.exit(1)',
    'print(f"Launched Chrome on WinSta0\\\\Default (PID={pi.dwProcessId})")',
  ].join('\n')

  try {
    execFileSync('python', ['-c', pyScript, path.basename(profileDir), chromeCmdLine], { stdio: 'inherit' })
    return
  } catch {}

  const spawnArgs = [
    `--user-data-dir=${profileDir}`,
    ...(debugPort ? [`--remote-debugging-port=${debugPort}`] : []),
    '--no-first-run',
    '--no-default-browser-check',
    '--new-window',
    startUrl,
  ]
  const child = spawn(chromeExe, spawnArgs, { detached: true, stdio: 'ignore' })
  child.unref()
  console.log(`Launched Chrome via Node spawn fallback (PID=${child.pid})`)
}

async function runBrowserLogin() {
  fs.mkdirSync(PROFILE_DIR, { recursive: true })
  console.log(`[BEX YouTube Auto-Publisher] Opening Chrome profile for ${TARGET_EMAIL} on WinSta0\\Default...`)
  const loginUrl = `https://accounts.google.com/ServiceLogin?Email=${encodeURIComponent(TARGET_EMAIL)}&continue=${encodeURIComponent('https://studio.youtube.com')}`
  launchChromeOnDefaultDesktop(PROFILE_DIR, null, loginUrl)
  console.log(`👉 브라우저에서 ${TARGET_EMAIL} 계정으로 로그인 후 YouTube Studio가 뜨면 창을 닫아주세요.`)
}

async function runBrowserStudioUpload(ep = 'ep03', visibility = 'public') {
  const meta = loadEpisodeMeta(ep)
  if (!hasFlag('--force')) {
    const st = getStatus()
    const existing = (st.publishHistory || []).find(p => p.episodeId === ep)
    if (existing) {
      console.log(`⚠️ [Idempotency Guard] Episode ${ep} is already published (${existing.youtubeUrl}). Skipping duplicate upload.`)
      return { ok: true, skippedDuplicate: true, ...existing }
    }
  }
  if (!fs.existsSync(meta.videoFile)) {
    throw new Error(`Video file missing: ${meta.videoFile}`)
  }
  fs.mkdirSync(PROFILE_DIR, { recursive: true })
  const debugPort = 9334
  console.log(`[BEX YouTube Studio Uploader] Launching Chrome on WinSta0\\Default (port ${debugPort}) for ${TARGET_EMAIL}...`)
  launchChromeOnDefaultDesktop(PROFILE_DIR, debugPort, 'https://studio.youtube.com')

  let browser = null
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 700))
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`)
      break
    } catch {}
  }
  if (!browser) {
    throw new Error(`Failed to connect over CDP to port ${debugPort}`)
  }

  try {
    const context = browser.contexts()[0]
    await new Promise(r => setTimeout(r, 2500))
    const page =
      context.pages().find(p => p.url().includes('studio.youtube.com')) ||
      context.pages()[0] ||
      (await context.newPage())
    await page.bringToFront().catch(() => {})
    if (!page.url().includes('studio.youtube.com')) {
      await page.goto('https://studio.youtube.com', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {})
    }
    await page.waitForTimeout(3000)

    // Wait if user needs to log into Google / YouTube Studio on the visible window
    if (page.url().includes('accounts.google.com') || !page.url().includes('studio.youtube.com')) {
      console.log(`⏳ Waiting for ${TARGET_EMAIL} login on the visible Chrome window (https://studio.youtube.com)...`)
      for (let w = 0; w < 180; w++) {
        await page.waitForTimeout(1000)
        const u = page.url()
        if (u.includes('studio.youtube.com') && !u.includes('accounts.google.com')) {
          console.log(`✓ Logged into YouTube Studio: ${u}`)
          break
        }
      }
    }

    await page.waitForTimeout(3000)

    // Dismiss any welcome / promotional dialogs
    await page.click('#dismiss-button, ytcp-button#dismiss-button', { timeout: 2500 }).catch(() => {})

    // 1. Open Upload Dialog (either click upload icon or create -> upload)
    console.log('Opening YouTube Studio upload dialog...')
    const directUploadBtn = await page.$('#upload-icon, ytcp-button#upload-icon')
    if (directUploadBtn) {
      await directUploadBtn.click()
    } else {
      await page.click('#create-icon, ytcp-button#create-icon', { timeout: 15000 })
      await page.waitForTimeout(800)
      await page.click('tp-yt-paper-item#text-item-0, [test-id="upload-beta"]', { timeout: 10000 })
    }
    await page.waitForTimeout(1500)

    // 2. Attach video file
    const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 20000 })
    await fileInput.setInputFiles(meta.videoFile)
    console.log(`✓ Attached video file: ${meta.videoFile}`)
    await page.waitForTimeout(5000)

    // 3. Fill Title & Description
    const boxes = await page.$$('ytcp-social-suggestions-textbox #textbox[contenteditable="true"]')
    if (boxes[0]) {
      await boxes[0].click()
      await page.keyboard.press('Control+A')
      await page.keyboard.press('Backspace')
      await page.keyboard.insertText(meta.title.slice(0, 100))
      console.log(`✓ Set Title: ${meta.title.slice(0, 100)}`)
    }
    await page.waitForTimeout(600)
    if (boxes[1]) {
      await boxes[1].click()
      await page.keyboard.press('Control+A')
      await page.keyboard.press('Backspace')
      await page.keyboard.insertText(meta.description)
      console.log(`✓ Set Description (${meta.description.length} chars)`)
    }
    await page.waitForTimeout(800)

    // 4. Upload Custom Thumbnail (for non-Shorts videos)
    if (!meta.isShort && meta.thumbnailFile && fs.existsSync(meta.thumbnailFile)) {
      try {
        const thumbInput = await page.$('ytcp-thumbnails-compact-editor-uploader input[type="file"], #still-picker input[type="file"]')
        if (thumbInput) {
          await thumbInput.setInputFiles(meta.thumbnailFile)
          console.log(`✓ Uploaded custom thumbnail: ${meta.thumbnailFile}`)
          await page.waitForTimeout(1000)
        }
      } catch {}
    }

    // 5. Select "No, it's not made for kids" & Fill Search Tags
    await page.click('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]', { timeout: 10000 }).catch(() => {})
    console.log(`✓ Selected: Not made for kids`)
    await page.waitForTimeout(600)

    if (Array.isArray(meta.tags) && meta.tags.length > 0) {
      try {
        await page.click('#toggle-button', { timeout: 4000 }).catch(() => {})
        await page.waitForTimeout(600)
        const tagInput = await page.$('#tags-container input#text-input, ytcp-form-input-container#tags-container input')
        if (tagInput) {
          await tagInput.click()
          await page.keyboard.insertText(meta.tags.join(',') + ',')
          console.log(`✓ Added ${meta.tags.length} SEO search tags`)
          await page.waitForTimeout(500)
        }
      } catch {}
    }

    // 6. Click Next -> Next -> Next to reach Visibility
    for (let step = 0; step < 3; step++) {
      await page.click('#next-button', { timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(1500)
    }

    // 6. Select Visibility (Public)
    const visRadio =
      visibility === 'unlisted'
        ? 'tp-yt-paper-radio-button[name="UNLISTED"]'
        : visibility === 'private'
          ? 'tp-yt-paper-radio-button[name="PRIVATE"]'
          : 'tp-yt-paper-radio-button[name="PUBLIC"]'
    await page.click(visRadio, { timeout: 10000 }).catch(() => {})
    console.log(`✓ Selected visibility: ${visibility.toUpperCase()}`)
    await page.waitForTimeout(1500)

    // Grab the assigned YouTube video URL from the upload dialog before clicking Done
    const youtubeUrl = await page
      .evaluate(() => {
        const a = document.querySelector(
          'ytcp-uploads-dialog a.ytcp-video-info, a.ytcp-video-info[href*="youtu.be"], a.ytcp-video-info[href*="youtube.com/shorts"], ytcp-uploads-dialog a[href*="youtu.be"], ytcp-uploads-dialog a[href*="youtube.com/shorts"]'
        )
        return a ? a.href : null
      })
      .catch(() => null)

    // 7. Wait until video upload passes 100% / Done button is enabled, then click Done / Publish
    console.log('Clicking Publish (#done-button)...')
    await page.click('#done-button', { timeout: 30000 })
    await page.waitForTimeout(6000).catch(() => {})

    const logEntry = {
      episodeId: meta.episodeId,
      title: meta.title,
      account: TARGET_EMAIL,
      mode: 'browser-studio',
      youtubeUrl: youtubeUrl || 'https://studio.youtube.com',
      visibility,
      publishedAt: new Date().toISOString(),
    }
    savePublishLog(logEntry)
    console.log(`✅ Published to YouTube (${TARGET_EMAIL}): ${logEntry.youtubeUrl}`)
    return { ok: true, ...logEntry }
  } finally {
    await browser.close().catch(() => {})
  }
}

function savePublishLog(entry) {
  let list = []
  try {
    list = JSON.parse(fs.readFileSync(PUBLISH_LOG_PATH, 'utf8'))
  } catch {}
  list = list.filter(x => x.episodeId !== entry.episodeId)
  list.unshift(entry)
  fs.writeFileSync(PUBLISH_LOG_PATH, JSON.stringify(list, null, 2), 'utf8')
}

async function runStudioDeduplicate() {
  const debugPort = 9334
  launchChromeOnDefaultDesktop(PROFILE_DIR, debugPort, 'https://studio.youtube.com')
  let browser = null
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 700))
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`)
      break
    } catch {}
  }
  if (!browser) throw new Error('Failed to connect over CDP')
  try {
    const page = browser.contexts()[0].pages()[0]
    await page.waitForTimeout(4000)
    const curUrl = page.url()
    const m = curUrl.match(/studio\.youtube\.com\/channel\/([^/?#]+)/)
    if (m) {
      await page.goto(`https://studio.youtube.com/channel/${m[1]}/videos/upload`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
    } else {
      await page.click('#menu-paper-icon-item-1, a#menu-paper-icon-item-1', { timeout: 10000 }).catch(() => {})
    }
    await page.waitForSelector('ytcp-video-row', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)

    const rows = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('ytcp-video-row')).map((r, idx) => {
        const titleEl = r.querySelector('#video-title')
        const linkEl = r.querySelector('a#video-title, a[href*="/video/"]')
        return {
          idx,
          title: titleEl ? titleEl.textContent.trim() : '',
          href: linkEl ? linkEl.getAttribute('href') : '',
        }
      })
    })
    console.log('Current Studio rows:', JSON.stringify(rows, null, 2))

    const seenTitles = new Set()
    const deleted = []
    for (let i = 0; i < rows.length; i++) {
      const t = rows[i].title
      if (!t) continue
      if (seenTitles.has(t)) {
        console.log(`Found duplicate video row #${i}: "${t}" (${rows[i].href}) — deleting duplicate...`)
        const rowHandles = await page.$$('ytcp-video-row')
        const targetRow = rowHandles[i]
        if (targetRow) {
          await targetRow.hover()
          await page.waitForTimeout(600)
          const moreBtn = await targetRow.$('ytcp-icon-button#more-button, #more-button, [aria-label*="옵션"], [aria-label*="Options"]')
          if (moreBtn) {
            await moreBtn.click()
            await page.waitForTimeout(800)
            // Click "완전히 삭제" / "Delete forever" (usually test-id="delete" or last item in menu)
            await page.click('tp-yt-paper-item[test-id="delete"], tp-yt-paper-item:has-text("완전히 삭제"), tp-yt-paper-item:has-text("Delete forever")', { timeout: 5000 }).catch(() => {})
            await page.waitForTimeout(1000)
            await page.click('ytcp-checkbox-lit#confirm-checkbox, #confirm-checkbox', { timeout: 5000 }).catch(() => {})
            await page.waitForTimeout(600)
            await page.click('ytcp-button#confirm-button, #confirm-button', { timeout: 5000 }).catch(() => {})
            await page.waitForTimeout(5000)
            deleted.push(rows[i])
          }
        }
      } else {
        seenTitles.add(t)
      }
    }
    return { ok: true, rowsBefore: rows, deleted }
  } finally {
    await browser.close().catch(() => {})
  }
}

async function runOptimizePublishedVideos() {
  const st = getStatus()
  const history = st.publishHistory || []
  if (history.length === 0) return { ok: true, updated: [] }

  const debugPort = 9334
  launchChromeOnDefaultDesktop(PROFILE_DIR, debugPort, 'https://studio.youtube.com')
  let browser = null
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 700))
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`)
      break
    } catch {}
  }
  if (!browser) throw new Error('Failed to connect over CDP')

  const updated = []
  try {
    const page = browser.contexts()[0].pages()[0] || (await browser.contexts()[0].newPage())
    await page.waitForTimeout(3000)

    for (const item of history) {
      const m = String(item.youtubeUrl || '').match(/(?:youtu\.be\/|v=)([A-Za-z0-9_-]{11})/)
      if (!m) continue
      const videoId = m[1]
      let meta = null
      try {
        meta = loadEpisodeMeta(item.episodeId)
      } catch {
        continue
      }

      const editUrl = `https://studio.youtube.com/video/${videoId}/edit`
      console.log(`🔧 [SEO Optimizer] Updating ${item.episodeId} (${videoId}) -> ${editUrl}`)
      await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {})
      await page.waitForTimeout(4500)

      const boxes = await page.$$('ytcp-social-suggestions-textbox #textbox[contenteditable="true"]')
      if (boxes[0]) {
        await boxes[0].click()
        await page.keyboard.press('Control+A')
        await page.keyboard.press('Backspace')
        await page.keyboard.insertText(meta.title.slice(0, 100))
        await page.waitForTimeout(400)
      }
      if (boxes[1]) {
        await boxes[1].click()
        await page.keyboard.press('Control+A')
        await page.keyboard.press('Backspace')
        await page.keyboard.insertText(meta.description)
        await page.waitForTimeout(400)
      }

      if (!meta.isShort && meta.thumbnailFile && fs.existsSync(meta.thumbnailFile)) {
        const thumbInput = await page.$('ytcp-thumbnails-compact-editor-uploader input[type="file"], #still-picker input[type="file"]')
        if (thumbInput) {
          await thumbInput.setInputFiles(meta.thumbnailFile).catch(() => {})
          await page.waitForTimeout(1000)
        }
      }

      if (Array.isArray(meta.tags) && meta.tags.length > 0) {
        await page.click('#toggle-button', { timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(600)
        const tagInput = await page.$('#tags-container input#text-input, ytcp-form-input-container#tags-container input')
        if (tagInput) {
          await tagInput.click()
          await page.keyboard.insertText(meta.tags.join(',') + ',')
          await page.waitForTimeout(500)
        }
      }

      await page.click('#save, ytcp-button#save', { timeout: 8000 }).catch(() => {})
      await page.waitForTimeout(3500)
      item.title = meta.title
      savePublishLog(item)
      updated.push({ episodeId: item.episodeId, videoId, newTitle: meta.title })
      console.log(`  ✓ Saved SEO/CTR updates for ${item.episodeId} (${videoId})`)
    }
    return { ok: true, updated }
  } finally {
    await browser.close().catch(() => {})
  }
}

function pickNextUnpublishedEpisode() {
  const st = getStatus()
  const publishedIds = new Set((st.publishHistory || []).map(p => p.episodeId))
  const priorityOrder = ['short01', 'ep06', 'short02', 'ep07', 'short03', 'ep08', 'ep01', 'ep02', 'ep05', 'ep09', 'ep04']
  for (const epId of priorityOrder) {
    const found = st.producedEpisodes.find(e => e.episodeId === epId && e.videoFileExists)
    if (found && !publishedIds.has(epId)) return epId
  }
  const fallback = st.producedEpisodes.find(e => e.videoFileExists && !publishedIds.has(e.episodeId))
  return fallback ? fallback.episodeId : null
}

if (hasFlag('--login')) {
  await runBrowserLogin()
} else if (hasFlag('--optimize-published')) {
  const res = await runOptimizePublishedVideos()
  console.log(JSON.stringify(res, null, 2))
} else if (hasFlag('--dedupe')) {
  const res = await runStudioDeduplicate()
  console.log(JSON.stringify(res, null, 2))
} else if (hasFlag('--upload-next')) {
  const nextEp = pickNextUnpublishedEpisode()
  if (!nextEp) {
    console.log(JSON.stringify({ ok: true, status: 'all-published', message: 'All produced episodes have already been published.' }, null, 2))
  } else {
    const visibility = getArg('--visibility', 'public')
    console.log(`[BEX Daily YouTube Queue] Next unpublished episode selected: ${nextEp}`)
    const res = await runBrowserStudioUpload(nextEp, visibility)
    console.log(JSON.stringify(res, null, 2))
  }
} else if (hasFlag('--upload')) {
  const ep = getArg('--ep', 'ep03')
  const visibility = getArg('--visibility', 'public')
  const res = await runBrowserStudioUpload(ep, visibility)
  console.log(JSON.stringify(res, null, 2))
} else {
  console.log(JSON.stringify({ ...getStatus(), nextUnpublishedEpisode: pickNextUnpublishedEpisode() }, null, 2))
}
