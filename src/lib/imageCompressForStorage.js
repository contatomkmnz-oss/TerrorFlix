/**
 * Comprime imagens antes do data URL — e antes de guardar em IndexedDB.
 * GIF/SVG: mantidos; resto: JPEG com várias passagens até ~90KB.
 */
const TARGET_BLOB_BYTES = 90 * 1024;

const STEPS = [
  { maxSide: 1400, q: 0.82 },
  { maxSide: 1100, q: 0.76 },
  { maxSide: 880, q: 0.7 },
  { maxSide: 640, q: 0.64 },
  { maxSide: 480, q: 0.58 },
  { maxSide: 400, q: 0.52 },
  { maxSide: 320, q: 0.48 },
];

function canvasToJpegBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
  });
}

async function fileToJpegBlob(file, maxSide, quality) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      URL.revokeObjectURL(url);
      try {
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          if (width >= height) {
            height = Math.round((height * maxSide) / width);
            width = maxSide;
          } else {
            width = Math.round((width * maxSide) / height);
            height = maxSide;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const blob = await canvasToJpegBlob(canvas, quality);
        resolve(blob);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Imagem inválida'));
    };
    img.src = url;
  });
}

export async function compressImageFileForStorage(file) {
  if (!file?.type?.startsWith('image/')) return file;
  if (file.type === 'image/svg+xml') return file;
  if (file.type === 'image/gif') return file;

  let bestBlob = null;
  for (const step of STEPS) {
    const blob = await fileToJpegBlob(file, step.maxSide, step.q);
    if (blob && blob.size <= TARGET_BLOB_BYTES) {
      return new File([blob], file.name.replace(/\.\w+$/i, '.jpg'), { type: 'image/jpeg' });
    }
    if (blob && (!bestBlob || blob.size < bestBlob.size)) {
      bestBlob = blob;
    }
  }

  if (bestBlob) {
    return new File([bestBlob], file.name.replace(/\.\w+$/i, '.jpg'), { type: 'image/jpeg' });
  }
  return file;
}
