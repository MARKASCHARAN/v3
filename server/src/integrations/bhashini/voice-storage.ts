import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/error.middleware';

export interface VoiceAssetStorage {
  uploadAudio(params: {
    userId: string;
    sessionId: string;
    audioBase64: string;
    contentType?: string;
    extension?: string;
  }): Promise<{ objectKey: string; signedUrl: string | null }>;
  getSignedAudioUrl(objectKey: string, expiresInSeconds?: number): Promise<string | null>;
}

const VOICE_ASSETS_BUCKET = 'voice-assets';

export class SupabaseVoiceStorage implements VoiceAssetStorage {
  private bucketVerified = false;

  private async ensureBucket(): Promise<void> {
    if (this.bucketVerified) return;
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (!listError && buckets?.some((b) => b.name === VOICE_ASSETS_BUCKET)) {
      this.bucketVerified = true;
      return;
    }

    const { error: createError } = await supabaseAdmin.storage.createBucket(VOICE_ASSETS_BUCKET, {
      public: false,
    });
    if (createError && !createError.message.toLowerCase().includes('already exists')) {
      throw new AppError(
        502,
        `Failed to initialize voice audio storage bucket: ${createError.message}`,
        'STORAGE_BUCKET_ERROR'
      );
    }
    this.bucketVerified = true;
  }

  async uploadAudio(params: {
    userId: string;
    sessionId: string;
    audioBase64: string;
    contentType?: string;
    extension?: string;
  }): Promise<{ objectKey: string; signedUrl: string | null }> {
    await this.ensureBucket();
    const ext = params.extension ?? 'wav';
    const objectKey = `${params.userId}/${params.sessionId}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(params.audioBase64, 'base64');

    const { error: uploadError } = await supabaseAdmin.storage
      .from(VOICE_ASSETS_BUCKET)
      .upload(objectKey, buffer, {
        contentType: params.contentType ?? 'audio/wav',
        upsert: true,
      });

    if (uploadError) {
      throw new AppError(
        502,
        `Failed to upload voice asset: ${uploadError.message}`,
        'STORAGE_UPLOAD_ERROR'
      );
    }

    const signedUrl = await this.getSignedAudioUrl(objectKey);
    return { objectKey, signedUrl };
  }

  async getSignedAudioUrl(
    objectKey: string,
    expiresInSeconds: number = 3600
  ): Promise<string | null> {
    const { data, error } = await supabaseAdmin.storage
      .from(VOICE_ASSETS_BUCKET)
      .createSignedUrl(objectKey, expiresInSeconds);

    if (error || !data?.signedUrl) {
      return null;
    }

    return data.signedUrl;
  }
}

