import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Camera } from '@capacitor/camera';

import { chooseNativeProofPhoto, takeNativeProofPhoto } from './native-photo';

vi.mock('@capacitor/camera', () => ({
  Camera: { takePhoto: vi.fn(), chooseFromGallery: vi.fn() },
}));

const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    blob: () => Promise.resolve(new Blob(['fake-image-bytes'], { type: 'image/jpeg' })),
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('takeNativeProofPhoto', () => {
  it('converts the camera result into a File', async () => {
    vi.mocked(Camera.takePhoto).mockResolvedValue({
      webPath: 'capacitor://localhost/photo.jpeg',
      saved: false,
      metadata: { format: 'jpeg' },
    } as never);

    const file = await takeNativeProofPhoto();

    expect(file).toBeInstanceOf(File);
    expect(file?.name).toBe('proof.jpeg');
    expect(file?.type).toBe('image/jpeg');
    expect(global.fetch).toHaveBeenCalledWith('capacitor://localhost/photo.jpeg');
  });

  it('returns undefined instead of throwing when the user cancels', async () => {
    vi.mocked(Camera.takePhoto).mockRejectedValue(new Error('User cancelled photos app'));

    await expect(takeNativeProofPhoto()).resolves.toBeUndefined();
  });

  it('returns undefined when the result has no webPath', async () => {
    vi.mocked(Camera.takePhoto).mockResolvedValue({ saved: false } as never);

    await expect(takeNativeProofPhoto()).resolves.toBeUndefined();
  });
});

describe('chooseNativeProofPhoto', () => {
  it('converts the first gallery result into a File', async () => {
    vi.mocked(Camera.chooseFromGallery).mockResolvedValue({
      results: [
        { webPath: 'capacitor://localhost/gallery.png', saved: false, metadata: { format: 'png' } },
      ],
    } as never);

    const file = await chooseNativeProofPhoto();

    expect(Camera.chooseFromGallery).toHaveBeenCalledWith({ allowMultipleSelection: false });
    expect(file?.name).toBe('proof.png');
  });

  it('returns undefined when the user cancels the gallery picker', async () => {
    vi.mocked(Camera.chooseFromGallery).mockRejectedValue(new Error('User cancelled'));

    await expect(chooseNativeProofPhoto()).resolves.toBeUndefined();
  });

  it('returns undefined when no results come back', async () => {
    vi.mocked(Camera.chooseFromGallery).mockResolvedValue({ results: [] } as never);

    await expect(chooseNativeProofPhoto()).resolves.toBeUndefined();
  });
});
