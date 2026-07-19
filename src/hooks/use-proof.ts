import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
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

/** Pick -> compress client-side -> upload to the private bucket -> register
 * the metadata row, all in one action (SOC-04/05). Resolves to null if the
 * user cancels the picker, so the caller can no-op rather than show an
 * error. */
export function useUploadProof(betId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (caption: string | undefined) => {
      if (!betId || !userId) throw new Error('not ready yet');

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Photo library access is needed to attach proof');
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (picked.canceled || picked.assets.length === 0) {
        return null;
      }
      const pickedAsset = picked.assets[0];

      const context = ImageManipulator.manipulate(pickedAsset.uri);
      context.resize({ width: 1600 });
      const rendered = await context.renderAsync();
      const compressed = await rendered.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.7,
      });

      const arrayBuffer = await fetch(compressed.uri).then((res) => res.arrayBuffer());
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
        p_caption: caption ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data) queryClient.invalidateQueries({ queryKey: proofAssetsQueryKey(betId) });
    },
  });
}
