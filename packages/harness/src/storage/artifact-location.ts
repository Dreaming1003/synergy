import { z } from "zod"

export const ArtifactLocation = z
  .object({
    pack: z.string().regex(/^(?:[a-f0-9]{64}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.pack$/),
    blockOffset: z.number().int().nonnegative().safe(),
    blockBytes: z
      .number()
      .int()
      .nonnegative()
      .max(32 * 1024 * 1024),
    decodedBytes: z
      .number()
      .int()
      .nonnegative()
      .max(32 * 1024 * 1024),
    offset: z.number().int().nonnegative().safe(),
    size: z
      .number()
      .int()
      .nonnegative()
      .max(32 * 1024 * 1024),
    codec: z.enum(["raw", "gzip"]),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .refine(
    (value) =>
      value.offset + value.size <= value.decodedBytes &&
      (value.codec !== "raw" || value.blockBytes === value.decodedBytes),
    "Artifact byte bounds are invalid",
  )
export type ArtifactLocation = z.infer<typeof ArtifactLocation>
