#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const OWNER = 'Flumbus'
const REPO = 'lf-pack'
const BRANCH = 'main'

const ROOT = path.resolve(__dirname, '..')
const MAIN_MODS_DIR = path.join(ROOT, 'mods', 'main', 'mods')
const OPTIONALS_DIR = path.join(ROOT, 'mods', 'optionals')
const OUTPUT_FILE = path.join(ROOT, 'launch', 'mods-manifest.json')

function toPosix(p) {
  return p.split(path.sep).join('/')
}

function rawUrl(relativePath) {
  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${toPosix(relativePath)}`
}

function sha256(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

function walkFiles(rootDir, currentDir = rootDir) {
  if (!fs.existsSync(currentDir)) {
    return []
  }

  const entries = fs.readdirSync(currentDir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.name === '.gitkeep') {
      continue
    }

    const abs = path.join(currentDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkFiles(rootDir, abs))
      continue
    }

    const relativeToRoot = path.relative(rootDir, abs)
    files.push({
      path: toPosix(relativeToRoot),
      repoPath: toPosix(path.relative(ROOT, abs)),
      url: rawUrl(path.relative(ROOT, abs)),
      sha256: sha256(abs)
    })
  }

  return files
}

function loadOptionalPack(packId) {
  const packRoot = path.join(OPTIONALS_DIR, packId)
  const infoPath = path.join(packRoot, 'info.json')
  const modsDir = path.join(packRoot, 'mods')

  let info = {
    id: packId,
    title: packId,
    description: '',
    category: 'other',
    default: false,
    logo: ''
  }

  if (fs.existsSync(infoPath)) {
    info = {
      ...info,
      ...JSON.parse(fs.readFileSync(infoPath, 'utf8'))
    }
  }

  return {
    id: String(info.id || packId),
    title: String(info.title || packId),
    description: String(info.description || ''),
    category: String(info.category || 'other'),
    optional: true,
    default: Boolean(info.default),
    logo: String(info.logo || ''),
    files: walkFiles(modsDir)
  }
}

function main() {
  const packs = []

  packs.push({
    id: 'main',
    title: 'Основная сборка',
    description: 'Обязательные моды LittleFlame.',
    category: 'main',
    optional: false,
    logo: '',
    files: walkFiles(MAIN_MODS_DIR)
  })

  if (fs.existsSync(OPTIONALS_DIR)) {
    const optionalDirs = fs.readdirSync(OPTIONALS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()

    for (const packId of optionalDirs) {
      packs.push(loadOptionalPack(packId))
    }
  }

  const manifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    source: {
      owner: OWNER,
      repo: REPO,
      branch: BRANCH
    },
    packs
  }

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true })
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2) + '\n', 'utf8')

  console.log(`mods-manifest.json updated: ${packs.length} packs`)
}

main()
