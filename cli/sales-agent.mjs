#!/usr/bin/env node
/**
 * sales-agent.mjs — Stage-Aware Growth, Customer Discovery & Consultative Sales Agent
 * for Parametric Studio (modelerbase) & Bimer Ecosystem.
 *
 * Zero external npm dependencies (uses node:http, node:fs, node:path, node:readline).
 *
 * Funnel Stages (Autonomous Decision Engine):
 *   1. ATTRACT  (인지·집객)      : --campaign [ARCH|STRUCT|MEP|INFRA]
 *   2. TARGET   (타겟 발굴·도달)  : --outreach "<prospect pain point / profile>"
 *   3. DISCOVER (니즈 진단)      : --consult "<customer message>" [--lead <id>]
 *   4. PROVE    (실시간 3D 입증)  : --consult "<spec with dimensions>" [--lead <id>] [--prove-bridge]
 *   5. CLOSE    (전환·Bimer연동) : --consult "<contact/onboarding intent>" [--lead <id>]
 *   CRM Analytics               : --pipeline
 *   HTTP Server + Bridge        : --serve (default port SALES_PORT=8766)
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

// Load .env from repo root (real env vars win)
try {
  const envPath = path.join(ROOT, '.env')
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m || line.trim().startsWith('#')) continue
    const val = m[2].replace(/^["']|["']$/g, '')
    if (!(m[1] in process.env)) process.env[m[1]] = val
  }
} catch { /* no .env */ }

const PORT = Number(process.env.SALES_PORT || 8766)
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://modelerbase.pages.dev'
const CRM_PATH = process.env.SALES_CRM_PATH
  ? path.resolve(process.env.SALES_CRM_PATH)
  : path.join(HERE, 'data', 'leads.json')
const VOC_PATH = process.env.SALES_VOC_PATH
  ? path.resolve(process.env.SALES_VOC_PATH)
  : path.join(HERE, 'data', 'voc.json')
const BEX_WEBHOOK_URL = process.env.BEX_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || ''

const LLM_URL = process.env.LLM_URL || 'https://api.x.ai/v1/chat/completions'
const LLM_KEY = process.env.LLM_API_KEY || process.env.XAI_API_KEY || ''
const LLM_MODEL = process.env.LLM_MODEL || process.env.GROK_MODEL || 'grok-4'
const IS_LOCAL_LLM = /^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(LLM_URL)
const KEY_IS_PLACEHOLDER = LLM_KEY !== '' && !/^[\x21-\x7e]+$/.test(LLM_KEY)
const LLM_READY = (Boolean(LLM_KEY) && !KEY_IS_PLACEHOLDER) || IS_LOCAL_LLM

// ── Domain Thesaurus & Discipline Mapping (synced with SalesAgentCore.ts) ──

const CATEGORY_DISCIPLINE = {
  'Structural Columns': 'STRUCT',
  'Structural Framing': 'STRUCT',
  'Structural Foundations': 'STRUCT',
  'Structural Trusses': 'STRUCT',
  'Structural Beam Systems': 'STRUCT',
  'Structural Connections': 'STRUCT',
  'Structural Stiffeners': 'STRUCT',
  'Structural Rebar': 'STRUCT',
  'Structural Rebar Couplers': 'STRUCT',
  'Structural Tendons': 'STRUCT',
  'Temporary Structures': 'STRUCT',
  'Bearings': 'STRUCT',
  'Expansion Joints': 'STRUCT',
  'Bridge Cables': 'STRUCT',
  'Vibration Management': 'STRUCT',
  'Mechanical Equipment': 'MEP',
  'Ducts': 'MEP',
  'Duct Fittings': 'MEP',
  'Duct Accessories': 'MEP',
  'Flex Ducts': 'MEP',
  'Air Terminals': 'MEP',
  'Pipes': 'MEP',
  'Pipe Fittings': 'MEP',
  'Pipe Accessories': 'MEP',
  'Flex Pipes': 'MEP',
  'Plumbing Fixtures': 'MEP',
  'Sprinklers': 'MEP',
  'Fire Protection': 'MEP',
  'Electrical Equipment': 'MEP',
  'Electrical Fixtures': 'MEP',
  'Lighting Fixtures': 'MEP',
  'Lighting Devices': 'MEP',
  'Cable Trays': 'MEP',
  'Cable Tray Fittings': 'MEP',
  'Conduits': 'MEP',
  'Conduit Fittings': 'MEP',
  'Fire Alarm Devices': 'MEP',
  'Data Devices': 'MEP',
  'Communication Devices': 'MEP',
  'Security Devices': 'MEP',
  'Nurse Call Devices': 'MEP',
  'Telephone Devices': 'MEP',
  'Spaces': 'MEP',
  'Bridge Superstructure': 'INFRA',
  'Bridge Substructure': 'INFRA',
  'Culverts': 'INFRA',
  'Earthworks / Retaining': 'INFRA',
  'Road Furniture': 'INFRA',
  'Tunnels': 'INFRA',
  'Rail': 'INFRA',
  'Drainage': 'INFRA',
  'Marine': 'INFRA',
  'Utilities': 'INFRA',
  'Topography': 'INFRA',
  'Hardscape': 'INFRA',
  'Parking': 'INFRA',
}

function inferDisciplineFromCategory(category, source) {
  if (CATEGORY_DISCIPLINE[category]) return CATEGORY_DISCIPLINE[category]
  if (source === 'infra') return 'INFRA'
  const c = String(category || '').toLowerCase()
  if (/struct|truss|rebar|tendon|beam|footing|foundation|bearing|seismic/.test(c)) return 'STRUCT'
  if (/mech|duct|pipe|plumb|sprinkler|elec|light|cable|conduit|alarm|telecom|nurse|security|av|audio/.test(c)) return 'MEP'
  if (/bridge|tunnel|culvert|rail|road|retaining|marine|drainage/.test(c)) return 'INFRA'
  return 'ARCH'
}

const DOMAIN_CONCEPTS = [
  {
    terms: ['철골', '와이드플랜지', 'h형강', 'i형강', 'h-beam', 'i-beam', 'wide flange', 'wide-flange', 'h빔', '철골기둥', 'steel column'],
    categories: ['Structural Columns'],
    codePrefixes: ['S01', 'F06'],
    discipline: 'STRUCT',
    weight: 36,
  },
  {
    terms: ['각관', 'hss', 'hollow', '강관', '중공기둥'],
    categories: ['Structural Columns'],
    codePrefixes: ['S02', 'F06'],
    discipline: 'STRUCT',
    weight: 34,
  },
  {
    terms: ['기둥', '칼럼', '컬럼', 'column', 'pillar'],
    categories: ['Structural Columns', 'Columns'],
    codePrefixes: ['S01', 'P01', 'P02', 'F01', 'F02'],
    discipline: 'STRUCT',
    weight: 24,
  },
  {
    terms: ['철골보', 'h형강보', '거더', '빔', 'beam', 'framing', '린텔', '퍼린', 'purlin', 'c형강', 'c-channel'],
    categories: ['Structural Framing', 'Structural Beam Systems'],
    codePrefixes: ['S03', 'S04', 'S06', 'G01', 'G02'],
    discipline: 'STRUCT',
    weight: 28,
  },
  {
    terms: ['트러스', 'truss', '와렌', 'warren'],
    categories: ['Structural Trusses'],
    codePrefixes: ['S05'],
    discipline: 'STRUCT',
    weight: 36,
  },
  {
    terms: ['기초', '푸팅', '독립기초', '줄기초', '파일캡', '매트기초', 'footing', 'foundation', 'pile cap'],
    categories: ['Structural Foundations'],
    codePrefixes: ['H01', 'H02', 'H03', 'H04', 'H05'],
    discipline: 'STRUCT',
    weight: 28,
  },
  {
    terms: ['접합부', '베이스플레이트', '스티프너', '철근', '커플러', '텐던', '면진', '받침', '신축이음', '가설', 'base plate', 'stiffener', 'rebar', 'coupler', 'tendon', 'isolator', 'bearing', 'shoring'],
    categories: ['Structural Connections', 'Structural Stiffeners', 'Structural Rebar', 'Structural Rebar Couplers', 'Structural Tendons', 'Vibration Management', 'Bearings', 'Expansion Joints', 'Temporary Structures'],
    codePrefixes: ['S07', 'S08', 'S09', 'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16'],
    discipline: 'STRUCT',
    weight: 30,
  },
  {
    terms: ['사장교', '주탑', 'h형주탑', 'pylon', 'cable stayed', 'cable-stayed'],
    categories: ['Bridge Substructure'],
    codePrefixes: ['IFC-B10', 'IFC-B06'],
    discipline: 'INFRA',
    weight: 42,
  },
  {
    terms: ['강박스', '강박스거더', '스틸박스', 'steel box girder', 'steel-box'],
    categories: ['Bridge Superstructure'],
    codePrefixes: ['IFC-B11', 'IFC-B02'],
    discipline: 'INFRA',
    weight: 40,
  },
  {
    terms: ['라멘교', 'rc라멘', '문형라멘', '우각부', '헌치', 'rahmen', 'portal frame'],
    categories: ['Bridge Superstructure'],
    codePrefixes: ['IFC-B12', 'IFC-B03'],
    discipline: 'INFRA',
    weight: 40,
  },
  {
    terms: ['교량', 'i거더', 'i-거더', 't거더', '박스거더', 'psc', '교각', '교대', '상부공', '하부공', '슬래브교', 'bridge', 'girder', 'pier', 'abutment'],
    categories: ['Bridge Superstructure', 'Bridge Substructure', 'Bridge Cables'],
    codePrefixes: ['IFC-B01', 'IFC-B02', 'IFC-B03', 'IFC-B04', 'IFC-B05', 'IFC-B06', 'IFC-B07', 'IFC-B08', 'IFC-B10', 'IFC-B11', 'IFC-B12', 'S15'],
    discipline: 'INFRA',
    weight: 36,
  },
  {
    terms: ['마제형', '마제형터널', 'natm', '터널라이닝', '터널갱문', '벨마우스', '갱문', '세그먼트', '터널', 'tunnel', 'bellmouth', 'portal'],
    categories: ['Tunnels'],
    codePrefixes: ['IFC-T01', 'IFC-T02', 'IFC-S01', 'IFC-S02'],
    discipline: 'INFRA',
    weight: 38,
  },
  {
    terms: ['문형표지판', '도로표지판', '갠트리', '통과높이', 'gantry', 'overhead sign'],
    categories: ['Road Furniture'],
    codePrefixes: ['IFC-R07', 'IFC-R04'],
    discipline: 'INFRA',
    weight: 38,
  },
  {
    terms: ['테트라포드', '소파블록', '방파제블록', 'tetrapod', 'ttp', 'armor unit'],
    categories: ['Marine'],
    codePrefixes: ['IFC-M03', 'IFC-M01'],
    discipline: 'INFRA',
    weight: 42,
  },
  {
    terms: ['케이슨', '멀티격실', '항만케이슨', '계선주', '볼라드', '방충재', '고무방충재', '상치콘크리트', '파라펫', '월파방지', '차막이', '안벽', '잔교', '항만', '해양', 'caisson', 'bollard', 'fender', 'parapet', 'wheel stopper', 'quay', 'marine', 'port'],
    categories: ['Marine'],
    codePrefixes: ['IFC-M04', 'IFC-M05', 'IFC-M06', 'IFC-M07', 'IFC-M08', 'IFC-M01', 'IFC-M02', 'IFC-M03'],
    discipline: 'INFRA',
    weight: 38,
  },
  {
    terms: ['레일', '철도레일', '50kgn', '60kg', '60kgk', '전차선', '전차선주', '가동브래킷', '콘크리트도상', '슬래브궤도', '철도교', '철도박스거더', '침목', '궤도', '철도', 'rail', 'catenary', 'slab track', 'sleeper', 'railway'],
    categories: ['Rail'],
    codePrefixes: ['IFC-S03', 'IFC-S04', 'IFC-S05', 'IFC-S06', 'IFC-S02'],
    discipline: 'INFRA',
    weight: 38,
  },
  {
    terms: ['조립식맨홀', '원형맨홀', '맨홀', '흄관', '원심력철근콘크리트관', 'pc암거', '프리캐스트암거', '제수밸브실', '밸브실', '이토변실', '상하수도', '하수관', '상수관', 'manhole', 'hume pipe', 'valve chamber', 'waterworks', 'sewer'],
    categories: ['Drainage', 'Utilities', 'Culverts'],
    codePrefixes: ['IFC-W01', 'IFC-W02', 'IFC-W03', 'IFC-W04', 'IFC-U01', 'IFC-D01'],
    discipline: 'INFRA',
    weight: 38,
  },
  {
    terms: ['암거', '박스암거', '관암거', '옹벽', '캔틸레버옹벽', '중력식옹벽', '방호벽', '가드레일', '배수로', 'culvert', 'retaining', 'barrier', 'drainage'],
    categories: ['Culverts', 'Earthworks / Retaining', 'Road Furniture', 'Drainage'],
    codePrefixes: ['IFC-C01', 'IFC-C02', 'IFC-C03', 'IFC-C04', 'IFC-R01', 'IFC-R02', 'IFC-R03', 'IFC-D01', 'IFC-W03'],
    discipline: 'INFRA',
    weight: 34,
  },
  {
    terms: ['공조기', 'ahu', 'air handling', '칠러', '냉동기', 'chiller', '보일러', 'boiler', 'vav', '기계장비', '공조', 'hvac'],
    categories: ['Mechanical Equipment'],
    codePrefixes: ['T01', 'T02', 'T03', 'T04'],
    discipline: 'MEP',
    weight: 36,
  },
  {
    terms: ['덕트', '엘보', '레듀서', '댐퍼', '플렉시블덕트', '디퓨저', 'duct', 'elbow', 'reducer', 'damper', 'air terminal'],
    categories: ['Duct Fittings', 'Duct Accessories', 'Flex Ducts', 'Ducts', 'Air Terminals'],
    codePrefixes: ['T05', 'T06', 'T07', 'T08', 'L02', 'L04', 'L07'],
    discipline: 'MEP',
    weight: 30,
  },
  {
    terms: ['배관', '파이프', '밸브', '게이트밸브', '플랜지', '스프링클러', '위생기구', '양변기', '세면기', '욕조', '소방', '옥내소화전', 'pipe', 'valve', 'flange', 'sprinkler', 'plumbing', 'lavatory', 'water closet', 'bathtub', 'fire'],
    categories: ['Pipe Fittings', 'Pipe Accessories', 'Flex Pipes', 'Plumbing Fixtures', 'Sprinklers', 'Fire Protection', 'Pipes'],
    codePrefixes: ['T09', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'Q15', 'L01', 'L05', 'L08'],
    discipline: 'MEP',
    weight: 30,
  },
  {
    terms: ['수배전반', '배전반', '분전반', '변압기', '트랜스포머', 'switchgear', 'transformer', '전기장비'],
    categories: ['Electrical Equipment'],
    codePrefixes: ['U01', 'U02', 'L10'],
    discipline: 'MEP',
    weight: 38,
  },
  {
    terms: ['케이블트레이', '전선관', '정션박스', '조명', '등기구', '콘센트', '스위치', '감지기', '와이파이', 'cctv', '인터폰', '너스콜', '전기', '통신', 'cable tray', 'conduit', 'troffer', 'lighting', 'receptacle', 'smoke detector', 'wifi', 'electrical'],
    categories: ['Electrical Fixtures', 'Lighting Fixtures', 'Lighting Devices', 'Cable Tray Fittings', 'Conduit Fittings', 'Fire Alarm Devices', 'Data Devices', 'Communication Devices', 'Security Devices', 'Nurse Call Devices', 'Telephone Devices', 'Cable Trays', 'Conduits'],
    codePrefixes: ['U03', 'U04', 'U05', 'U06', 'U07', 'U08', 'U09', 'U10', 'U11', 'U12', 'U13', 'L03', 'L06', 'L09'],
    discipline: 'MEP',
    weight: 28,
  },
  {
    terms: ['커튼월', '멀리언', '파사드', 'curtain wall', 'mullion', 'curtain system', 'storefront'],
    categories: ['Curtain Wall Mullions', 'Curtain Systems', 'Curtain Panels'],
    codePrefixes: ['P03', 'P04', 'P05', 'J03', 'J08'],
    discipline: 'ARCH',
    weight: 36,
  },
  {
    terms: ['창문', '창호', '여닫이', '여닫이창', '천창', '스카이라이트', '방화문', '미서기문', '슬라이딩도어', '도어', 'window', 'casement', 'skylight', 'door', 'sliding door'],
    categories: ['Windows', 'Doors'],
    codePrefixes: ['P11', 'P12', 'P09', 'P10', 'J01', 'J02', 'J04', 'J05', 'J06', 'J07'],
    discipline: 'ARCH',
    weight: 34,
  },
  {
    terms: ['가구', '책상', '데스크', '테이블', '의자', '소파', '침대', '책장', '선반', '캐비닛', '하부장', '상부장', '세면대', '싱크대', '파티션', '워크스테이션', '주방', '후드', '엘리베이터', '계단', '경사로', '난간', '벽체', '바닥', '슬래브', '지붕', '천장', 'furniture', 'desk', 'table', 'chair', 'sofa', 'cabinet', 'casework', 'vanity', 'elevator', 'stair', 'ramp', 'railing', 'baluster', 'wall', 'floor', 'roof', 'ceiling'],
    categories: ['Furniture', 'Furniture Systems', 'Casework', 'Food Service Equipment', 'Medical Equipment', 'Vertical Circulation', 'Stairs', 'Ramps', 'Railings', 'Balusters', 'Walls', 'Floors', 'Roofs', 'Ceilings'],
    codePrefixes: ['P08', 'P06', 'P07', 'Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07', 'Q08', 'Q09', 'Q10', 'Q11', 'Q16', 'K01', 'K02', 'K03', 'K04', 'D01', 'C01', 'M01'],
    discipline: 'ARCH',
    weight: 24,
  },
]

