import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { chmodSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface Device {
  id: string;
  name: string;
  role: "owner" | "controller";
  tokenHash: string;
  createdAt: string;
  revokedAt?: string;
}
interface AuthState { version: 1; ownerToken: string; devices: Device[] }
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

/** Private local credential storage. Only hashes of controller tokens are retained. */
export class DeviceAuth {
  readonly #path: string;
  readonly #directory: string;
  #state: AuthState;
  #faulted = false;

  constructor(directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    chmodSync(directory, 0o700);
    this.#directory = directory;
    this.#path = join(directory, "devices.json");
    if (existsSync(this.#path)) {
      if (!lstatSync(this.#path).isFile() || lstatSync(this.#path).isSymbolicLink()) throw new Error("Device store must be a regular file");
      const state = JSON.parse(readFileSync(this.#path, "utf8")) as AuthState;
      if (state.version !== 1 || typeof state.ownerToken !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(state.ownerToken) || !Array.isArray(state.devices)
        || state.devices.length > 100 || state.devices.some(device => !device || typeof device.id !== "string" || typeof device.name !== "string"
          || !["owner", "controller"].includes(device.role) || !/^[0-9a-f]{64}$/.test(device.tokenHash) || typeof device.createdAt !== "string"
          || (device.revokedAt !== undefined && typeof device.revokedAt !== "string"))
        || new Set(state.devices.map(device => device.id)).size !== state.devices.length
        || state.devices.filter(device => device.role === "owner" && !device.revokedAt && device.tokenHash === hash(state.ownerToken)).length !== 1
        || state.devices.filter(device => device.role === "owner").length !== 1) throw new Error("Unsupported device store");
      this.#state = state;
      chmodSync(this.#path, 0o600);
    } else {
      const ownerToken = randomBytes(32).toString("base64url");
      this.#state = { version: 1, ownerToken, devices: [{ id: randomUUID(), name: "This Mac", role: "owner", tokenHash: hash(ownerToken), createdAt: new Date().toISOString() }] };
      this.#save();
    }
  }

  get ownerToken(): string { return this.#state.ownerToken; }
  authenticate(token: string | undefined): Device | undefined {
    if (this.#faulted || !token || token.length > 256) return undefined;
    const digest = Buffer.from(hash(token), "hex");
    const found = this.#state.devices.find(device => !device.revokedAt && /^[0-9a-f]{64}$/.test(device.tokenHash)
      && timingSafeEqual(digest, Buffer.from(device.tokenHash, "hex")));
    return found ? { ...found } : undefined;
  }
  list(): Omit<Device, "tokenHash">[] { return this.#state.devices.map(({ tokenHash: _secret, ...device }) => ({ ...device })); }
  issue(name: string): { device: Omit<Device, "tokenHash">; token: string } {
    if (!name.trim() || name.length > 100) throw new Error("Device name must contain 1–100 characters");
    if (this.#state.devices.length >= 100) throw new Error("Device registry capacity reached");
    const token = randomBytes(32).toString("base64url");
    const created: Device = { id: randomUUID(), name: name.trim(), role: "controller", tokenHash: hash(token), createdAt: new Date().toISOString() };
    this.#state.devices.push(created);
    try { this.#save(); } catch (error) { this.#faulted = true; throw error; }
    const { tokenHash: _hash, ...device } = created;
    return { device, token };
  }
  revoke(id: string): void {
    const device = this.#state.devices.find(item => item.id === id);
    if (!device) throw new Error("Device not found");
    if (device.role === "owner") throw new Error("The local owner cannot be revoked through the controller API");
    if (device.revokedAt) return;
    device.revokedAt = new Date().toISOString();
    try { this.#save(); } catch (error) { this.#faulted = true; throw error; }
  }
  #save(): void {
    const temp = `${this.#path}.${randomUUID()}.tmp`;
    try {
      const fd = openSync(temp, "wx", 0o600);
      try { writeFileSync(fd, JSON.stringify(this.#state)); fsyncSync(fd); } finally { closeSync(fd); }
      renameSync(temp, this.#path);
      const directoryFd = openSync(this.#directory, "r");
      try { fsyncSync(directoryFd); } finally { closeSync(directoryFd); }
    } finally { try { unlinkSync(temp); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } }
  }
}
