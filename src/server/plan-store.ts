import { pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { createClient, type RedisClientType } from "redis";

import type { Guest, PlannerState, TableShape, WeddingTable } from "@/planner/types";
import { sanitizeAssignments } from "@/planner/utils";

const hashPassword = promisify(pbkdf2);
const PASSWORD_ITERATIONS = 210_000;
const PASSWORD_KEY_LENGTH = 32;
const PLAN_ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const PLAN_ID_LENGTH = 10;
const PLAN_KEY_PREFIX = "plan:";
const RESERVED_PLAN_IDS = new Set(["api", "_next", "favicon.ico"]);

type PasswordHash = {
  algorithm: "pbkdf2-sha256";
  hash: string;
  iterations: number;
  salt: string;
};

export type PlanRecord = {
  createdAt: string;
  id: string;
  name: string;
  password?: PasswordHash;
  rev: number;
  state: PlannerState;
  updatedAt: string;
  version: 1;
};

export type PublicPlan = {
  createdAt: string;
  id: string;
  name: string;
  protected: boolean;
  rev: number;
  state: PlannerState;
  updatedAt: string;
};

export type PasswordCheck = "ok" | "required" | "invalid";

type SaveResult =
  | { status: "saved"; record: PlanRecord }
  | { status: "conflict"; record: PlanRecord }
  | { status: "missing" };

type PlanPatch = {
  name: string;
  state: PlannerState;
};

type PasswordPatch =
  | { action: "keep" }
  | { action: "set"; password: string }
  | { action: "clear" };

type CreatePlanInput = PlanPatch & {
  id?: string;
};

let redisClientPromise: Promise<RedisClientType> | null = null;

const saveScript = `
local key = KEYS[1]
local expected = tonumber(ARGV[1])
local next = ARGV[2]
local current = redis.call("GET", key)
if not current then
  return {"missing"}
end
local decoded = cjson.decode(current)
if tonumber(decoded.rev) ~= expected then
  return {"conflict", current}
end
redis.call("SET", key, next)
return {"saved", next}
`;

export class PlanStoreConfigError extends Error {
  constructor() {
    super("Redis is not configured. Set REDIS_URL.");
  }
}

export class PlanSlugUnavailableError extends Error {
  constructor(readonly slug: string) {
    super(`Plan slug is already in use: ${slug}`);
  }
}

export class PlanInvalidSlugError extends Error {
  constructor() {
    super("Plan slug is invalid.");
  }
}

export function toPublicPlan(record: PlanRecord): PublicPlan {
  return {
    createdAt: record.createdAt,
    id: record.id,
    name: record.name,
    protected: Boolean(record.password),
    rev: record.rev,
    state: record.state,
    updatedAt: record.updatedAt,
  };
}

export function parsePlannerState(value: unknown): PlannerState | null {
  if (!isRecord(value) || !Array.isArray(value.tables) || !Array.isArray(value.guests) || !isStringRecord(value.assignments)) {
    return null;
  }

  const tables = value.tables.map(parseTable);
  const guests = value.guests.map(parseGuest);
  if (tables.some((table) => !table) || guests.some((guest) => !guest)) return null;

  return sanitizeAssignments({
    assignments: value.assignments,
    guests: guests as Guest[],
    tables: tables as WeddingTable[],
  });
}

export async function createPlan({ id: requestedId, name, state }: CreatePlanInput, password: string | undefined) {
  const redis = await getRedis();
  const now = new Date().toISOString();
  const normalizedId = requestedId === undefined ? undefined : normalizePlanSlug(requestedId);

  if (requestedId !== undefined && !normalizedId) throw new PlanInvalidSlugError();

  const candidateIds = normalizedId ? [normalizedId] : Array.from({ length: 5 }, () => createPlanId());

  for (const id of candidateIds) {
    const record: PlanRecord = {
      createdAt: now,
      id,
      name: normalizePlanName(name),
      password: password?.trim() ? await createPasswordHash(password) : undefined,
      rev: 1,
      state,
      updatedAt: now,
      version: 1,
    };

    const created = await redis.set(planKey(id), serializePlan(record), { NX: true });
    if (created === "OK") return record;
  }

  if (normalizedId) throw new PlanSlugUnavailableError(normalizedId);
  throw new Error("Could not allocate a unique plan id.");
}

export async function getPlan(id: string) {
  if (!isValidPlanId(id)) return null;
  const redis = await getRedis();
  const raw = await redis.get(planKey(id));
  return parsePlanRecord(raw);
}

export async function checkPlanPassword(record: PlanRecord, password: string | undefined): Promise<PasswordCheck> {
  if (!record.password) return "ok";
  if (!password) return "required";
  return (await verifyPassword(password, record.password)) ? "ok" : "invalid";
}

export async function savePlan(
  id: string,
  baseRev: number,
  { name, state }: PlanPatch,
  passwordPatch: PasswordPatch = { action: "keep" },
): Promise<SaveResult> {
  const current = await getPlan(id);
  if (!current) return { status: "missing" };

  const next: PlanRecord = {
    ...current,
    name: normalizePlanName(name),
    password: await resolvePasswordPatch(current.password, passwordPatch),
    rev: current.rev + 1,
    state,
    updatedAt: new Date().toISOString(),
  };

  const redis = await getRedis();
  const result = (await redis.sendCommand(["EVAL", saveScript, "1", planKey(id), String(baseRev), serializePlan(next)])) as unknown;
  if (!Array.isArray(result) || typeof result[0] !== "string") throw new Error("Unexpected Redis save response.");
  if (result[0] === "missing") return { status: "missing" };

  const record = parsePlanRecord(result[1]);
  if (!record) throw new Error("Unexpected Redis plan payload.");
  if (result[0] === "conflict") return { status: "conflict", record };
  return { status: "saved", record };
}

export function isPlanStoreConfigError(error: unknown): error is PlanStoreConfigError {
  return error instanceof PlanStoreConfigError;
}

async function getRedis() {
  if (redisClientPromise) return redisClientPromise;

  const url = process.env.REDIS_URL;
  if (!url) throw new PlanStoreConfigError();

  redisClientPromise = createClient({ url })
    .on("error", (error) => {
      console.error("Redis client error", error);
    })
    .connect() as Promise<RedisClientType>;
  return redisClientPromise;
}

function parsePlanRecord(value: unknown): PlanRecord | null {
  if (typeof value !== "string") return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed) || parsed.version !== 1 || typeof parsed.id !== "string") return null;
    const rev = typeof parsed.rev === "number" && Number.isInteger(parsed.rev) ? parsed.rev : null;
    if (rev === null) return null;
    if (typeof parsed.createdAt !== "string" || typeof parsed.updatedAt !== "string") return null;
    const name = typeof parsed.name === "string" ? parsed.name : "Untitled plan";
    const state = parsePlannerState(parsed.state);
    if (!state) return null;

    const password = parsePasswordHash(parsed.password);
    if (parsed.password !== undefined && !password) return null;

    return {
      createdAt: parsed.createdAt,
      id: parsed.id,
      name,
      password,
      rev,
      state,
      updatedAt: parsed.updatedAt,
      version: 1,
    };
  } catch {
    return null;
  }
}