const PAIN_PATTERNS = [
  { code: 'slow_authoring', re: /(시간이?\s*많이|시간이?\s*너무|오래\s*걸|느리|느려|반복\s*작업|수작업|일일이|매번\s*새로|납기|속도|빠르게|time\s*consuming|too\s*slow|manual|tedious|hours\s*to\s*build)/i },
  { code: 'license_cost', re: /(라이선스|라이센스|구독료|비용|비싸|무겁|무거운|설치|용량|사양|데스크톱|뷰어|레빗\s*없이|revit\s*없이|expensive|license|heavy|install|without\s*revit|browser\s*only)/i },
  { code: 'type_variation', re: /(타입|규격|사이즈|치수\s*변형|치수\s*변경|카탈로그|패밀리\s*테이블|수식|파라미터|매개변수|유연|flex|type\s*catalog|multi-size|parametric\s*variation|formula|eq)/i },
  { code: 'web_collaboration', re: /(웹|브라우저|링크|공유|협업|클라우드|원격|발주처|제조사\s*카탈로그|설치\s*없이|web|browser|share|link|cloud|collaborat)/i },
  { code: 'bimer_host_migration', re: /(bimer|비머|호스트|프로젝트\s*배치|전체\s*건물|통합\s*설계|bim\s*전환|레빗\s*대체|revit\s*alternative|host\s*model|project\s*placement)/i },
  { code: 'ai_automation', re: /(ai|인공지능|프롬프트|자동\s*생성|자연어|채팅|에이전트|자동화|vibe|copilot|prompt|natural\s*language)/i },
]

const TOOL_PATTERNS = [
  { name: 'Revit', re: /(revit|레빗)/i },
  { name: 'AutoCAD', re: /(autocad|오토캐드|2d\s*cad|dwg)/i },
  { name: 'Civil3D', re: /(civil\s*3d|시빌\s*3d|시빌)/i },
  { name: 'Rhino/Grasshopper', re: /(rhino|grasshopper|라이노|그래스호퍼)/i },
  { name: 'Tekla', re: /(tekla|테클라)/i },
  { name: 'SketchUp', re: /(sketchup|스케치업)/i },
  { name: 'Inventor/SolidWorks', re: /(inventor|solidworks|인벤터|솔리드웍스)/i },
]

// ── Disk Catalog Indexer (205 .pmodel families) ───────────────────────────

let cachedCatalog = null
let cachedRawPModel = null

function loadCatalogFromDisk() {
  if (cachedCatalog && cachedRawPModel) {
    return { catalog: cachedCatalog, rawByFile: cachedRawPModel }
  }
  const items = []
  const rawByFile = {}
  const famRoot = path.join(ROOT, 'samples', 'families')

  const readPModelMeta = (relFile, customRoot = famRoot) => {
    const abs = path.join(customRoot, relFile)
    try {
      const raw = fs.readFileSync(abs, 'utf8')
      rawByFile[relFile] = raw
      rawByFile[relFile.replace(/\.pmodel$/, '')] = raw
      const parsed = JSON.parse(raw)
      return {
        parameters: Array.isArray(parsed.parameters) ? parsed.parameters : [],
        typeDetails: Array.isArray(parsed.types) ? parsed.types : [],
        typeNames: Array.isArray(parsed.types) ? parsed.types.map(t => t.name) : [],
      }
    } catch {
      return { parameters: [], typeDetails: [], typeNames: [] }
    }
  }

  // 1. builtin/catalog.json (167 families)
  try {
    const builtinCat = JSON.parse(fs.readFileSync(path.join(famRoot, 'builtin', 'catalog.json'), 'utf8'))
    const byFile = new Map()
    for (const f of builtinCat.families || []) {
      byFile.set(f.file, f)
    }
    for (const [category, files] of Object.entries(builtinCat.categories || {})) {
      for (const file of files) {
        const meta = byFile.get(file) || {}
        const pmeta = readPModelMeta(file)
        const id = file.replace(/\.pmodel$/, '')
        items.push({
          id,
          file,
          title: meta.title || id.split('/').pop(),
          category,
          source: 'builtin',
          discipline: inferDisciplineFromCategory(category, 'builtin'),
          revitAnalog: meta.revitAnalog,
          geometry: meta.geometry,
          types: pmeta.typeNames.length ? pmeta.typeNames : (meta.types || []),
          typeDetails: pmeta.typeDetails,
          parameters: pmeta.parameters,
        })
      }
    }
  } catch (err) {
    console.warn('[sales-agent] warning loading builtin catalog:', err.message)
  }

  // 2. infra/catalog.json (33 families)
  try {
    const infraCat = JSON.parse(fs.readFileSync(path.join(famRoot, 'infra', 'catalog.json'), 'utf8'))
    for (const f of infraCat.families || []) {
      const pmeta = readPModelMeta(f.file)
      const id = f.file.replace(/\.pmodel$/, '')
      items.push({
        id,
        file: f.file,
        title: f.title || id.split('/').pop(),
        category: f.category || 'Infrastructure',
        source: 'infra',
        discipline: 'INFRA',
        ifcEntity: f.ifcEntity,
        geometry: f.geometry,
        notes: f.notes,
        types: pmeta.typeNames.length ? pmeta.typeNames : (f.types || []),
        typeDetails: pmeta.typeDetails,
        parameters: pmeta.parameters,
      })
    }
  } catch (err) {
    console.warn('[sales-agent] warning loading infra catalog:', err.message)
  }

  // 3. tutorial/*.pmodel (5 tutorial families in docs/tutorials/families or samples/families/tutorial)
  try {
    const tutDirCandidates = [
      path.join(ROOT, 'docs', 'tutorials', 'families'),
      path.join(famRoot, 'tutorial'),
    ]
    for (const tutDir of tutDirCandidates) {
      if (fs.existsSync(tutDir)) {
        for (const fn of fs.readdirSync(tutDir).filter(x => x.endsWith('.pmodel')).sort()) {
          const pmeta = readPModelMeta(fn, tutDir)
          const id = `tutorial/${fn.replace(/\.pmodel$/, '')}`
          if (items.some(x => x.id === id)) continue
          items.push({
            id,
            file: `${id}.pmodel`,
            title: `Tutorial · ${fn.replace(/\.pmodel$/, '')}`,
            category: 'Tutorials',
            source: 'tutorial',
            discipline: fn.includes('column') ? 'STRUCT' : 'ARCH',
            types: pmeta.typeNames,
            typeDetails: pmeta.typeDetails,
            parameters: pmeta.parameters,
          })
        }
      }
    }
  } catch { /* optional */ }

  cachedCatalog = items
  cachedRawPModel = rawByFile
  return { catalog: items, rawByFile }
}

// ── Core Engine Functions ─────────────────────────────────────────────────

