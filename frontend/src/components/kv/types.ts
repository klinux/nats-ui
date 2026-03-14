import { z } from 'zod';

export const kvSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  value: z.string().min(1, 'Value is required'),
});

export const bucketSchema = z.object({
  name: z.string().min(1, 'Bucket name is required').regex(/^[a-zA-Z0-9_-]+$/, 'Invalid bucket name'),
  ttl: z.number().optional(),
});

export type KVFormData = z.infer<typeof kvSchema>;
export type BucketFormData = z.infer<typeof bucketSchema>;

export interface KVEntry {
  key: string;
  value: string;
  revision: number;
  created: Date;
  updated: Date;
  bucket: string;
}