function parsePasswordHash(value: unknown): PasswordHash | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return undefined;
  if (value.algorithm !== "pbkdf2-sha256") return undefined;
  const iterations = typeof value.iterations === "number" && Number.isInteger(value.iterations) ? value.iterations : null;
  if (iterations === null || typeof value.salt !== "string" || typeof value.hash !== "string") return undefined;
  return {
    algorithm: "pbkdf2-sha256",
    hash: value.hash,
    iterations,
    salt: value.salt,
  };
}

function parseTable(value: unknown): WeddingTable | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.name !== "string" || !isTableShape(value.shape)) return null;

  const roundSeats = parseNonNegativeInteger(value.roundSeats);
  const topSeats = parseNonNegativeInteger(value.topSeats);
  const rightSeats = parseNonNegativeInteger(value.rightSeats);
  const bottomSeats = parseNonNegativeInteger(value.bottomSeats);
  const leftSeats = parseNonNegativeInteger(value.leftSeats);
  if ([roundSeats, topSeats, rightSeats, bottomSeats, leftSeats].some((count) => count === null)) return null;

  return {
    bottomSeats: bottomSeats!,
    id: value.id,
    leftSeats: leftSeats!,
    name: value.name,
    rightSeats: rightSeats!,
    roundSeats: roundSeats!,
    shape: value.shape,
    topSeats: topSeats!,
  };
}

function parseGuest(value: unknown): Guest | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.name !== "string" || typeof value.group !== "string" || typeof value.dietary !== "string") {
    return null;
  }
  return {
    dietary: value.dietary,
    group: value.group,
    id: value.id,
    name: value.name,
  };
}

async function createPasswordHash(password: string): Promise<PasswordHash> {
  const salt = randomBytes(16);
  const hash = await hashPassword(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, "sha256");
  return {
    algorithm: "pbkdf2-sha256",
    hash: hash.toString("base64url"),
    iterations: PASSWORD_ITERATIONS,
    salt: salt.toString("base64url"),
  };
}

async function verifyPassword(password: string, passwordHash: PasswordHash) {
  const salt = Buffer.from(passwordHash.salt, "base64url");
  const expected = Buffer.from(passwordHash.hash, "base64url");
  const actual = await hashPassword(password, salt, passwordHash.iterations, expected.length, "sha256");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function serializePlan(record: PlanRecord) {
  return JSON.stringify(record);
}

function normalizePlanName(name: string) {
  return name.trim() || "Untitled plan";
}

async function resolvePasswordPatch(currentPassword: PasswordHash | undefined, patch: PasswordPatch) {
  if (patch.action === "keep") return currentPassword;
  if (patch.action === "clear") return undefined;
  return createPasswordHash(patch.password);
}

function normalizePlanSlug(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  if (!normalized || !isValidPlanId(normalized)) return "";
  return normalized;
}

function planKey(id: string) {
  return `${PLAN_KEY_PREFIX}${id}`;
}

function createPlanId() {
  const bytes = randomBytes(PLAN_ID_LENGTH);
  let id = "";
  for (const byte of bytes) {
    id += PLAN_ID_ALPHABET[byte % PLAN_ID_ALPHABET.length];
  }
  return id;
}

function isValidPlanId(value: string) {
  return /^[A-Za-z0-9_-]{3,64}$/.test(value) && !RESERVED_PLAN_IDS.has(value.toLowerCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}

function isTableShape(value: unknown): value is TableShape {
  return value === "round" || value === "rectangular";
}

function parseNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}