function extractDimensions(text) {
  const out = {}
  const toMm = (valRaw, unitRaw) => {
    const n = Number(valRaw)
    if (!Number.isFinite(n) || n <= 0) return NaN
    const u = String(unitRaw || '').trim().toLowerCase()
    if (u === 'm' || u === '미터') return Math.round(n * 1000)
    if (u === 'cm' || u === '센티') return Math.round(n * 10)
    return Math.round(n * 100) / 100
  }
  const matchDim = (re) => {
    const m = re.exec(text)
    if (!m) return undefined
    const v = toMm(m[1], m[2])
    return Number.isFinite(v) ? v : undefined
  }

  const w = matchDim(/(?:가로|너비|폭|플랜지\s*폭|width|flange\s*width|\bW|\bB)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|미터)?/i)
  if (w !== undefined) out.width = w

  const d = matchDim(/(?:세로|깊이|춤|단면\s*춤|depth|\bD)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|미터)?/i)
  if (d !== undefined) out.depth = d

  const h = matchDim(/(?:높이|층고|고|height|\bH)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|미터)?/i)
  if (h !== undefined) out.height = h

  const l = matchDim(/(?:길이|연장|경간|스팬|length|span|\bL)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|미터)?/i)
  if (l !== undefined) out.length = l

  const t = matchDim(/(?:두께|판두께|벽두께|thickness|\bT)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|미터)?/i)
  if (t !== undefined) out.thickness = t

  const triple = /(\d{2,5})\s*[xX×*]\s*(\d{2,5})\s*[xX×*]\s*(\d{2,5})/.exec(text)
  if (triple) {
    if (out.width === undefined) out.width = Number(triple[1])
    if (out.depth === undefined) out.depth = Number(triple[2])
    if (out.height === undefined) out.height = Number(triple[3])
  } else {
    const pair = /(?:H-?)?(\d{2,5})\s*[xX×*]\s*(\d{2,5})(?!\s*[xX×*\d])/.exec(text)
    if (pair) {
      if (out.width === undefined) out.width = Number(pair[1])
      if (out.depth === undefined) out.depth = Number(pair[2])
    }
  }
  return out
}

function extractCustomerNeeds(text, prior = {}) {
  const lower = String(text || '').toLowerCase()
  const painPoints = new Set(prior.painPoints || [])
  for (const p of PAIN_PATTERNS) {
    if (p.re.test(text)) painPoints.add(p.code)
  }
  const currentTools = new Set(prior.currentTools || [])
  for (const t of TOOL_PATTERNS) {
    if (t.re.test(text)) currentTools.add(t.name)
  }

  const discScore = { ARCH: 0, STRUCT: 0, MEP: 0, INFRA: 0 }
  if (/(건축|인테리어|창호|커튼월|파사드|가구|캐비닛|architect|facade|interior|casework)/i.test(text)) discScore.ARCH += 25
  if (/(구조|철골|RC|철근|기둥|보|트러스|기초|내진|면진|structur|steel|rebar|truss|foundation)/i.test(text)) discScore.STRUCT += 25
  if (/(설비|기계|배관|공조|덕트|전기|조명|소방|스프링클러|통신|mep|hvac|plumbing|electrical|piping)/i.test(text)) discScore.MEP += 25
  if (/(토목|인프라|교량|터널|도로|철도|암거|옹벽|항만|수자원|civil|infra|bridge|tunnel|rail|culvert)/i.test(text)) discScore.INFRA += 25

  const keywords = new Set(prior.keywords || [])
  for (const concept of DOMAIN_CONCEPTS) {
    for (const term of concept.terms) {
      if (lower.includes(term.toLowerCase())) {
        discScore[concept.discipline] += concept.weight
        keywords.add(term)
      }
    }
  }

  let discipline = prior.discipline && prior.discipline !== 'UNKNOWN' ? prior.discipline : 'UNKNOWN'
  const sortedDisc = Object.entries(discScore).sort((a, b) => b[1] - a[1])
  if (sortedDisc[0][1] > 0) discipline = sortedDisc[0][0]

  let teamSize = prior.teamSize ?? null
  const teamMatch = /(?:팀|인원|설계사|엔지니어|직원|명|규모|team\s*of|engineers?)\s*[:is]?\s*(\d{1,4})\s*(?:명|인|people|engineers|members)?|(\d{1,4})\s*(?:명|인)\s*(?:팀|규모|정도|설계|엔지니어)/i.exec(text)
  if (teamMatch) {
    const n = Number(teamMatch[1] ?? teamMatch[2])
    if (Number.isFinite(n) && n > 0) teamSize = n
  }

  let contact = prior.contact
  const emailMatch = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/.exec(text)
  const phoneMatch = /(01[016789][-\s]?\d{3,4}[-\s]?\d{4})/.exec(text)
  if (emailMatch) contact = emailMatch[1]
  else if (phoneMatch) contact = phoneMatch[1]

  let company = prior.company
  const compMatch = /(?:회사|소속|설계사무소|엔지니어링|기업|업체|company)\s*(?:명|이름|은|는|:)?\s*([가-힣A-Za-z0-9()_\-\s]{2,25}?)(?:이고|이며|입니다|에서|소속|,|\.|$)/.exec(text)
  if (compMatch && compMatch[1]?.trim()) company = compMatch[1].trim()

  const newDims = extractDimensions(text)
  const dimensions = { ...(prior.dimensions || {}), ...newDims }

  const bimerInterest =
    Boolean(prior.bimerInterest) ||
    painPoints.has('bimer_host_migration') ||
    /(bimer|비머|프로젝트\s*배치|호스트|전체\s*모델|통합\s*bim)/i.test(text)

  let urgency = prior.urgency || 'low'
  if (/(급합|당장|이번\s*주|이번\s*달|즉시|바로\s*도입|시급|urgent|asap|immediately)/i.test(text)) {
    urgency = 'high'
  } else if (painPoints.size >= 1 || Object.keys(dimensions).length >= 1) {
    if (urgency === 'low') urgency = 'medium'
  }

  return {
    discipline,
    painPoints: [...painPoints],
    keywords: [...keywords],
    dimensions,
    currentTools: [...currentTools],
    teamSize,
    bimerInterest,
    urgency,
    ...(company ? { company } : {}),
    ...(contact ? { contact } : {}),
  }
}

function computeQualificationScore(needs) {
  let score = 0
  if (needs.discipline !== 'UNKNOWN') score += 20
  score += Math.min(25, (needs.painPoints || []).length * 10)
  if ((needs.keywords || []).length > 0) score += 15
  if (Object.keys(needs.dimensions || {}).length > 0) score += 15
  if (needs.teamSize !== null && needs.teamSize > 0) score += 10
  if ((needs.currentTools || []).length > 0) score += 5
  if (needs.bimerInterest) score += 5
  if (needs.contact) score += 10
  if (needs.urgency === 'high') score += 5
  return Math.min(100, score)
}

function mapDimensionsToFamilyParams(dims, familyParams = []) {
  const overrides = {}
  if (!dims || Object.keys(dims).length === 0) return overrides
  if (familyParams.length > 0) {
    const findParamId = (candidates) => {
      for (const re of candidates) {
        const hit = familyParams.find(p => !p.formula && (re.test(p.id) || re.test(p.name)))
        if (hit) return hit.id
      }
      return null
    }
    if (dims.width !== undefined) {
      const id = findParamId([/^(Width|W|B|FlangeWidth|ClearWidth)$/i, /width|flange/i])
      if (id) overrides[id] = dims.width
    }
    if (dims.depth !== undefined) {
      const id = findParamId([/^(Depth|D|SectionDepth|ClearHeight)$/i, /depth/i])
      if (id) overrides[id] = dims.depth
    }
    if (dims.height !== undefined) {
      const id = findParamId([/^(Height|H|StemHeight|PierHeight)$/i, /height/i])
      if (id) overrides[id] = dims.height
    }
    if (dims.length !== undefined) {
      const id = findParamId([/^(Length|L|Span)$/i, /length|span/i])
      if (id) overrides[id] = dims.length
    }
    if (dims.thickness !== undefined) {
      const id = findParamId([/^(Thickness|T|WallThickness|tw|tf)$/i, /thick/i])
      if (id) overrides[id] = dims.thickness
    }
    return overrides
  }
  if (dims.width !== undefined) overrides.Width = dims.width
  if (dims.depth !== undefined) overrides.Depth = dims.depth
  if (dims.height !== undefined) overrides.Height = dims.height
  if (dims.length !== undefined) overrides.Length = dims.length
  return overrides
}

function buildDeepLinkUrl(baseUrl, familyId, opts = {}) {
  const cleanBase = String(baseUrl || PUBLIC_BASE_URL).replace(/\/+$/, '')
  const params = new URLSearchParams()
  params.set('sample', familyId)
  if (opts.type) params.set('type', opts.type)
  if (opts.paramOverrides && Object.keys(opts.paramOverrides).length > 0) {
    const pairs = Object.entries(opts.paramOverrides)
      .filter(([, v]) => Number.isFinite(v) && v > 0)
      .map(([k, v]) => `${k}:${v}`)
    if (pairs.length > 0) params.set('set', pairs.join(','))
  }
  if (opts.utmStage) params.set('utm_stage', opts.utmStage)
  if (opts.utmSource) params.set('utm_source', opts.utmSource)
  return `${cleanBase}/?${params.toString()}`
}

