const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const projectRoot = path.join(__dirname, '..')
const sourcePath = path.join(projectRoot, 'Assets', 'icon.png')
const outputPath = path.join(projectRoot, 'Assets', 'icon.ico')
const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256]
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'words-of-yeshua-icon-'))

try {
  const images = sizes.map((size) => {
    const framePath = path.join(temporaryDirectory, `icon-${size}.png`)
    const result = spawnSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', sourcePath,
      '-vf', `scale=${size}:${size}:flags=lanczos`, '-frames:v', '1', framePath,
    ], { stdio: 'inherit' })

    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(`ffmpeg failed while generating the ${size}px icon frame.`)
    return { size, data: fs.readFileSync(framePath) }
  })

  const directorySize = 6 + images.length * 16
  const output = Buffer.alloc(directorySize + images.reduce((total, image) => total + image.data.length, 0))
  output.writeUInt16LE(0, 0)
  output.writeUInt16LE(1, 2)
  output.writeUInt16LE(images.length, 4)

  let imageOffset = directorySize
  images.forEach((image, index) => {
    const entryOffset = 6 + index * 16
    output.writeUInt8(image.size === 256 ? 0 : image.size, entryOffset)
    output.writeUInt8(image.size === 256 ? 0 : image.size, entryOffset + 1)
    output.writeUInt8(0, entryOffset + 2)
    output.writeUInt8(0, entryOffset + 3)
    output.writeUInt16LE(1, entryOffset + 4)
    output.writeUInt16LE(32, entryOffset + 6)
    output.writeUInt32LE(image.data.length, entryOffset + 8)
    output.writeUInt32LE(imageOffset, entryOffset + 12)
    image.data.copy(output, imageOffset)
    imageOffset += image.data.length
  })

  fs.writeFileSync(outputPath, output)
  console.log(`Generated ${outputPath} with ${images.length} icon sizes.`)
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true })
}
