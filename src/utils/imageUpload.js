const IMAGE_TYPES_COMPRESSIVEIS = ['image/jpeg', 'image/png', 'image/webp']

export function isImageFile(file) {
  return Boolean(file?.type && file.type.startsWith('image/'))
}

export function formatFileSize(size = 0) {
  if (!Number.isFinite(size) || size <= 0) return '0 KB'
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

function carregarImagem(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Nao foi possivel ler a imagem selecionada.'))
    }
    img.src = url
  })
}

function calcularDimensoes(width, height, maxWidth, maxHeight) {
  const escala = Math.min(1, maxWidth / width, maxHeight / height)
  return {
    width: Math.max(1, Math.round(width * escala)),
    height: Math.max(1, Math.round(height * escala)),
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Nao foi possivel preparar a imagem para upload.'))
    }, type, quality)
  })
}

function nomeComExtensaoJpg(nome = 'foto.jpg') {
  const base = nome.replace(/\.[^.]+$/, '') || 'foto'
  return `${base}.jpg`
}

export async function prepararImagemUpload(file, options = {}) {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.76,
  } = options

  const resultadoOriginal = {
    file,
    originalSize: file?.size || 0,
    finalSize: file?.size || 0,
    compressed: false,
  }

  if (!file || !isImageFile(file) || !IMAGE_TYPES_COMPRESSIVEIS.includes(file.type)) {
    return resultadoOriginal
  }

  if (typeof document === 'undefined' || typeof Image === 'undefined' || typeof File === 'undefined') {
    return resultadoOriginal
  }

  try {
    const img = await carregarImagem(file)
    const dimensoes = calcularDimensoes(img.width, img.height, maxWidth, maxHeight)
    const canvas = document.createElement('canvas')
    canvas.width = dimensoes.width
    canvas.height = dimensoes.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return resultadoOriginal
    ctx.drawImage(img, 0, 0, dimensoes.width, dimensoes.height)
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    if (!blob || blob.size >= file.size) return resultadoOriginal
    const compressedFile = new File([blob], nomeComExtensaoJpg(file.name), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
    return {
      file: compressedFile,
      originalSize: file.size,
      finalSize: compressedFile.size,
      compressed: true,
    }
  } catch (error) {
    console.warn('Falha ao comprimir imagem; enviando arquivo original.', error)
    return resultadoOriginal
  }
}