function matchCatalogFamilies(queryText, catalog, opts = {}) {
  const baseUrl = opts.baseUrl || PUBLIC_BASE_URL
  const limit = opts.limit || 5
  const needs = opts.needs || extractCustomerNeeds(queryText)
  const combinedText = `${(needs.keywords || []).join(' ')} ${queryText || ''}`.trim()
  const lower = combinedText.toLowerCase()
  const tokens = lower.split(/[^a-z0-9가-힣-]+/).map(s => s.trim()).filter(s => s.length >= 2)
  const activeConcepts = DOMAIN_CONCEPTS.filter(c => c.terms.some(t => lower.includes(t.toLowerCase())))

  const scored = []
  for (const item of catalog) {
    let score = 0
    const matchedTerms = []
    const itemCode = item.id.split('/').pop()?.split('-')[0] ?? ''
    const itemSlug = item.id.toLowerCase()
    const itemTitle = item.title.toLowerCase()
    const itemCat = item.category.toLowerCase()

    if (itemCode && lower.includes(itemCode.toLowerCase())) {
      score += 50
      matchedTerms.push(itemCode)
    }
    for (const c of activeConcepts) {
      const prefIdx = c.codePrefixes.findIndex(pref => item.id.includes(pref))
      if (prefIdx !== -1) {
        score += c.weight + 20 - Math.min(10, prefIdx * 2)
        matchedTerms.push(c.categories[0] || item.category)
      } else if (c.categories.includes(item.category)) {
        score += c.weight
        matchedTerms.push(item.category)
      }
    }
    for (const tok of tokens) {
      if (itemTitle.includes(tok) || itemSlug.includes(tok)) {
        score += 14
        matchedTerms.push(tok)
      } else if (itemCat.includes(tok)) {
        score += 10
        matchedTerms.push(tok)
      } else if (
        (item.revitAnalog && item.revitAnalog.toLowerCase().includes(tok)) ||
        (item.notes && item.notes.toLowerCase().includes(tok))
      ) {
        score += 6
        matchedTerms.push(tok)
      }
    }
    if (needs.discipline !== 'UNKNOWN' && item.discipline === needs.discipline) {
      score += 8
    }
    if (/^(P|Q|S|T|U|IFC)/.test(itemCode)) {
      score += 5
    }
    if (item.category === 'Datums' && !/(datum|기준면|가이드\s*평면|레벨|그리드|level|grid)/i.test(combinedText)) {
      score -= 15
    }
    if (score > 0) {
      const paramOverrides = mapDimensionsToFamilyParams(needs.dimensions, item.parameters)
      const recommendedType = item.types.length > 0 ? item.types[item.types.length - 1] : null
      scored.push({
        family: item,
        score,
        matchedTerms: [...new Set(matchedTerms)],
        recommendedType,
        paramOverrides,
        deepLinkUrl: buildDeepLinkUrl(baseUrl, item.id, { type: recommendedType, paramOverrides, utmStage: 'prove' }),
      })
    }
  }

  if (scored.length === 0 && catalog.length > 0) {
    const targetDisc = needs.discipline !== 'UNKNOWN' ? needs.discipline : 'STRUCT'
    const fallbackPrefixes = {
      STRUCT: ['S01', 'S03', 'S05', 'H01'],
      ARCH: ['P11', 'P09', 'P03', 'Q02'],
      MEP: ['T01', 'T05', 'T10', 'U01'],
      INFRA: ['IFC-B01', 'IFC-B02', 'IFC-C01', 'IFC-R01'],
    }
    const prefs = fallbackPrefixes[targetDisc] || fallbackPrefixes.STRUCT
    for (const item of catalog) {
      if (prefs.some(p => item.id.includes(p)) || item.discipline === targetDisc) {
        const paramOverrides = mapDimensionsToFamilyParams(needs.dimensions, item.parameters)
        const recommendedType = item.types[0] || null
        scored.push({
          family: item,
          score: prefs.some(p => item.id.includes(p)) ? 20 : 10,
          matchedTerms: [targetDisc],
          recommendedType,
          paramOverrides,
          deepLinkUrl: buildDeepLinkUrl(baseUrl, item.id, { type: recommendedType, paramOverrides, utmStage: 'target' }),
        })
      }
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.family.id.localeCompare(b.family.id))
    .slice(0, limit)
}

const BEX_DEMO_VIDEOS = [
  {
    id: 'demo-01-bimer-office-open-import',
    file: 'demo-01-bimer-office-open-import.webm',
    url: '/demos/bex/demo-01-bimer-office-open-import.webm',
    youtubeUrl: 'https://youtu.be/Dq_sPVqTlc0',
    poster: '/demos/bex/demo-01-bimer-office-open-import.png',
    discipline: 'ARCH',
    product: 'Bimer Host',
    titleKo: '2층 오피스 본관 Open + 동측 별관 IFC Import(Append) & 일람표 자동 산출',
    summaryKo: '본관 모델 열기(Open) 후 별관 IFC를 현재 모델에 추가 병합(Import/Append)하고, 2D 평면 단면과 창호·실면적·벽수량 일람표를 즉시 산출하는 시연 영상',
    ctaUrl: '/host.html',
  },
  {
    id: 'demo-02-bimer-real-ifc-buildings',
    file: 'demo-02-bimer-real-ifc-buildings.webm',
    url: '/demos/bex/demo-02-bimer-real-ifc-buildings.webm',
    youtubeUrl: 'https://youtu.be/YPlVIueLKMk',
    poster: '/demos/bex/demo-02-bimer-real-ifc-buildings.png',
    discipline: 'ARCH',
    product: 'Bimer Host',
    titleKo: '실제 건축 IFC & .bimer 고속 로드 시연 (Solibri 4층 · Haus30 6층 · 클리닉 1,612부재)',
    summaryKo: 'Solibri 오피스, Haus30 6층 주거동, 메디컬 클리닉(벽·부재 1,612개, 창호 302개, 실 269개)을 .bimer 자체 포맷으로 0.1초 만에 로드하고 3D/2D 평면을 탐색하는 시연 영상',
    ctaUrl: '/host.html',
  },
  {
    id: 'demo-03-bimer-ifc4x3-bridges',
    file: 'demo-03-bimer-ifc4x3-bridges.webm',
    url: '/demos/bex/demo-03-bimer-ifc4x3-bridges.webm',
    youtubeUrl: 'https://youtu.be/9d9FCOb4bEg',
    poster: '/demos/bex/demo-03-bimer-ifc4x3-bridges.png',
    discipline: 'INFRA',
    product: 'Bimer Host',
    titleKo: 'IFC 4x3 교량 3종 (고속도로 교량 · 케임브리지 거더교 · 현수 보도교 케이블) 시연',
    summaryKo: 'IFC 4x3 표준 교량 샘플 3종(B5/BAB1 고속도로 교량, 케임브리지 4경간 거더교, 포물선 주케이블 현수 보도교)을 Bimer 호스트에서 로드·병합하고 3D/2D로 검토하는 시연 영상',
    ctaUrl: '/host.html',
  },
  {
    id: 'demo-04-studio-struct-flex',
    file: 'demo-04-studio-struct-flex.webm',
    url: '/demos/bex/demo-04-studio-struct-flex.webm',
    youtubeUrl: 'https://youtu.be/PqyCL6GiP8M',
    poster: '/demos/bex/demo-04-studio-struct-flex.png',
    discipline: 'STRUCT',
    product: 'Parametric Studio',
    titleKo: '구조 BIM: H형강 기둥(S01) & 워렌 트러스(S05) 3D 딥링크 즉시 변형(Flex)',
    summaryKo: '설치 없이 URL 딥링크 클릭 한 번으로 H형강 기둥(450×450, H=4.2m)과 철골 워렌 트러스(S05)를 로드하고 WASM 커널에서 실시간 치수 Flex를 수행하는 시연 영상',
    ctaUrl: '/?sample=builtin/S01-column-steel-wide-flange&type=H-400x400x13x21&set=B:450,D:450,H:4200&utm_stage=attract',
  },
  {
    id: 'demo-05-studio-mep-infra-flex',
    file: 'demo-05-studio-mep-infra-flex.webm',
    url: '/demos/bex/demo-05-studio-mep-infra-flex.webm',
    youtubeUrl: 'https://youtu.be/9d9FCOb4bEg',
    poster: '/demos/bex/demo-05-studio-mep-infra-flex.png',
    discipline: 'MEP',
    product: 'Parametric Studio',
    titleKo: 'MEP & 인프라: 덕트 로프트 리듀서(T06) & 교량 PSC I-거더(IFC-B01) 3D 시연',
    summaryKo: '기계설비 덕트 로프트 리듀서(T06, L=1,200mm)와 토목 IFC4.3 프리캐스트 교량 I-거더(IFC-B01, L=35m)를 웹 브라우저에서 즉시 열고 3D 형상을 검토하는 시연 영상',
    ctaUrl: '/?sample=builtin/T06-duct-fitting-reducer-loft&type=Reducer-800x500-Long&set=Length:1200&utm_stage=attract',
  },
]

function listAllDemoVideos(baseUrl = PUBLIC_BASE_URL) {
  const root = String(baseUrl || PUBLIC_BASE_URL).replace(/\/$/, '')
  return BEX_DEMO_VIDEOS.map(v => ({
    ...v,
    url: `${root}${v.url}`,
    poster: `${root}${v.poster}`,
    ctaUrl: `${root}${v.ctaUrl}`,
  }))
}

function getDemoVideosForDiscipline(discipline, baseUrl = PUBLIC_BASE_URL) {
  const all = listAllDemoVideos(baseUrl)
  if (!discipline || discipline === 'UNKNOWN') return all
  const matched = all.filter(v => v.discipline === discipline)
  return matched.length > 0 ? matched : all
}

function generateAttractCampaigns(catalog, baseUrl = PUBLIC_BASE_URL, disciplineFilter) {
  const specs = [
    {
      discipline: 'STRUCT',
      personaKo: '구조·강구조 BIM 엔지니어 및 설계사',
      headlineKo: 'Revit 설치 없이 브라우저에서 3초 만에 H형강 기둥·트러스·기초 패밀리 생성 및 단면 변형',
      hookKo:
        '단면 규격(H-300x300, H-400x400 등) 하나 바꾸려고 무거운 데스크톱 CAD를 켜고 패밀리 편집기에서 구속조건 깨짐과 씨름하고 계신가요? Parametric Studio에서는 웹 링크 클릭 한 번으로 와이드플랜지 철골 기둥·워렌 트러스·교량 받침 등 구조 부재를 즉시 열고, 가이드 평면(EQ/Lock)과 수식으로 안전하게 변형(Flex)할 수 있습니다.',
      painAddressed: ['slow_authoring', 'license_cost', 'type_variation'],
      channels: ['LinkedIn 구조기술사/BIM 그룹', 'Reddit r/StructuralEngineering & r/Revit', '건축구조기술사회 커뮤니티'],
      preferredCode: 'S01',
      fallbackTitle: 'S01 · Column Steel Wide Flange',
      ctaKo: '지금 브라우저에서 H형강 기둥 패밀리 실시간 변형(Flex) 체험하기',
    },
    {
      discipline: 'MEP',
      personaKo: '기계·배관·전기·소방(MEP) BIM 엔지니어',
      headlineKo: '공조기(AHU)·칠러·덕트 레듀서·수배전반 — 웹에서 치수만 입력하면 즉시 3D 파라메트릭 부재 완성',
      hookKo:
        '장비 일람표(Equipment Schedule)마다 달라지는 AHU 공조기·칠러·플랜지 밸브·케이블 트레이 규격, 외주 모델러를 기다리거나 박스 대용품으로 채우고 계신가요? Parametric Studio는 기계·배관·전기·소방 핵심 MEP 패밀리를 내장하고 있으며, 자연어 AI 설계(AIDESIGN)와 타입 카탈로그로 현장에서 즉시 규격을 변형해 STL/OBJ/GLTF 및 .pmodel로 내보낼 수 있습니다.',
      painAddressed: ['slow_authoring', 'type_variation', 'ai_automation'],
      channels: ['LinkedIn MEP/HVAC 엔지니어 그룹', '설비설계협회/소방기술인 커뮤니티', 'Reddit r/MEP & r/BIM'],
      preferredCode: 'T01',
      fallbackTitle: 'T01 · Mech Air Handling Unit',
      ctaKo: '설치 없이 웹에서 AHU 공조기 & 배관 밸브 파라메트릭 카탈로그 열기',
    },
    {
      discipline: 'INFRA',
      personaKo: '토목·교량·터널·항만·철도·상하수도(CIM/Infra BIM) 엔지니어',
      headlineKo: '4대 토목 분야(도로·항만·철도·상하수도) 53종 표준 부재 — 정적 파일 수백 개 대신 웹 파라메트릭 패밀리로 1초 만에 규격 전환',
      hookKo:
        '비영리 제한이 걸린 정적 부재 파일 수백 개를 일일이 다운로드해 수정하고 계신가요? Parametric Studio는 KDS/KCS·KS·국토부·해수부·국가철도공단 표준 치수표를 기반으로 직접 구축한 100% 상업용 클린룸 파라메트릭 패밀리 53종(사장교 주탑, 라멘교, NATM 터널, 테트라포드 8t~100t, 멀티격실 케이슨, 60kgK 레일·전차선주, KS 조립식 맨홀·흄관 등)을 기본 탑재하여 웹 브라우저에서 프리셋 클릭 한 번으로 단면과 연장이 즉시 재계산됩니다.',
      painAddressed: ['slow_authoring', 'type_variation', 'bimer_host_migration'],
      channels: ['스마트건설/토목 BIM 학회 및 포럼', 'LinkedIn Civil/Bridge/Marine/Rail BIM 네트워크', '건설기술연구원/국토부/해수부/철도공단 BIM 실무단 채널'],
      preferredCode: 'IFC-B01',
      fallbackTitle: 'Bridge I-Girder',
      ctaKo: '브라우저에서 4대 토목 분야 53종 IFC 4.3 파라메트릭 패밀리 바로 변형(Flex)해 보기',
    },
    {
      discipline: 'ARCH',
      personaKo: '건축 설계사 · BIM 매니저 · 창호/가구/모듈러 실무자',
      headlineKo: '가이드 평면(Skeleton) → 치수(EQ/Lock) → 수식 → 타입 카탈로그: 정석 패밀리 제작을 100% 웹에서',
      hookKo:
        '커튼월 멀리언, 여닫이/미서기 창호, 상·하부장 케이스워크, 엘리베이터 코어까지 — 정석 스켈레톤(뼈대 우선) 방식의 파라메트릭 컴포넌트 편집기를 무설치 브라우저 환경으로 옮겼습니다. 제작한 컴포넌트(.pmodel)는 향후 Bimer 호스트 프로젝트와 직결됩니다.',
      painAddressed: ['license_cost', 'web_collaboration', 'bimer_host_migration'],
      channels: ['건축사협회/BIM 매니저 포럼', 'Reddit r/Revit & r/Architecture', 'LinkedIn AEC Tech 채널'],
      preferredCode: 'P11',
      fallbackTitle: 'P11 · Window Framed Casement',
      ctaKo: '웹 브라우저에서 파라메트릭 창호 & 커튼월 컴포넌트 바로 열어보기',
    },
  ]

  const filtered = disciplineFilter ? specs.filter(s => s.discipline === disciplineFilter) : specs
  return filtered.map(spec => {
    const matched = catalog.find(c => c.id.includes(spec.preferredCode)) || catalog.find(c => c.discipline === spec.discipline)
    const familyId = matched?.id || `builtin/${spec.preferredCode}`
    const familyTitle = matched?.title || spec.fallbackTitle
    const recommendedType = matched?.types?.[0] || null
    const deepLinkUrl = buildDeepLinkUrl(baseUrl, familyId, {
      type: recommendedType,
      utmStage: 'attract',
      utmSource: spec.discipline.toLowerCase(),
    })
    const demoVideos = getDemoVideosForDiscipline(spec.discipline, baseUrl)
    return {
      discipline: spec.discipline,
      personaKo: spec.personaKo,
      headlineKo: spec.headlineKo,
      hookKo: spec.hookKo,
      painAddressed: spec.painAddressed,
      channels: spec.channels,
      featuredFamilyId: familyId,
      featuredFamilyTitle: familyTitle,
      deepLinkUrl,
      demoVideoUrl: demoVideos[0]?.url,
      demoVideos,
      ctaKo: spec.ctaKo,
    }
  })
}

function buildNextDiscoveryQuestion(needs) {
  if (needs.discipline === 'UNKNOWN') {
    return '현재 주로 다루시는 분야가 건축(ARCH), 구조(STRUCT), 설비·전기(MEP), 토목·인프라(INFRA) 중 어디에 해당하시나요? 가장 자주 쓰시는 부재(예: H형강 기둥, 공조기, 교량 거더, 창호 등)를 알려주시면 즉시 3D 샘플을 띄워 드리겠습니다.'
  }
  if ((needs.keywords || []).length === 0) {
    const exByDisc = {
      ARCH: '커튼월 멀리언, 여닫이/미서기 창호, 방화문, 케이스워크 수납장',
      STRUCT: '와이드플랜지 철골 기둥(S01), H형강 보(S03), 워렌 트러스(S05), 독립기초(H01)',
      MEP: '패키지 공조기 AHU(T01), 칠러(T02), 덕트 엘보/레듀서(T05/T06), 수배전반(U01)',
      INFRA: '교량 I-거더(IFC-B01), 사장교 주탑(IFC-B10), RC 라멘교(IFC-B12), 테트라포드(IFC-M03), 전차선주(IFC-S04), KS 조립식 맨홀(IFC-W01)',
    }
    return `어떤 부재부터 확인해 보시겠습니까? (${exByDisc[needs.discipline]} 등 225개 표준 패밀리가 준비되어 있습니다.)`
  }
  if (Object.keys(needs.dimensions || {}).length === 0) {
    return '원하시는 단면 치수나 규격(예: 폭 400mm, 깊이 400mm, 높이 3600mm 등)을 알려주시면, 지금 바로 해당 치수로 변형(Flex)된 3D 모델과 전용 링크를 생성해 드립니다.'
  }
  if ((needs.painPoints || []).length === 0 || (needs.currentTools || []).length === 0) {
    return '현재 패밀리/라이브러리 작업 시 주로 어떤 툴(Revit, Civil3D, AutoCAD 등)을 쓰고 계시며, 가장 큰 병목(제작 시간, 라이선스 비용, 타입 변형 오류 등)은 무엇인가요?'
  }
  if (!needs.contact) {
    return '방금 맞춤 설정한 .pmodel 패키지와 Bimer 호스트 얼리액세스(설계 파트너) 초청장을 받으실 이메일 또는 회사/담당자명을 남겨주시겠어요?'
  }
  return null
}

function generateOutboundPitch(prospectText, catalog, baseUrl = PUBLIC_BASE_URL) {
  const needs = extractCustomerNeeds(prospectText)
  const topMatches = matchCatalogFamilies(prospectText, catalog, { needs, baseUrl, limit: 3 })
  const primary = topMatches[0]
  const discLabel = {
    ARCH: '건축 BIM',
    STRUCT: '구조 BIM',
    MEP: 'MEP 설비·전기 BIM',
    INFRA: '토목·인프라 BIM',
    UNKNOWN: 'BIM 엔지니어링',
  }
  const familyName = primary?.family.title || '파라메트릭 3D 컴포넌트'
  const familyId = primary?.family.id || 'builtin/S01-column-steel-wide-flange'
  const paramList = primary?.family.parameters?.map(p => p.id).join(', ') || 'Width, Depth, Height'
  const typeList = primary?.family.types?.join(', ') || 'Small, Large'
  const deepLinkUrl = primary?.deepLinkUrl || buildDeepLinkUrl(baseUrl, familyId, { utmStage: 'target' })
  const demoVideos = getDemoVideosForDiscipline(needs.discipline, baseUrl)
  const demoVideoUrl = demoVideos[0]?.url
  const dimSummary = Object.entries(needs.dimensions || {}).map(([k, v]) => `${k}=${v}mm`).join(', ')

  const subjectKo = `[Bimer Parametric Studio] ${discLabel[needs.discipline]} 실무용 '${familyName}' 무설치 웹 파라메트릭 샘플 공유`
  const bodyKo = [
    `안녕하세요, ${needs.company ? `${needs.company} ` : ''}${discLabel[needs.discipline]} 담당자님.`,
    '',
    `최근 ${discLabel[needs.discipline]} 현업에서 패밀리/부재 제작 시간 단축과 무설치 웹 기반 규격 변형(Flex) 니즈가 높아, 실무에 바로 참고하실 수 있는 맞춤 3D 샘플과 시연 데모 영상을 준비했습니다.`,
    '',
    `■ 매칭된 표준 컴포넌트: ${familyName} (${familyId})`,
    `■ 제어 가능 매개변수: ${paramList}${dimSummary ? ` (요청 치수 자동 반영: ${dimSummary})` : ''}`,
    `■ 기본 탑재 타입 카탈로그: ${typeList}`,
    `■ 즉시 체험 3D 딥링크 (설치 불필요): ${deepLinkUrl}`,
    ...(demoVideoUrl ? [`■ 실증 데모 영상 (${demoVideos[0]?.titleKo}): ${demoVideoUrl}`] : []),
    `■ 225종 마스터 패밀리 카탈로그 (498개 표준 규격 프리셋 · 토목 53종 포함): ${baseUrl.replace(/\/$/, '')}/family-catalog.html`,
    `■ AI 프롬프트 패밀리 제작 가이드: ${baseUrl.replace(/\/$/, '')}/family-prompt-guide.html`,
    `■ Bimer.uk 6대 통합 워크스페이스 허브 (샘플 1-Click & .dwg/.dxf/.ifc 자동 라우터): https://bimer.uk`,
    '',
    `위 링크를 클릭하시면 데스크톱 CAD/Revit 설치 없이 브라우저에서 즉시 3D 솔리드와 가이드 평면이 열리며, 비영리 제한 정적 파일과 달리 KDS/KS 표준 치수표 기반 100% 상업용 클린룸 패밀리로 타입 전환 및 치수 변형 후 단품 IFC4(.ifc), .pmodel, STL/OBJ/GLTF로 바로 내보내실 수 있습니다.`,
    `또한 웹 기반 BIM 호스트 플랫폼(Bimer: ${baseUrl.replace(/\/$/, '')}/host.html)과 100% 호환됩니다.`,
  ].join('\n')

  const followUpQuestionKo = buildNextDiscoveryQuestion(needs) ||
    '현재 팀에서 가장 자주 변형하거나 제작에 시간이 많이 걸리는 부재 규격이 어떤 것인지 알려주시면 맞춤 설정된 링크를 바로 보내드리겠습니다.'

  return {
    prospectSummary: String(prospectText || '').trim(),
    discipline: needs.discipline,
    detectedNeeds: needs,
    topMatches,
    subjectKo,
    bodyKo,
    deepLinkUrl,
    demoVideoUrl,
    demoVideos,
    followUpQuestionKo,
  }
}

function buildLiveProofPlan(match, needs, rawByFile = {}) {
  const actions = []
  if (match) {
    const rawJson = rawByFile[match.family.file] || rawByFile[match.family.id]
    if (rawJson) {
      actions.push({
        cmd: 'load_pmodel',
        args: { pmodel: rawJson, title: match.family.title },
        rationale: `매칭된 표준 패밀리 '${match.family.title}' (${match.family.id}) 로드`,
      })
    }
    if (match.recommendedType && Object.keys(match.paramOverrides || {}).length === 0) {
      actions.push({
        cmd: 'switch_type',
        args: { name: match.recommendedType },
        rationale: `'${match.recommendedType}' 타입 규격 적용`,
      })
    }
    for (const [paramId, value] of Object.entries(match.paramOverrides || {})) {
      actions.push({
        cmd: 'set_param',
        args: { id: paramId, value },
        rationale: `고객 요청 치수 반영: ${paramId} = ${value}mm 실시간 변형(Flex)`,
      })
    }
    return actions
  }
  const w = needs.dimensions?.width ?? 400
  const d = needs.dimensions?.depth ?? 400
  const h = needs.dimensions?.height ?? 3000
  actions.push(
    { cmd: 'define_param', args: { id: 'Width', name: 'Width', value: w, dataType: 'Length', scope: 'Type' }, rationale: `폭 매개변수 Width=${w}mm 정의` },
    { cmd: 'define_param', args: { id: 'Depth', name: 'Depth', value: d, dataType: 'Length', scope: 'Type' }, rationale: `깊이 매개변수 Depth=${d}mm 정의` },
    { cmd: 'define_param', args: { id: 'Height', name: 'Height', value: h, dataType: 'Length', scope: 'Type' }, rationale: `높이 매개변수 Height=${h}mm 정의` },
    { cmd: 'create_box', args: { id: 'custom-solid', w: { ref: 'Width' }, h: { ref: 'Depth' }, d: { ref: 'Height' } }, rationale: '파라메트릭 3D 솔리드 생성' },
  )
  return actions
}

function estimateCustomerRoi(needs) {
  const team = Math.max(1, needs.teamSize ?? 5)
  const manualMinutesPerFamily = needs.discipline === 'INFRA' || needs.discipline === 'MEP' ? 90 : 60
  const studioMinutesPerFamily = 3
  const estimatedMonthlyFamilies = team * 6
  const savedMinutesPerMonth = estimatedMonthlyFamilies * (manualMinutesPerFamily - studioMinutesPerFamily)
  const hoursSavedPerMonth = Math.round((savedMinutesPerMonth / 60) * 10) / 10
  const annualSavedHours = Math.round(hoursSavedPerMonth * 12)
  const summaryKo =
    `${team}명 규모 팀 기준 월 ${estimatedMonthlyFamilies}개 부재 작업 시, 기존 데스크톱 수동 제작(개당 약 ${manualMinutesPerFamily}분) 대비 Parametric Studio(225개 표준 카탈로그 + 수식/치수 즉시 Flex, 개당 약 ${studioMinutesPerFamily}분) 도입으로 월 약 ${hoursSavedPerMonth}시간(연간 약 ${annualSavedHours}시간)의 엔지니어링 공수를 절감할 수 있습니다.`
  return {
    manualMinutesPerFamily,
    studioMinutesPerFamily,
    estimatedMonthlyFamilies,
    hoursSavedPerMonth,
    annualSavedHours,
    summaryKo,
  }
}

function decideStageAction(userMessage, catalog, opts = {}) {
  const baseUrl = opts.baseUrl || PUBLIC_BASE_URL
  const previousStage = opts.priorLead?.stage || 'ATTRACT'
  const needs = extractCustomerNeeds(userMessage, opts.priorLead?.needs)
  const qualificationScore = computeQualificationScore(needs)
  const topMatches = matchCatalogFamilies(userMessage, catalog, { needs, baseUrl, limit: 3 })
  const primary = topMatches[0]

  const hasSpecificComponent = needs.keywords.length > 0 || (primary != null && primary.score >= 25)
  const hasDimensions = Object.keys(needs.dimensions).length > 0
  const hasContactOrClosingIntent =
    Boolean(needs.contact) ||
    /(도입|견적|구매|계약|파일\s*전달|다운로드|파트너|얼리\s*액세스|연락|이메일|신청|pricing|quote|buy|onboard)/i.test(userMessage)

  let nextStage
  if (hasContactOrClosingIntent && (hasSpecificComponent || opts.priorLead?.proofExecuted)) {
    nextStage = 'CLOSE'
  } else if (hasSpecificComponent && (hasDimensions || previousStage === 'DISCOVER' || previousStage === 'PROVE')) {
    nextStage = 'PROVE'
  } else if (needs.discipline !== 'UNKNOWN' || needs.painPoints.length > 0 || hasSpecificComponent) {
    nextStage = 'DISCOVER'
  } else if (String(userMessage || '').trim().length > 0) {
    nextStage = 'TARGET'
  } else {
    nextStage = 'ATTRACT'
  }

  const missingInfo = []
  if (needs.discipline === 'UNKNOWN') missingInfo.push('discipline')
  if (needs.keywords.length === 0) missingInfo.push('targetComponent')
  if (!hasDimensions) missingInfo.push('dimensions')
  if (needs.painPoints.length === 0) missingInfo.push('painPoints')
  if (!needs.contact) missingInfo.push('contact')

  const nextQuestionKo = buildNextDiscoveryQuestion(needs)
  const proofPlan =
    nextStage === 'PROVE' || nextStage === 'CLOSE'
      ? buildLiveProofPlan(primary, needs, opts.pmodelJsonByFile)
      : []

  const deepLinkUrl = primary?.deepLinkUrl || null
  const demoVideos = getDemoVideosForDiscipline(needs.discipline, baseUrl)
  const demoVideoUrl = demoVideos[0]?.url || null
  const roi = nextStage === 'PROVE' || nextStage === 'CLOSE' ? estimateCustomerRoi(needs) : null

  let objectiveKo = ''
  const lines = []
  const painLabels = {
    slow_authoring: '패밀리 수동 제작 시간 단축',
    license_cost: '무설치·경량 웹 브라우저 환경',
    type_variation: '다규격 타입 카탈로그 및 치수/수식 자동 변형(Flex)',
    web_collaboration: '설치 없는 웹 링크 공유 및 협업',
    bimer_host_migration: '차세대 Bimer 호스트 프로젝트 연계',
    ai_automation: 'AI 자연어 기반 파라메트릭 모델링(AIDESIGN)',
  }

  switch (nextStage) {
    case 'ATTRACT':
      objectiveKo = '1단계(ATTRACT · 집객): 핵심 BIM 직군별 페인포인트 공감 및 즉시 실행 가능한 3D 쇼케이스 제시'
      lines.push('Parametric Studio는 데스크톱 CAD/Revit 설치 없이 웹 브라우저에서 바로 가이드 평면(Skeleton)·치수(EQ/Lock)·수식·타입 카탈로그로 3D 파라메트릭 컴포넌트를 제작·변형하는 전문 도구입니다.')
      if (demoVideoUrl) lines.push(`• 🎬 시연 데모 영상: ${demoVideoUrl}`)
      if (nextQuestionKo) lines.push('', `💡 ${nextQuestionKo}`)
      break
    case 'TARGET':
      objectiveKo = '2단계(TARGET · 타겟 도달): 고객 관심 분야 식별 및 205개 표준 패밀리 카탈로그 대표 샘플 매칭'
      lines.push('문의하신 내용에 맞춰 Parametric Studio의 205개 내장 패밀리 카탈로그에서 즉시 활용 가능한 대표 컴포넌트를 매칭했습니다.')
      if (primary) {
        lines.push(`• 추천 컴포넌트: **${primary.family.title}** (${primary.family.category})`)
        lines.push(`• 즉시 열기 딥링크: ${primary.deepLinkUrl}`)
      }
      if (demoVideoUrl) lines.push(`• 🎬 시연 데모 영상: ${demoVideoUrl}`)
      if (nextQuestionKo) lines.push('', `💡 ${nextQuestionKo}`)
      break
    case 'DISCOVER': {
      objectiveKo = '3단계(DISCOVER · 니즈 진단): 직군·페인포인트·필요 부재 구체화 및 맞춤 3D 시연 준비'
      const detectedPains = needs.painPoints.map(p => painLabels[p]).join(', ')
      lines.push(`파악된 핵심 니즈: **[분야: ${needs.discipline}]**${detectedPains ? ` · **[핵심 과제: ${detectedPains}]**` : ''}`)
      if (primary) {
        const paramsStr = primary.family.parameters?.map(p => `${p.id}(${p.value})`).join(', ') || 'Width, Depth, Height'
        lines.push(`가장 적합한 내장 패밀리는 **${primary.family.title}** (\`${primary.family.id}\`)이며, 기본 매개변수 [${paramsStr}] 및 타입 [${primary.family.types.join(', ')}]을 지원합니다.`)
        lines.push(`• 3D 샘플 바로가기: ${primary.deepLinkUrl}`)
      }
      if (demoVideoUrl) lines.push(`• 🎬 직군 맞춤 데모 영상 (${demoVideos[0]?.titleKo}): ${demoVideoUrl}`)
      if (nextQuestionKo) lines.push('', `👉 **맞춤 시연 질문**: ${nextQuestionKo}`)
      break
    }
    case 'PROVE': {
      objectiveKo = '4단계(PROVE · 가치 입증): 고객 요청 스펙을 반영한 실시간 3D 파라메트릭 모델 변형(Flex) 및 딥링크 제공'
      if (primary) {
        const overrideDesc = Object.entries(primary.paramOverrides).map(([k, v]) => `${k}=${v}mm`).join(', ')
        lines.push(`✅ **[실시간 3D 가치 입증]** 요청하신 스펙에 맞춰 **${primary.family.title}** (\`${primary.family.id}\`) 패밀리를 구성했습니다.`)
        if (overrideDesc) lines.push(`• 적용된 맞춤 치수(Flex): **${overrideDesc}**`)
        else if (primary.recommendedType) lines.push(`• 적용된 추천 타입: **${primary.recommendedType}**`)
        lines.push(`• 고객 맞춤 3D 딥링크 (클릭 시 해당 치수로 즉시 오픈): ${primary.deepLinkUrl}`)
      }
      if (demoVideoUrl) lines.push(`• 🎬 실증 데모 영상 (${demoVideos[0]?.titleKo}): ${demoVideoUrl}`)
      if (roi) lines.push(`• **도입 기대 효과**: ${roi.summaryKo}`)
      if (nextQuestionKo) lines.push('', `👉 **다음 단계**: ${nextQuestionKo}`)
      break
    }
    case 'CLOSE': {
      objectiveKo = '5단계(CLOSE · 영업 전환 & Bimer 온보딩): ROI 제안서 확정, 맞춤 .pmodel 패키지 전달 및 리드 등록 완료'
      lines.push(`🎯 **[맞춤 도입 제안 및 Bimer 설계 파트너 등록]**${needs.company ? ` (${needs.company})` : ''}`)
      if (primary) {
        lines.push(`1. **맞춤 컴포넌트 패키지**: ${primary.family.title} (\`${primary.family.id}.pmodel\`) + STL/OBJ/GLTF 즉시 내보내기 지원`)
        lines.push(`2. **전용 3D 작업 링크**: ${primary.deepLinkUrl}`)
      }
      if (roi) lines.push(`3. **ROI 분석**: ${roi.summaryKo}`)
      if (demoVideoUrl) lines.push(`4. **실증 데모 영상 패키지**: ${demoVideoUrl} (외 총 ${demoVideos.length}편)`)
      lines.push('5. **Bimer 생태계 로드맵**: Parametric Studio에서 제작한 모든 .pmodel 컴포넌트는 웹 기반 통합 BIM 호스트(**Bimer**)에 변환 없이 그대로 배치(Place in host)됩니다.')
      if (needs.contact) {
        lines.push(`6. **리드 등록 완료**: 남겨주신 연락처(${needs.contact})로 맞춤 패키지 가이드와 Bimer 얼리액세스 권한을 등록했습니다.`)
      } else if (nextQuestionKo) {
        lines.push('', `👉 ${nextQuestionKo}`)
      }
      break
    }
  }

  return {
    previousStage,
    nextStage,
    qualificationScore,
    objectiveKo,
    missingInfo,
    nextQuestionKo,
    topMatches,
    proofPlan,
    deepLinkUrl,
    demoVideoUrl,
    demoVideos,
    roi,
    needs,
    responseKo: lines.join('\n'),
  }
}

// ── Persistent CRM Store (leads.json) ─────────────────────────────────────

function loadLeads() {
  try {
    if (!fs.existsSync(CRM_PATH)) return []
    const data = JSON.parse(fs.readFileSync(CRM_PATH, 'utf8'))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveLeads(leads) {
  const dir = path.dirname(CRM_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(CRM_PATH, JSON.stringify(leads, null, 2), 'utf8')
}

function loadVoc() {
  try {
    const data = JSON.parse(fs.readFileSync(VOC_PATH, 'utf8'))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveVoc(items) {
  const dir = path.dirname(VOC_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(VOC_PATH, JSON.stringify(items, null, 2), 'utf8')
}

function normalizeVocInput(raw = {}) {
  const description = String(raw.description ?? raw.spec ?? raw.message ?? '').trim().slice(0, 1000)
  if (!description) return null
  const nowKst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ')
  return {
    id: String(raw.id || '').trim().slice(0, 64) || `voc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: String(raw.createdAt || '').trim().slice(0, 32) || nowKst,
    type: String(raw.type ?? raw.category ?? 'CUSTOM_FAMILY').trim().slice(0, 48) || 'CUSTOM_FAMILY',
    discipline: String(raw.discipline || 'ALL').trim().slice(0, 24) || 'ALL',
    description,
    contact: String(raw.contact || '익명 실무자').trim().slice(0, 160) || '익명 실무자',
    source: String(raw.source || 'web').trim().slice(0, 64) || 'web',
  }
}

async function notifyBexWebhook(payload) {
  if (!BEX_WEBHOOK_URL) return false
  try {
    const res = await fetch(BEX_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch {
    return false
  }
}

function upsertLeadFromDecision(leadId, userMessage, decision) {
  const leads = loadLeads()
  const now = new Date().toISOString()
  let lead = leadId ? leads.find(l => l.id === leadId) : null
  if (!lead) {
    lead = {
      id: leadId || `lead-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
      updatedAt: now,
      stage: decision.nextStage,
      qualificationScore: decision.qualificationScore,
      needs: decision.needs,
      matchedFamilies: [],
      proofExecuted: false,
      lastDeepLinkUrl: null,
      history: [],
      notes: [],
    }
    leads.push(lead)
  }
  lead.updatedAt = now
  lead.stage = decision.nextStage
  lead.qualificationScore = decision.qualificationScore
  lead.needs = decision.needs
  lead.matchedFamilies = decision.topMatches.map(m => ({
    id: m.family.id,
    title: m.family.title,
    category: m.family.category,
    score: m.score,
    deepLinkUrl: m.deepLinkUrl,
  }))
  if (decision.proofPlan.length > 0) lead.proofExecuted = true
  if (decision.deepLinkUrl) lead.lastDeepLinkUrl = decision.deepLinkUrl
  lead.history.push(
    { at: now, role: 'customer', text: userMessage, stage: decision.previousStage },
    { at: now, role: 'agent', text: decision.responseKo, stage: decision.nextStage },
  )
  saveLeads(leads)
  return lead
}

function summarizePipeline(leads) {
  const byStage = { ATTRACT: 0, TARGET: 0, DISCOVER: 0, PROVE: 0, CLOSE: 0 }
  const byDiscipline = { ARCH: 0, STRUCT: 0, MEP: 0, INFRA: 0, UNKNOWN: 0 }
  const painPointCounts = {
    slow_authoring: 0,
    license_cost: 0,
    type_variation: 0,
    web_collaboration: 0,
    bimer_host_migration: 0,
    ai_automation: 0,
  }
  const categoryMap = new Map()
  let totalScore = 0
  let bimerWaitlistCount = 0

  for (const lead of leads) {
    byStage[lead.stage] = (byStage[lead.stage] ?? 0) + 1
    const d = lead.needs?.discipline || 'UNKNOWN'
    byDiscipline[d] = (byDiscipline[d] ?? 0) + 1
    totalScore += lead.qualificationScore ?? 0
    if (lead.needs?.bimerInterest) bimerWaitlistCount++
    for (const p of lead.needs?.painPoints || []) {
      painPointCounts[p] = (painPointCounts[p] ?? 0) + 1
    }
    for (const m of lead.matchedFamilies || []) {
      categoryMap.set(m.category, (categoryMap.get(m.category) ?? 0) + 1)
    }
  }
  const topRequestedCategories = [...categoryMap.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    totalLeads: leads.length,
    byStage,
    byDiscipline,
    painPointCounts,
    topRequestedCategories,
    averageQualificationScore: leads.length > 0 ? Math.round((totalScore / leads.length) * 10) / 10 : 0,
    bimerWaitlistCount,
  }
}

// ── Optional LLM Enhancement ──────────────────────────────────────────────

async function enhanceWithLlmIfConfigured(userMessage, decision) {
  if (!LLM_READY) return null
  try {
    const headers = { 'content-type': 'application/json' }
    if (LLM_KEY) headers.authorization = `Bearer ${LLM_KEY}`
    const sys = [
      '당신은 Bimer Parametric Studio의 수석 BIM 기술영업·고객발굴 에이전트입니다.',
      `현재 퍼널 단계: ${decision.nextStage} (${decision.objectiveKo})`,
      `파악된 고객 니즈: ${JSON.stringify(decision.needs)}`,
      `추천 3D 패밀리: ${decision.topMatches.map(m => `${m.family.title}(${m.family.id})`).join(', ')}`,
      `맞춤 3D 딥링크: ${decision.deepLinkUrl || ''}`,
      `다음 필수 질문: ${decision.nextQuestionKo || '없음'}`,
      '규칙: 4문장 이내로 간결하고 전문적으로 답변하되, 반드시 맞춤 3D 딥링크와 다음 질문을 포함하세요.',
    ].join('\n')
    const res = await fetch(LLM_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: userMessage },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.choices?.[0]?.message?.content || null
  } catch {
    return null
  }
}

// ── Bridge Queue (for direct browser connection or forwarding) ────────────

const queue = []
const pending = new Map()
let parked = null
let seq = 0
let lastBrowserContact = 0

function enqueueBridgeCommand(command, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const id = `s${++seq}`
    const timer = setTimeout(() => {
      pending.delete(id)
      const idx = queue.findIndex(q => q.id === id)
      if (idx !== -1) queue.splice(idx, 1)
      reject(new Error(`bridge timeout after ${timeoutMs}ms`))
    }, timeoutMs)
    pending.set(id, { resolve, timer })
    queue.push({ id, command })
    if (parked && queue.length > 0) {
      const res = parked
      parked = null
      clearTimeout(res.salesTimer)
      respondJson(res, 200, queue.splice(0, queue.length))
    }
  })
}

function respondJson(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
  })
  res.end(body)
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'))
      } catch (err) {
        reject(err)
      }
    })
  })
}

