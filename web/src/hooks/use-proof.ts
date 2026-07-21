import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { MAX_PROOF_SIZE_BYTES, PROOF_ASSETS_BUCKET, type ProofAsset } from '@/lib/proof';
import { supabase } from '@/lib/supabase';

function proofAssetsQueryKey(betId: string | undefined) {
  return ['proof-assets', betId] as const;
}

/** Proof images for a bet (SOC-04), each resolved to a short-lived signed
 * URL -- the bucket is private (SOC-05), so there's no other way to view
 * one. createSignedUrls batches this into one request rather than one round
 * trip per image. */
export function useProofAssets(betId: string | undefined) {
  const assetsQuery = useQuery({
    queryKey: proofAssetsQueryKey(betId),
    queryFn: async (): Promise<ProofAsset[]> => {
      const { data, error } = await supabase
        .from('proof_assets')
        .select('*')
        .eq('bet_id', betId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!betId,
  });

  const paths = useMemo(
    () => (assetsQuery.data ?? []).map((a) => a.storage_path),
    [assetsQuery.data],
  );

  const signedUrlsQuery = useQuery({
    queryKey: ['proof-signed-urls', paths],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(PROOF_ASSETS_BUCKET)
        .createSignedUrls(paths, 3600);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const item of data) {
        if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
      }
      return map;
    },
    enabled: paths.length > 0,
  });

  const assets = useMemo(
    () =>
      (assetsQuery.data ?? []).map((asset) => ({
        asset,
        signedUrl: signedUrlsQuery.data?.get(asset.storage_path),
      })),
    [assetsQuery.data, signedUrlsQuery.data],
  );

  return {
    assets,
    isLoading: assetsQuery.isLoading || signedUrlsQuery.isLoading,
  };
}

/** Resizes to max 1600px wide and re-encodes as JPEG at 0.7 quality via
 * Canvas -- the web equivalent of the native app's expo-image-manipulator
 * pipeline (same target dimensions/quality, different underlying API). */
function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, 1600 / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Failed to compress image'))),
        'image/jpeg',
        0.7,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };
    img.src = objectUrl;
  });
}

/** Pick (via a native file input) -> compress client-side -> upload to the
 * private bucket -> register the metadata row, all in one action (SOC-04/05). */
export function useUploadProof(betId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { file: File; caption: string | undefined }) => {
      if (!betId || !userId) throw new Error('not ready yet');

      const compressed = await compressImage(input.file);
      const arrayBuffer = await compressed.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_PROOF_SIZE_BYTES) {
        throw new Error('Image is too large even after compression');
      }

      const path = `${betId}/${userId}-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from(PROOF_ASSETS_BUCKET)
        .upload(path, arrayBuffer, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase.rpc('upload_proof', {
        p_bet_id: betId,
        p_storage_path: path,
        p_mime_type: 'image/jpeg',
        p_size_bytes: arrayBuffer.byteLength,
        p_caption: input.caption ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: proofAssetsQueryKey(betId) }),
  });
}
