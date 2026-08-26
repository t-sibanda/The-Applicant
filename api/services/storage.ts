import fs from "fs/promises";
import path from "path";
import { env } from "../lib/env";

/**
 * Provider-agnostic object storage. Selects S3 when STORAGE_PROVIDER=s3 and a
 * bucket is configured; otherwise falls back to the local filesystem. The AWS
 * SDK is an optional dependency imported lazily.
 */

export interface StoredFile {
  key: string;
  url?: string;
}

export interface StorageProvider {
  upload(key: string, data: Buffer, contentType: string): Promise<StoredFile>;
  download(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

class LocalProvider implements StorageProvider {
  private dir = env.storage.localDir;

  private full(key: string) {
    // Prevent path traversal.
    const safe = key.replace(/\.\.(\/|\\)/g, "");
    return path.join(this.dir, safe);
  }

  async upload(key: string, data: Buffer): Promise<StoredFile> {
    const target = this.full(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
    return { key };
  }

  async download(key: string): Promise<Buffer> {
    return fs.readFile(this.full(key));
  }

  async remove(key: string): Promise<void> {
    await fs.rm(this.full(key), { force: true });
  }
}

class S3Provider implements StorageProvider {
  private clientPromise = (async () => {
    const mod = await import("@aws-sdk/client-s3");
    const client = new mod.S3Client({
      region: env.storage.s3Region || "us-east-1",
      endpoint: env.storage.s3Endpoint || undefined,
      forcePathStyle: !!env.storage.s3Endpoint,
      credentials: {
        accessKeyId: env.storage.s3AccessKeyId,
        secretAccessKey: env.storage.s3SecretAccessKey,
      },
    });
    return { mod, client };
  })();

  async upload(
    key: string,
    data: Buffer,
    contentType: string,
  ): Promise<StoredFile> {
    const { mod, client } = await this.clientPromise;
    await client.send(
      new mod.PutObjectCommand({
        Bucket: env.storage.s3Bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );
    return { key };
  }

  async download(key: string): Promise<Buffer> {
    const { mod, client } = await this.clientPromise;
    const res = await client.send(
      new mod.GetObjectCommand({ Bucket: env.storage.s3Bucket, Key: key }),
    );
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  async remove(key: string): Promise<void> {
    const { mod, client } = await this.clientPromise;
    await client.send(
      new mod.DeleteObjectCommand({ Bucket: env.storage.s3Bucket, Key: key }),
    );
  }
}

class SupabaseProvider implements StorageProvider {
  private clientPromise = (async () => {
    const mod = await import("@supabase/supabase-js");
    const client = mod.createClient(
      env.storage.supabaseUrl,
      env.storage.supabaseServiceKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    return client;
  })();

  async upload(
    key: string,
    data: Buffer,
    contentType: string,
  ): Promise<StoredFile> {
    const client = await this.clientPromise;
    const { error } = await client.storage
      .from(env.storage.supabaseBucket)
      .upload(key, data, { contentType, upsert: true });
    if (error) throw error;
    return { key };
  }

  async download(key: string): Promise<Buffer> {
    const client = await this.clientPromise;
    const { data, error } = await client.storage
      .from(env.storage.supabaseBucket)
      .download(key);
    if (error) throw error;
    return Buffer.from(await data.arrayBuffer());
  }

  async remove(key: string): Promise<void> {
    const client = await this.clientPromise;
    await client.storage.from(env.storage.supabaseBucket).remove([key]);
  }
}

let provider: StorageProvider | null = null;

export function storageMode(): "s3" | "supabase" | "local" {
  if (env.storage.provider === "s3" && env.storage.s3Bucket) return "s3";
  if (
    env.storage.provider === "supabase" &&
    env.storage.supabaseUrl &&
    env.storage.supabaseServiceKey
  )
    return "supabase";
  return "local";
}

export function getStorage(): StorageProvider {
  if (!provider) {
    const mode = storageMode();
    provider =
      mode === "s3"
        ? new S3Provider()
        : mode === "supabase"
          ? new SupabaseProvider()
          : new LocalProvider();
  }
  return provider;
}