function createServer() {
  const { catalog, rawByFile } = loadCatalogFromDisk()

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`)

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'content-type',
      })
      res.end()
      return
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      respondJson(res, 200, {
        ok: true,
        agent: 'growth-sales-agent',
        agentName: 'BEX',
        agentNameKo: '벡스',
        agentTitle: 'BEX (벡스) — Bimer EXecutive · Parametric Studio Growth & Sales Agent',
        catalogCount: catalog.length,
        demoVideoCount: BEX_DEMO_VIDEOS.length,
        llmReady: LLM_READY,
        crmPath: CRM_PATH,
        assets: {
          catalogHtml: 'docs/family-catalog.html',
          promptGuideHtml: 'docs/family-prompt-guide.html',
          promptGuideMd: 'docs/family-prompt-guide.md',
          marketingJson: 'docs/family-catalog-marketing.json',
          marketingPlanHtml: 'docs/bex-marketing-plan.html',
          projectRoadmapHtml: 'docs/project-status-roadmap.html',
          nativeSaveReportHtml: 'docs/bimer-native-save-report.html',
          demoVideosManifest: 'public/demos/bex/manifest.json',
        },
        browserSeen: lastBrowserContact ? new Date(lastBrowserContact).toISOString() : null,
      })
      return
    }

    if (req.method === 'GET' && url.pathname === '/demos') {
      const baseUrl = url.searchParams.get('baseUrl') || PUBLIC_BASE_URL
      const discipline = (url.searchParams.get('discipline') || '').toUpperCase()
      const demos = ['ARCH', 'STRUCT', 'MEP', 'INFRA'].includes(discipline)
        ? getDemoVideosForDiscipline(discipline, baseUrl)
        : listAllDemoVideos(baseUrl)
      respondJson(res, 200, { ok: true, count: demos.length, demos })
      return
    }

    if (req.method === 'GET' && url.pathname.startsWith('/demos/bex/')) {
      const safeName = path.basename(url.pathname)
      const p = path.join(ROOT, 'public/demos/bex', safeName)
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        const ext = path.extname(safeName).toLowerCase()
        const mime = ext === '.webm'
          ? 'video/webm'
          : ext === '.png'
            ? 'image/png'
            : 'application/json; charset=utf-8'
        res.writeHead(200, { 'content-type': mime, 'access-control-allow-origin': '*' })
        res.end(fs.readFileSync(p))
        return
      }
    }

    if (req.method === 'GET' && (url.pathname === '/catalog/html' || url.pathname === '/family-catalog.html')) {
      const p = path.join(ROOT, 'docs/family-catalog.html')
      if (fs.existsSync(p)) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'access-control-allow-origin': '*' })
        res.end(fs.readFileSync(p, 'utf8'))
        return
      }
    }

    if (req.method === 'GET' && (url.pathname === '/catalog/prompt-guide' || url.pathname === '/family-prompt-guide.html')) {
      const p = path.join(ROOT, 'docs/family-prompt-guide.html')
      if (fs.existsSync(p)) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'access-control-allow-origin': '*' })
        res.end(fs.readFileSync(p, 'utf8'))
        return
      }
    }

    if (req.method === 'GET' && (url.pathname === '/catalog/marketing-plan' || url.pathname === '/bex-marketing-plan.html')) {
      const p = path.join(ROOT, 'docs/bex-marketing-plan.html')
      if (fs.existsSync(p)) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'access-control-allow-origin': '*' })
        res.end(fs.readFileSync(p, 'utf8'))
        return
      }
    }

    if (req.method === 'GET' && (url.pathname === '/catalog/roadmap' || url.pathname === '/project-status-roadmap.html')) {
      const p = path.join(ROOT, 'docs/project-status-roadmap.html')
      if (fs.existsSync(p)) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'access-control-allow-origin': '*' })
        res.end(fs.readFileSync(p, 'utf8'))
        return
      }
    }

    if (req.method === 'GET' && (url.pathname === '/catalog/marketing' || url.pathname === '/family-catalog-marketing.json')) {
      const p = path.join(ROOT, 'docs/family-catalog-marketing.json')
      if (fs.existsSync(p)) {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' })
        res.end(fs.readFileSync(p, 'utf8'))
        return
      }
    }

    if (req.method === 'GET' && url.pathname === '/pricing.html') {
      const p = path.join(ROOT, 'public/pricing.html')
      if (fs.existsSync(p)) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'access-control-allow-origin': '*' })
        res.end(fs.readFileSync(p, 'utf8'))
        return
      }
    }

    if (req.method === 'GET' && url.pathname === '/bex-dev-handoff.md') {
      const p = path.join(ROOT, 'docs/bex-dev-handoff.md')
      if (fs.existsSync(p)) {
        res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8', 'access-control-allow-origin': '*' })
        res.end(fs.readFileSync(p, 'utf8'))
        return
      }
    }

    // Bridge endpoints (/pull, /push) so a browser with ?bridge=http://127.0.0.1:8766 can receive 3D proofs directly
    if (req.method === 'GET' && url.pathname === '/pull') {
      lastBrowserContact = Date.now()
      if (queue.length > 0) {
        respondJson(res, 200, queue.splice(0, queue.length))
        return
      }
      if (parked) {
        const old = parked
        parked = null
        clearTimeout(old.salesTimer)
        respondJson(old, 200, [])
      }
      parked = res
      res.salesTimer = setTimeout(() => {
        if (parked === res) {
          parked = null
          respondJson(res, 200, [])
        }
      }, 20_000)
      req.on('close', () => {
        if (parked === res) parked = null
        clearTimeout(res.salesTimer)
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/push') {
      lastBrowserContact = Date.now()
      try {
        const { id, result } = await readJsonBody(req)
        const p = pending.get(id)
        if (p) {
          pending.delete(id)
          clearTimeout(p.timer)
          p.resolve(result)
        }
        respondJson(res, 200, { ok: true })
      } catch (err) {
        respondJson(res, 400, { ok: false, error: String(err) })
      }
      return
    }

    if (req.method === 'GET' && url.pathname === '/catalog/search') {
      const q = url.searchParams.get('q') || ''
      const limit = Number(url.searchParams.get('limit') || 5)
      const baseUrl = url.searchParams.get('baseUrl') || PUBLIC_BASE_URL
      const matches = matchCatalogFamilies(q, catalog, { baseUrl, limit })
      respondJson(res, 200, { ok: true, count: matches.length, matches })
      return
    }

    if (req.method === 'POST' && url.pathname === '/campaign') {
      try {
        const body = await readJsonBody(req)
        const campaigns = generateAttractCampaigns(catalog, body.baseUrl || PUBLIC_BASE_URL, body.discipline)
        respondJson(res, 200, { ok: true, stage: 'ATTRACT', campaigns })
      } catch (err) {
        respondJson(res, 400, { ok: false, error: err.message })
      }
      return
    }

    if (req.method === 'POST' && url.pathname === '/outreach') {
      try {
        const body = await readJsonBody(req)
        if (!body.prospect || typeof body.prospect !== 'string') {
          respondJson(res, 400, { ok: false, error: 'prospect string is required' })
          return
        }
        const pitch = generateOutboundPitch(body.prospect, catalog, body.baseUrl || PUBLIC_BASE_URL)
        let lead = null
        if (body.saveLead !== false) {
          const decision = decideStageAction(body.prospect, catalog, {
            baseUrl: body.baseUrl || PUBLIC_BASE_URL,
            pmodelJsonByFile: rawByFile,
          })
          decision.nextStage = 'TARGET'
          lead = upsertLeadFromDecision(body.leadId, body.prospect, decision)
        }
        respondJson(res, 200, { ok: true, stage: 'TARGET', pitch, lead })
      } catch (err) {
        respondJson(res, 400, { ok: false, error: err.message })
      }
      return
    }

    if (req.method === 'POST' && url.pathname === '/consult') {
      try {
        const body = await readJsonBody(req)
        if (typeof body.message !== 'string') {
          respondJson(res, 400, { ok: false, error: 'message string is required' })
          return
        }
        const leads = loadLeads()
        const priorLead = body.leadId ? leads.find(l => l.id === body.leadId) : undefined
        const decision = decideStageAction(body.message, catalog, {
          priorLead,
          baseUrl: body.baseUrl || PUBLIC_BASE_URL,
          pmodelJsonByFile: rawByFile,
        })
        const llmReply = await enhanceWithLlmIfConfigured(body.message, decision)
        if (llmReply) decision.responseKo = llmReply

        const lead = upsertLeadFromDecision(body.leadId, body.message, decision)

        const bridgeResults = []
        if (body.executeProofOnBridge && decision.proofPlan.length > 0) {
          for (const step of decision.proofPlan) {
            try {
              const r = await enqueueBridgeCommand({ cmd: step.cmd, args: step.args }, 10_000)
              bridgeResults.push({ cmd: step.cmd, ok: !!r?.ok, result: r })
            } catch (err) {
              bridgeResults.push({ cmd: step.cmd, ok: false, error: err.message })
            }
          }
        }

        // Strip raw .pmodel string from HTTP response proofPlan summary unless requested
        const compactProofPlan = decision.proofPlan.map(p => ({
          cmd: p.cmd,
          args: p.cmd === 'load_pmodel'
            ? { title: p.args.title, pmodelBytes: String(p.args.pmodel || '').length }
            : p.args,
          rationale: p.rationale,
        }))

        respondJson(res, 200, {
          ok: true,
          leadId: lead.id,
          previousStage: decision.previousStage,
          stage: decision.nextStage,
          qualificationScore: decision.qualificationScore,
          objectiveKo: decision.objectiveKo,
          needs: decision.needs,
          missingInfo: decision.missingInfo,
          nextQuestionKo: decision.nextQuestionKo,
          deepLinkUrl: decision.deepLinkUrl,
          demoVideoUrl: decision.demoVideoUrl,
          demoVideos: decision.demoVideos,
          topMatches: decision.topMatches.map(m => ({
            id: m.family.id,
            title: m.family.title,
            category: m.family.category,
            score: m.score,
            recommendedType: m.recommendedType,
            paramOverrides: m.paramOverrides,
            deepLinkUrl: m.deepLinkUrl,
          })),
          proofPlan: compactProofPlan,
          bridgeResults,
          roi: decision.roi,
          reply: decision.responseKo,
        })
      } catch (err) {
        respondJson(res, 400, { ok: false, error: err.message })
      }
      return
    }

    if (req.method === 'GET' && (url.pathname === '/leads' || url.pathname === '/api/leads')) {
      const leads = loadLeads()
      const voc = loadVoc()
      respondJson(res, 200, { ok: true, storage: 'disk', count: leads.length, leads, vocCount: voc.length, voc })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/leads') {
      try {
        const body = await readJsonBody(req)
        const familyId = String(body.familyId || '').trim()
        const message = String(body.message || '').trim()
        const contact = String(body.contact || '미입력').trim() || '미입력'
        if (!familyId && !message && contact === '미입력') {
          respondJson(res, 400, { ok: false, error: 'lead-fields-required' })
          return
        }
        const nowKst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ')
        const leadItem = {
          id: String(body.id || '').trim() || `lead-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: String(body.createdAt || '').trim() || nowKst,
          updatedAt: new Date().toISOString(),
          stage: String(body.stage || 'DISCOVER').trim(),
          discipline: String(body.discipline || 'STRUCT').trim(),
          familyId: familyId || 'builtin/S01-column-steel-wide-flange',
          familyTitle: String(body.familyTitle || familyId || '파라메트릭 3D 컴포넌트').trim(),
          overrides: body.overrides && typeof body.overrides === 'object' ? body.overrides : {},
          score: Number(body.score ?? body.qualificationScore ?? 50),
          qualificationScore: Number(body.score ?? body.qualificationScore ?? 50),
          bimerWaitlist: Boolean(body.bimerWaitlist ?? body.bimerInterest ?? (contact !== '미입력')),
          contact,
          deepLink: String(body.deepLink || body.deepLinkUrl || `${PUBLIC_BASE_URL}/studio.html`).trim(),
          needs: {
            discipline: String(body.discipline || 'STRUCT').trim(),
            painPoints: [],
            keywords: [],
            dimensions: body.overrides && typeof body.overrides === 'object' ? body.overrides : {},
            currentTools: [],
            teamSize: null,
            bimerInterest: Boolean(body.bimerWaitlist ?? body.bimerInterest ?? (contact !== '미입력')),
            urgency: 'medium',
            ...(contact !== '미입력' ? { contact } : {}),
          },
          matchedFamilies: familyId
            ? [{ id: familyId, title: String(body.familyTitle || familyId), category: String(body.discipline || 'STRUCT'), score: Number(body.score ?? 50), deepLinkUrl: String(body.deepLink || '') }]
            : [],
          proofExecuted: Boolean(body.stage === 'PROVE' || body.stage === 'CLOSE'),
          lastDeepLinkUrl: String(body.deepLink || '') || null,
          history: message ? [{ at: new Date().toISOString(), role: 'customer', text: message, stage: String(body.stage || 'DISCOVER') }] : [],
          notes: [],
          source: String(body.source || 'bex-live-console'),
        }
        const existing = loadLeads()
        const deduped = [leadItem, ...existing.filter(l => l.id !== leadItem.id)]
        saveLeads(deduped)
        const webhookNotified = await notifyBexWebhook({
          event: 'bex.lead.created',
          text: `🎯 [BEX 리드 캡처] (${leadItem.id} | ${leadItem.stage}) ${leadItem.discipline} · ${leadItem.familyTitle} · ${leadItem.contact}`,
          lead: leadItem,
        })
        respondJson(res, 200, { ok: true, stored: 'disk', webhookNotified, lead: leadItem })
      } catch (err) {
        respondJson(res, 400, { ok: false, error: err.message })
      }
      return
    }

    if (req.method === 'GET' && (url.pathname === '/voc' || url.pathname === '/api/voc')) {
      const items = loadVoc()
      respondJson(res, 200, { ok: true, storage: 'disk', count: items.length, items })
      return
    }

    if (req.method === 'POST' && (url.pathname === '/voc' || url.pathname === '/api/voc')) {
      try {
        const body = await readJsonBody(req)
        const item = normalizeVocInput(body)
        if (!item) {
          respondJson(res, 400, { ok: false, error: 'description-required' })
          return
        }
        const existing = loadVoc()
        const deduped = [item, ...existing.filter(x => x.id !== item.id)].slice(0, 200)
        saveVoc(deduped)
        const webhookNotified = await notifyBexWebhook({
          event: 'bex.voc.created',
          text: `🔔 [BEX VOC 신청 접수] (${item.id}) [${item.discipline}/${item.type}] ${item.description} (${item.contact})`,
          item,
        })
        respondJson(res, 200, { ok: true, stored: 'disk', webhookNotified, item })
      } catch (err) {
        respondJson(res, 400, { ok: false, error: err.message })
      }
      return
    }

    if (req.method === 'GET' && url.pathname === '/pipeline') {
      const leads = loadLeads()
      const voc = loadVoc()
      respondJson(res, 200, { ok: true, pipeline: summarizePipeline(leads), vocCount: voc.length, voc })
      return
    }

    respondJson(res, 404, { ok: false, error: 'not found' })
  })
}

