import { api } from './client';

// A phone photo is several megabytes and far larger than a category card ever
// needs, so shrink it in the browser before it goes anywhere. This keeps the
// upload inside the serverless request limit and the stored row small.
const MAX_SIDE = 720;
const QUALITY = 0.82;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('تعذر قراءة الصورة'));
    };
    img.src = url;
  });
}

async function shrink(file: File): Promise<Blob> {
  // An animated GIF would lose its animation on a canvas, so pass it through.
  if (file.type === 'image/gif') return file;

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', QUALITY));
  // Only take the re-encoded version when it actually came out smaller.
  return blob && blob.size < file.size ? blob : file;
}

/** Uploads a picture chosen on the admin's device and returns its URL. */
export async function uploadImage(file: File): Promise<string> {
  const blob = await shrink(file);
  const { data } = await api.post('/uploads', blob, {
    headers: { 'Content-Type': blob.type || file.type },
  });
  return data.url as string;
}
