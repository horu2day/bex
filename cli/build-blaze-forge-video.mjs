#!/usr/bin/env node
/**
 * cli/build-blaze-forge-video.mjs
 * BEX (Vex) Video & Shorts Factory for [프롬프트 아레나 · BLAZE FORGE] (PromptWars 3D)
 *
 * Generates:
 *  1. 16:9 Main YouTube Promo Video: public/demos/youtube/blaze-forge-promo.mp4 (1920x1080)
 *  2. 9:16 Vertical YouTube Short:   public/demos/youtube/short04-blaze-forge.mp4 (1080x1920)
 *  3. High-CTR Custom Thumbnails:    blaze-forge-promo-thumb.png & short04-blaze-forge-thumb.png
 *
 * Pipeline:
 *  Step 1: Procedural 3D Arena Battle Frame Renderer (Pillow / Canvas 3D wireframe + HUD + particle beams)
 *  Step 2: Korean Neural TTS Narration (edge-tts ko-KR-InJoonNeural + word timing)
 *  Step 3: HyperFrames Top VS Card + Burned-in Subtitles
 *  Step 4: FFmpeg -14 LUFS Loudness Normalization & H.264/AAC Encoding
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'public', 'demos', 'youtube')
const WORK_DIR = path.join(ROOT, 'docs', 'video', 'blaze_forge_build')

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.mkdirSync(WORK_DIR, { recursive: true })

const pyBuilder = `
import os, sys, json, math, subprocess, asyncio
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import edge_tts

WORK_DIR = Path(sys.argv[1])
OUT_DIR = Path(sys.argv[2])

VOICE = "ko-KR-InJoonNeural"
RATE = "+10%"

SCENES = [
    {
        "id": "s1",
        "top_tag": "PROMPT ARENA 3D · BLAZE FORGE",
        "vs_left": "PLAYER 1: 초고압 전자기 레일건",
        "vs_right": "PLAYER 2: 45도 플라즈마 거울 방패",
        "sub": "게임 중에 타자 치면 무기가 실시간으로 만들어진다고?",
        "tts": "게임 중에 타자를 치면 상상하는 무기가 실시간 쓰리디로 만들어져서 싸우는 게임이 있습니다.",
        "accent": (250, 204, 21),
        "mode": "railgun_reflect"
    },
    {
        "id": "s2",
        "top_tag": "실시간 프롬프트 창과 방패 대결",
        "vs_left": "PROMPT > 초속 12km 관통 레일건 발사",
        "vs_right": "COUNTER > 45도 각도 전반사 거울 결계",
        "sub": "상대가 레일건을 뽑길래 '45도 거울 방패'를 쳐봤습니다",
        "tts": "상대가 초고압 레일건을 뽑길래 급하게 사십오도 각도의 거울 방패라고 입력했더니, 실제로 빔이 굴절돼서 상대 본진을 타격합니다.",
        "accent": (56, 189, 248),
        "mode": "beam_bounce"
    },
    {
        "id": "s3",
        "top_tag": "마법 프롬프트 vs 현대 과학 병기",
        "vs_left": "MAGIC > 심연의 화염 운석 낙하 (지름 50m)",
        "vs_right": "SCIENCE > 대기권 요격 미사일 + 액체질소 돔",
        "sub": "판타지 마법 vs 현대 과학 병기, 물리 엔진의 판정은?",
        "tts": "정해진 무기 프리셋 없이 판타지 마법과 현대 과학 병기가 같은 쓰리디 물리 아레나에서 격돌합니다. 화염 운석을 대기권 요격 미사일과 액체질소로 공중에서 얼려 폭파시킬 수 있습니다.",
        "accent": (244, 63, 94),
        "mode": "meteor_intercept"
    },
    {
        "id": "s4",
        "top_tag": "설치 없는 웹 3D 멀티플레이 아레나",
        "vs_left": "1:1 실시간 매칭 & AI 무기 연성",
        "vs_right": "댓글로 최강의 무기 프롬프트를 남겨주세요!",
        "sub": "절대 못 막을 것 같은 무기 프롬프트, 댓글로 도전하세요!",
        "tts": "설치 없이 브라우저에서 바로 접속해 싸우는 프롬프트 아레나 블레이즈 포지. 여러분이 생각하는 절대 못 막는 무기 프롬프트를 댓글로 남겨주세요!",
        "accent": (52, 211, 153),
        "mode": "finale"
    }
]

def get_font(size, bold=True):
    candidates = [
        "C:/Windows/Fonts/malgunbd.ttf" if bold else "C:/Windows/Fonts/malgun.ttf",
        "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()

async def synth_all():
    for sc in SCENES:
        mp3 = WORK_DIR / f"{sc['id']}.mp3"
        comm = edge_tts.Communicate(sc["tts"], VOICE, rate=RATE)
        await comm.save(str(mp3))

def probe_dur(path):
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path)
    ], text=True).strip()
    return float(out)

def draw_arena_scene(W, H, sc, is_vertical=False):
    img = Image.new("RGB", (W, H), (8, 12, 24))
    dr = ImageDraw.Draw(img)

    # Background perspective grid (3D arena floor)
    horizon_y = int(H * (0.48 if is_vertical else 0.45))
    # Sky glow
    for y in range(horizon_y):
        t = y / max(1, horizon_y)
        r = int(8 + 18 * t)
        g = int(12 + 24 * t)
        b = int(28 + 48 * t)
        dr.line([(0, y), (W, y)], fill=(r, g, b))

    # Floor perspective grid
    cx = W // 2
    for i in range(-12, 13):
        x_top = cx + i * int(W * 0.03)
        x_bot = cx + i * int(W * 0.14)
        dr.line([(x_top, horizon_y), (x_bot, H)], fill=(25, 45, 78), width=2)
    for j in range(1, 12):
        t = (j / 11.0) ** 1.7
        y = int(horizon_y + (H - horizon_y) * t)
        dr.line([(0, y), (W, y)], fill=(25, 45, 78), width=2)

    acc = sc["accent"]

    # Draw 3D Arena Combat Entities in center
    mid_y = int(H * (0.50 if is_vertical else 0.52))
    left_x = int(W * (0.24 if is_vertical else 0.26))
    right_x = int(W * (0.76 if is_vertical else 0.74))

    # Left Player Mech / Forge Node
    dr.ellipse([left_x-70, mid_y-70, left_x+70, mid_y+70], outline=(56, 189, 248), width=5, fill=(14, 32, 64))
    dr.rectangle([left_x-40, mid_y-22, left_x+85, mid_y+22], fill=(30, 64, 125), outline=(56, 189, 248), width=4)

    # Right Player Shield / Counter Node
    dr.ellipse([right_x-70, mid_y-70, right_x+70, mid_y+70], outline=(244, 63, 94), width=5, fill=(58, 16, 32))

    if sc["mode"] in ("railgun_reflect", "beam_bounce"):
        # Laser beam from left to mirror at center, bouncing up-left
        mirror_x, mirror_y = cx + 40, mid_y
        dr.line([( mirror_x - 55, mirror_y - 85 ), ( mirror_x + 55, mirror_y + 85 )], fill=(125, 211, 252), width=10)
        dr.line([(left_x + 85, mid_y), (mirror_x, mirror_y)], fill=(250, 204, 21), width=12)
        dr.line([(mirror_x, mirror_y), (left_x + 20, mid_y - 190)], fill=(250, 204, 21), width=10)
        dr.ellipse([mirror_x-28, mirror_y-28, mirror_x+28, mirror_y+28], fill=(254, 240, 138))
    elif sc["mode"] == "meteor_intercept":
        # Giant fiery meteor from top-left vs cryo intercept missile from bottom-right
        mx, my = cx - 60, mid_y - 90
        dr.ellipse([mx-85, my-85, mx+85, my+85], fill=(220, 38, 38), outline=(251, 146, 60), width=8)
        dr.line([(right_x - 50, mid_y), (mx + 30, my + 30)], fill=(56, 189, 248), width=10)
        dr.ellipse([mx-45, my-45, mx+95, my+95], outline=(165, 243, 252), width=6)
    else:
        # Energy clash at center
        dr.line([(left_x + 80, mid_y), (cx, mid_y)], fill=(56, 189, 248), width=14)
        dr.line([(right_x - 80, mid_y), (cx, mid_y)], fill=(244, 63, 94), width=14)
        dr.ellipse([cx-65, mid_y-65, cx+65, mid_y+65], fill=(250, 204, 21), outline=(255, 255, 255), width=6)

    # Top Header Card (HyperFrames style)
    f_tag = get_font(34 if is_vertical else 30, True)
    f_vs = get_font(32 if is_vertical else 28, True)
    f_sub = get_font(44 if is_vertical else 42, True)

    pad = 40
    dr.rounded_rectangle([pad, 40, W - pad, 290 if is_vertical else 220], radius=24, fill=(15, 23, 42), outline=acc, width=4)
    dr.text((pad + 30, 62), sc["top_tag"], font=f_tag, fill=acc)

    if is_vertical:
        dr.text((pad + 30, 125), sc["vs_left"], font=f_vs, fill=(125, 211, 252))
        dr.text((pad + 30, 185), sc["vs_right"], font=f_vs, fill=(253, 164, 175))
    else:
        dr.text((pad + 30, 130), sc["vs_left"], font=f_vs, fill=(125, 211, 252))
        dr.text((cx + 20, 130), sc["vs_right"], font=f_vs, fill=(253, 164, 175))

    # Bottom Subtitle Box
    sub_top = H - (340 if is_vertical else 190)
    sub_bot = H - (140 if is_vertical else 50)
    dr.rounded_rectangle([pad, sub_top, W - pad, sub_bot], radius=22, fill=(9, 13, 22), outline=acc, width=3)

    bbox = dr.textbbox((0, 0), sc["sub"], font=f_sub)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = max(pad + 20, (W - tw) // 2)
    ty = sub_top + ((sub_bot - sub_top) - th) // 2 - 4
    dr.text((tx, ty), sc["sub"], font=f_sub, fill=(255, 255, 255))

    return img

def render_video(W, H, is_vertical, out_mp4, out_thumb):
    segs = []
    for idx, sc in enumerate(SCENES):
        img = draw_arena_scene(W, H, sc, is_vertical)
        img_path = WORK_DIR / f"frame_{'v' if is_vertical else 'h'}_{sc['id']}.png"
        img.save(img_path)
        if idx == 0:
            img.save(out_thumb)

        mp3_path = WORK_DIR / f"{sc['id']}.mp3"
        dur = probe_dur(mp3_path) + 0.35
        seg_mp4 = WORK_DIR / f"seg_{'v' if is_vertical else 'h'}_{sc['id']}.mp4"
        subprocess.run([
            "ffmpeg", "-y",
            "-loop", "1", "-t", f"{dur:.2f}", "-i", str(img_path),
            "-i", str(mp3_path),
            "-filter_complex", "[1:a]loudnorm=I=-14:TP=-1.5:LRA=11,apad=pad_dur=0.35[a]",
            "-map", "0:v", "-map", "[a]",
            "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30",
            "-c:a", "aac", "-b:a", "192k", "-ar", "44100",
            "-shortest", str(seg_mp4)
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        segs.append(seg_mp4)

    concat_txt = WORK_DIR / f"concat_{'v' if is_vertical else 'h'}.txt"
    concat_txt.write_text("\\n".join([f"file '{s.as_posix()}'" for s in segs]), encoding="utf-8")
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_txt),
        "-c", "copy", "-movflags", "+faststart", str(out_mp4)
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("Rendered:", out_mp4, f"({probe_dur(out_mp4):.1f}s)")

asyncio.run(synth_all())
render_video(1920, 1080, False, OUT_DIR / "blaze-forge-promo.mp4", OUT_DIR / "blaze-forge-promo-thumb.png")
render_video(1080, 1920, True, OUT_DIR / "short04-blaze-forge.mp4", OUT_DIR / "short04-blaze-forge-thumb.png")
`

const pyFile = path.join(WORK_DIR, 'render_blaze_forge.py')
fs.writeFileSync(pyFile, pyBuilder, 'utf8')
const pyExe = fs.existsSync(path.join(ROOT, '.venv', 'Scripts', 'python.exe'))
  ? path.join(ROOT, '.venv', 'Scripts', 'python.exe')
  : 'python'

console.log('[BEX Blaze Forge] Rendering 16:9 Promo + 9:16 Short...')
execFileSync(pyExe, [pyFile, WORK_DIR, OUT_DIR], { stdio: 'inherit' })

const ep10Meta = {
  episodeId: 'ep10',
  isShort: false,
  title: '프롬프트 치면 실시간 3D 무기가 생성되는 웹 대전 게임 [프롬프트 아레나 · BLAZE FORGE]',
  description: [
    '정해진 무기 프리셋 없이 상상하는 모든 무기·방어구·마법·과학 병기를 프롬프트로 실시간 연성해 싸우는 1:1 웹 3D 멀티플레이 대전 게임 [프롬프트 아레나 · BLAZE FORGE] 공식 시연 영상입니다.',
    '',
    '▶ 주요 대결 장면',
    '00:00 실시간 프롬프트 3D 무기 연성 시스템',
    '00:09 초고압 레일건 vs 45도 플라즈마 거울 방패 (궤적 전반사)',
    '00:20 심연의 화염 운석 낙하 vs 대기권 요격 미사일 + 액체질소 돔',
    '00:32 댓글 프롬프트 챌린지 안내',
    '',
    '💬 여러분이 생각하는 "절대 막을 수 없는 최강의 무기 프롬프트"를 댓글로 남겨주세요!',
    '',
    '#프롬프트아레나 #BlazeForge #PromptWars #웹3D게임 #AI게임 #인디게임 #ThreeJS',
  ].join('\n'),
  tags: [
    '프롬프트 아레나',
    'Blaze Forge',
    'Prompt Arena 3D',
    'PromptWars',
    'AI 게임',
    '웹 3D 게임',
    '프롬프트 게임',
    '인디게임 개발',
    'Three.js 게임',
    '실시간 멀티플레이 게임',
  ],
  durationSeconds: 42,
  durationFormatted: '00:42',
  videoFile: path.join(OUT_DIR, 'blaze-forge-promo.mp4'),
  thumbnailFile: path.join(OUT_DIR, 'blaze-forge-promo-thumb.png'),
}

const short04Meta = {
  episodeId: 'short04',
  isShort: true,
  title: '게임 중에 타자 치면 무기가 실시간 생성된다고? ㅋㅋ [프롬프트 아레나 · BLAZE FORGE] #Shorts',
  description: [
    '상대가 초고압 레일건을 뽑길래 급하게 "45도 거울 방패"라고 쳤더니 진짜 빔이 굴절돼서 상대 본진 맞고 끝남 ㅋㅋ',
    '마법 프롬프트 vs 현대 과학 병기 실시간 3D 물리 대전 [프롬프트 아레나 · BLAZE FORGE]',
    '',
    '댓글로 절대 못 막을 것 같은 무기 프롬프트 적어주시면 다음 영상에서 직접 실험해 봅니다!',
    '',
    '#Shorts #프롬프트아레나 #BlazeForge #PromptWars #AI게임 #웹게임 #인디게임',
  ].join('\n'),
  tags: [
    'Shorts',
    '프롬프트 아레나',
    'Blaze Forge',
    'PromptWars',
    'AI 게임',
    '웹 3D 게임',
    '인디게임',
  ],
  durationSeconds: 42,
  durationFormatted: '00:42',
  videoFile: path.join(OUT_DIR, 'short04-blaze-forge.mp4'),
  thumbnailFile: path.join(OUT_DIR, 'short04-blaze-forge-thumb.png'),
}

fs.writeFileSync(path.join(OUT_DIR, 'ep10-metadata.json'), JSON.stringify(ep10Meta, null, 2), 'utf8')
fs.writeFileSync(path.join(OUT_DIR, 'short04-metadata.json'), JSON.stringify(short04Meta, null, 2), 'utf8')
console.log('[BEX Blaze Forge] Wrote ep10-metadata.json & short04-metadata.json!')

