import fs from "node:fs/promises"
import path from "node:path"
import { SnapshotGit } from "./snapshot-git"

export namespace SnapshotPack {
  export async function loose(repository: string, options: { apply?: boolean; signal?: AbortSignal } = {}) {
    const objects = path.join(repository, "objects")
    for (const directory of [objects, path.join(objects, "pack")]) {
      const stat = await fs.lstat(directory).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return undefined
        throw error
      })
      if (stat && (!stat.isDirectory() || stat.isSymbolicLink()))
        throw new Error("Snapshot object directories must be local directories")
    }
    const inventory: string[] = []
    let allocatedBytes = 0
    let bytes = 0
    for (const directory of await fs.readdir(objects, { withFileTypes: true })) {
      if (!directory.isDirectory() || !/^[0-9a-f]{2}$/.test(directory.name)) continue
      const entries = await fs.readdir(path.join(objects, directory.name), { withFileTypes: true })
      for (let offset = 0; offset < entries.length; offset += 64) {
        options.signal?.throwIfAborted()
        await Promise.all(
          entries.slice(offset, offset + 64).map(async (entry) => {
            if (!entry.isFile() || !/^[0-9a-f]{38}$/.test(entry.name)) return
            const stat = await fs.stat(path.join(objects, directory.name, entry.name))
            inventory.push(directory.name + entry.name)
            bytes += stat.size
            allocatedBytes += stat.blocks * 512
          }),
        )
      }
    }
    const before = { objects: inventory.length, bytes, allocatedBytes }
    if (!options.apply || !inventory.length)
      return { applied: false, packedObjects: 0, before, packBytes: 0, freedBytes: 0 }
    const directory = await fs.mkdtemp(path.join(repository, "synergy-pack-"))
    try {
      const input = path.join(directory, "objects")
      await fs.writeFile(input, inventory.join("\n") + "\n", { mode: 0o600 })
      await fs.mkdir(path.join(objects, "pack"), { recursive: true, mode: 0o700 })
      // Provenance: https://git-scm.com/docs/git-pack-objects and https://git-scm.com/docs/git-prune-packed
      // Local adaptation: enumerate local loose IDs, including unreferenced evidence, verify the complete pack,
      // then remove only loose copies duplicated in packs; alternate stores and existing packs stay untouched.
      const hash = await SnapshotGit.checked(
        repository,
        ["pack-objects", "--non-empty", "--threads=2", path.join(objects, "pack", "pack")],
        { ...options, input },
      )
      if (!/^[0-9a-f]{40}$/.test(hash)) throw new Error("Snapshot packing did not return a valid pack identity")
      const pack = path.join(objects, "pack", "pack-" + hash)
      await Promise.all([fs.chmod(pack + ".idx", 0o600), fs.chmod(pack + ".pack", 0o600)])
      await SnapshotGit.checked(repository, ["verify-pack", pack + ".idx"], options)
      const packed = new Set<string>()
      for await (const line of SnapshotGit.lines(repository, ["verify-pack", "-v", pack + ".idx"], options)) {
        const oid = line.split(" ")[0]
        if (/^[0-9a-f]{40}$/.test(oid)) packed.add(oid)
      }
      if (inventory.some((oid) => !packed.has(oid))) throw new Error("Verified snapshot pack omitted a loose object")
      for (const suffix of [".pack", ".idx"]) {
        const file = await fs.open(pack + suffix, "r")
        try {
          await file.sync()
        } finally {
          await file.close()
        }
      }
      if (process.platform !== "win32") {
        const parent = await fs.open(path.dirname(pack), "r")
        try {
          await parent.sync()
        } finally {
          await parent.close()
        }
      }
      await SnapshotGit.checked(repository, ["prune-packed"], options)
      const stats = await Promise.all([fs.stat(pack + ".pack"), fs.stat(pack + ".idx")])
      const packBytes = stats.reduce((sum, stat) => sum + stat.blocks * 512, 0)
      return {
        applied: true,
        packedObjects: inventory.length,
        before,
        packBytes,
        freedBytes: Math.max(0, allocatedBytes - packBytes),
      }
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  }
}