// ── CLI Runner ────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2)
  const { catalog, rawByFile } = loadCatalogFromDisk()

  const flagVal = (flag) => {
    const idx = argv.indexOf(flag)
    if (idx === -1) return null
    return argv[idx + 1] ?? ''
  }

  if (argv.includes('--campaign')) {
    const discRaw = (flagVal('--campaign') || '').toUpperCase()
    const disc = ['ARCH', 'STRUCT', 'MEP', 'INFRA'].includes(discRaw) ? discRaw : undefined
    const campaigns = generateAttractCampaigns(catalog, PUBLIC_BASE_URL, disc)
    console.log(JSON.stringify({ ok: true, stage: 'ATTRACT', count: campaigns.length, campaigns }, null, 2))
    return
  }

  if (argv.includes('--demos')) {
    const discRaw = (flagVal('--demos') || '').toUpperCase()
    const demos = ['ARCH', 'STRUCT', 'MEP', 'INFRA'].includes(discRaw)
      ? getDemoVideosForDiscipline(discRaw, PUBLIC_BASE_URL)
      : listAllDemoVideos(PUBLIC_BASE_URL)
    console.log(JSON.stringify({ ok: true, agent: 'BEX (벡스)', count: demos.length, demos }, null, 2))
    return
  }

  if (argv.includes('--outreach')) {
    const text = flagVal('--outreach') || ''
    const leadId = flagVal('--lead') || undefined
    const pitch = generateOutboundPitch(text, catalog, PUBLIC_BASE_URL)
    const decision = decideStageAction(text, catalog, { baseUrl: PUBLIC_BASE_URL, pmodelJsonByFile: rawByFile })
    decision.nextStage = 'TARGET'
    const lead = upsertLeadFromDecision(leadId, text, decision)
    console.log(JSON.stringify({ ok: true, stage: 'TARGET', leadId: lead.id, pitch }, null, 2))
    return
  }

  if (argv.includes('--consult')) {
    const text = flagVal('--consult') || ''
    const leadId = flagVal('--lead') || undefined
    const leads = loadLeads()
    const priorLead = leadId ? leads.find(l => l.id === leadId) : undefined
    const decision = decideStageAction(text, catalog, {
      priorLead,
      baseUrl: PUBLIC_BASE_URL,
      pmodelJsonByFile: rawByFile,
    })
    const llmReply = await enhanceWithLlmIfConfigured(text, decision)
    if (llmReply) decision.responseKo = llmReply
    const lead = upsertLeadFromDecision(leadId, text, decision)
    console.log(JSON.stringify({
      ok: true,
      leadId: lead.id,
      previousStage: decision.previousStage,
      stage: decision.nextStage,
      qualificationScore: decision.qualificationScore,
      objectiveKo: decision.objectiveKo,
      needs: decision.needs,
      deepLinkUrl: decision.deepLinkUrl,
      demoVideoUrl: decision.demoVideoUrl,
      demoVideos: decision.demoVideos,
      proofPlanCount: decision.proofPlan.length,
      roi: decision.roi,
      reply: decision.responseKo,
    }, null, 2))
    return
  }

  if (argv.includes('--pipeline')) {
    const leads = loadLeads()
    const voc = loadVoc()
    console.log(JSON.stringify({ ok: true, pipeline: summarizePipeline(leads), vocCount: voc.length, voc }, null, 2))
    return
  }

  if (argv.includes('--voc')) {
    const items = loadVoc()
    console.log(JSON.stringify({ ok: true, count: items.length, items }, null, 2))
    return
  }

  if (argv.includes('--assets')) {
    const mktPath = path.join(ROOT, 'docs/family-catalog-marketing.json')
    const mktSummary = fs.existsSync(mktPath) ? JSON.parse(fs.readFileSync(mktPath, 'utf8')).summary : null
    console.log(JSON.stringify({
      ok: true,
      agent: 'BEX (벡스)',
      assets: {
        catalogHtml: 'docs/family-catalog.html',
        promptGuideHtml: 'docs/family-prompt-guide.html',
        promptGuideMd: 'docs/family-prompt-guide.md',
        marketingJson: 'docs/family-catalog-marketing.json',
        marketingPlanHtml: 'docs/bex-marketing-plan.html',
        projectRoadmapHtml: 'docs/project-status-roadmap.html',
        nativeSaveReportHtml: 'docs/bimer-native-save-report.html',
        demoVideosManifest: 'public/demos/bex/manifest.json',
      },
      demoVideos: listAllDemoVideos(PUBLIC_BASE_URL),
      summary: mktSummary,
    }, null, 2))
    return
  }

  const server = createServer()
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[BEX | sales-agent] listening on http://127.0.0.1:${PORT} (catalog=${catalog.length} families, demos=${BEX_DEMO_VIDEOS.length}, crm=${CRM_PATH})`)
    if (!argv.includes('--serve')) {
      startInteractiveRepl(catalog, rawByFile)
    }
  })
}

