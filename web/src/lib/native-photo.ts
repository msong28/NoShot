import { Camera } from '@capacitor/camera';
import type { MediaResult } from '@capacitor/camera';

/** Capacitor's modern Camera API returns a MediaResult with a `webPath`
 * (not a File) -- the rest of the proof-upload pipeline
 * (handleSelectProofFile, uploadProof) already works in terms of a plain
 * browser File, so this is the one conversion point, not a rewrite of that
 * pipeline. `fetch()` on a webPath works both in a Capacitor WebView and
 * in a plain browser tab. */
async function mediaResultToFile(media: MediaResult): Promise<File | undefined> {
  if (!media.webPath) return undefined;
  const response = await fetch(media.webPath);
  const blob = await response.blob();
  const format = media.metadata?.format ?? 'jpeg';
  const mimeType = blob.type || `image/${format}`;
  return new File([blob], `proof.${format}`, { type: mimeType });
}

/** Both reject with a real Error when the user backs out of the native
 * picker/camera sheet (e.g. "User cancelled photos app") -- that's a normal
 * dismissal, not a failure, so callers should treat `undefined` the same
 * as "no file chosen" from the web file-input path rather than surfacing
 * an error banner for it. */
export async function takeNativeProofPhoto(): Promise<File | undefined> {
  try {
    const result = await Camera.takePhoto({ quality: 80 });
    return await mediaResultToFile(result);
  } catch {
    return undefined;
  }
}

export async function chooseNativeProofPhoto(): Promise<File | undefined> {
  try {
    const { results } = await Camera.chooseFromGallery({ allowMultipleSelection: false });
    return results[0] ? await mediaResultToFile(results[0]) : undefined;
  } catch {
    return undefined;
  }
}