function startInteractiveRepl(catalog, rawByFile) {
  let currentLeadId = `session-${Date.now()}`
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'bex> ' })
  console.log('\nBEX (벡스) — Parametric Studio & Bimer Growth/Sales Agent REPL')
  console.log('commands: /campaign [ARCH|STRUCT|MEP|INFRA] · /demos · /outreach <text> · /pipeline · /assets · /new · /quit')
  console.log('anything else = customer message in the 5-stage consultative funnel\n')
  rl.prompt()
  rl.on('line', async (line) => {
    const text = line.trim()
    if (!text) { rl.prompt(); return }
    if (text === '/quit' || text === '/exit') { rl.close(); return }
    if (text === '/new') {
      currentLeadId = `session-${Date.now()}`
      console.log(`New lead session: ${currentLeadId}`)
      rl.prompt(); return
    }
    if (text.startsWith('/campaign')) {
      const arg = text.split(/\s+/)[1]?.toUpperCase()
      const disc = ['ARCH', 'STRUCT', 'MEP', 'INFRA'].includes(arg) ? arg : undefined
      console.log(JSON.stringify(generateAttractCampaigns(catalog, PUBLIC_BASE_URL, disc), null, 2))
      rl.prompt(); return
    }
    if (text.startsWith('/demos')) {
      const arg = text.split(/\s+/)[1]?.toUpperCase()
      const demos = ['ARCH', 'STRUCT', 'MEP', 'INFRA'].includes(arg)
        ? getDemoVideosForDiscipline(arg, PUBLIC_BASE_URL)
        : listAllDemoVideos(PUBLIC_BASE_URL)
      console.log(JSON.stringify(demos, null, 2))
      rl.prompt(); return
    }
    if (text.startsWith('/outreach ')) {
      const pitch = generateOutboundPitch(text.slice(10), catalog, PUBLIC_BASE_URL)
      console.log(`\nSubject: ${pitch.subjectKo}\n\n${pitch.bodyKo}\n\nFollow-up: ${pitch.followUpQuestionKo}\n`)
      rl.prompt(); return
    }
    if (text === '/pipeline') {
      console.log(JSON.stringify(summarizePipeline(loadLeads()), null, 2))
      rl.prompt(); return
    }
    if (text === '/assets') {
      const mktPath = path.join(ROOT, 'docs/family-catalog-marketing.json')
      const mktSummary = fs.existsSync(mktPath) ? JSON.parse(fs.readFileSync(mktPath, 'utf8')).summary : null
      console.log(JSON.stringify({
        catalogHtml: 'docs/family-catalog.html',
        promptGuideHtml: 'docs/family-prompt-guide.html',
        promptGuideMd: 'docs/family-prompt-guide.md',
        marketingJson: 'docs/family-catalog-marketing.json',
        marketingPlanHtml: 'docs/bex-marketing-plan.html',
        projectRoadmapHtml: 'docs/project-status-roadmap.html',
        nativeSaveReportHtml: 'docs/bimer-native-save-report.html',
        demoVideosManifest: 'public/demos/bex/manifest.json',
        demoVideos: listAllDemoVideos(PUBLIC_BASE_URL),
        summary: mktSummary,
      }, null, 2))
      rl.prompt(); return
    }
    const leads = loadLeads()
    const priorLead = leads.find(l => l.id === currentLeadId)
    const decision = decideStageAction(text, catalog, {
      priorLead,
      baseUrl: PUBLIC_BASE_URL,
      pmodelJsonByFile: rawByFile,
    })
    const llmReply = await enhanceWithLlmIfConfigured(text, decision)
    if (llmReply) decision.responseKo = llmReply
    upsertLeadFromDecision(currentLeadId, text, decision)
    console.log(`\n[${decision.previousStage} → ${decision.nextStage} | Score: ${decision.qualificationScore}/100]`)
    console.log(`${decision.responseKo}\n`)
    rl.prompt()
  })
  rl.on('close', () => process.exit(0))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
