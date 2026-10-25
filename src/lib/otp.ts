import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";

/** 验证码有效期：10 分钟 */
export const OTP_TTL_MS = 10 * 60 * 1000;
/** 同一个码最多尝试 5 次，超过即作废 */
export const OTP_MAX_ATTEMPTS = 5;

/** 同一个邮箱 60 秒内只能发一次 */
const SEND_COOLDOWN_MS = 60 * 1000;
/** 同一个 IP 每小时最多发 10 次 */
const IP_WINDOW_MS = 60 * 60 * 1000;
const IP_MAX_PER_WINDOW = 10;

// 限流状态只在内存里：P0 是单实例，够用；多实例部署前必须换成 Redis 之类的共享存储，
// 否则每个实例各限各的，等于放宽了上限（见 DECISIONS D-014 的遗留说明）。
const lastSentAt = new Map<string, number>();
const ipHits = new Map<string, { count: number; windowStart: number }>();
let opsSinceSweep = 0;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** 生成 6 位数字验证码（含前导零） */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function digest(salt: string, code: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

/**
 * 把验证码变成可入库的 hash：`<salt>:<sha256>`。
 * 6 位数字只有 100 万种可能，裸 sha256 可被反查，所以每条都带独立随机 salt。
 */
export function hashCode(code: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${digest(salt, code)}`;
}

/** 常数时间比对，避免按字节提前返回泄漏信息 */
export function verifyHash(stored: string, code: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  const actual = Buffer.from(digest(salt, code), "hex");
  const expected = Buffer.from(hash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export type SendGuard =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number; message: string };

/** 发码前的限流检查：同邮箱 60 秒冷却 + 同 IP 每小时 10 次 */
export function checkSendRate(email: string, ip: string): SendGuard {
  const now = Date.now();

  const last = lastSentAt.get(normalizeEmail(email));
  if (last !== undefined && now - last < SEND_COOLDOWN_MS) {
    const retryAfterSeconds = Math.ceil((SEND_COOLDOWN_MS - (now - last)) / 1000);
    return {
      ok: false,
      retryAfterSeconds,
      message: `发送太频繁，请 ${retryAfterSeconds} 秒后再试`,
    };
  }

  const hit = ipHits.get(ip);
  if (hit && now - hit.windowStart < IP_WINDOW_MS && hit.count >= IP_MAX_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((IP_WINDOW_MS - (now - hit.windowStart)) / 1000);
    return {
      ok: false,
      retryAfterSeconds,
      message: "该网络发送次数过多，请一小时后再试",
    };
  }

  return { ok: true };
}

/** 记账（只在邮件真的发出去之后调用，发信失败不该占用冷却） */
export function recordSend(email: string, ip: string): void {
  const now = Date.now();
  lastSentAt.set(normalizeEmail(email), now);

  const hit = ipHits.get(ip);
  if (!hit || now - hit.windowStart >= IP_WINDOW_MS) {
    ipHits.set(ip, { count: 1, windowStart: now });
  } else {
    hit.count += 1;
  }

  sweep(now);
}

/** 顺手清理过期条目，避免长跑进程里 Map 无限增长 */
function sweep(now: number): void {
  if (++opsSinceSweep % 100 !== 0) return;
  for (const [key, sentAt] of lastSentAt) {
    if (now - sentAt > SEND_COOLDOWN_MS) lastSentAt.delete(key);
  }
  for (const [key, hit] of ipHits) {
    if (now - hit.windowStart > IP_WINDOW_MS) ipHits.delete(key);
  }
}

/** 生成验证码并入库（明文只返回给调用方用于发信，绝不落库、不进响应） */
export async function issueCode(emailRaw: string): Promise<string> {
  const email = normalizeEmail(emailRaw);
  const code = generateCode();

  // 同一邮箱只保留最新一条，旧码立即失效，避免多码并存
  await prisma.emailCode.deleteMany({ where: { email } });
  await prisma.emailCode.create({
    data: {
      email,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  return code;
}

export type VerifyResult = { ok: true; email: string; userId: string } | { ok: false };

/**
 * 校验验证码，通过则消费掉并 upsert 用户。
 * 任何失败原因（无记录 / 过期 / 试错超限 / hash 不匹配）都只返回 { ok: false }，
 * 调用方一律回同一句提示，不泄漏是哪一种。
 */
export async function verifyCodeAndUpsertUser(
  emailRaw: string,
  code: string,
): Promise<VerifyResult> {
  const email = normalizeEmail(emailRaw);

  const record = await prisma.emailCode.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return { ok: false };

  if (record.expiresAt.getTime() <= Date.now() || record.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.emailCode.deleteMany({ where: { email } });
    return { ok: false };
  }

  if (!verifyHash(record.codeHash, code)) {
    const updated = await prisma.emailCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    // 第 5 次错完立刻作废，别把机会留到下一次
    if (updated.attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.emailCode.deleteMany({ where: { email } });
    }
    return { ok: false };
  }

  // 成功：码是一次性的，先消费再建用户
  await prisma.emailCode.deleteMany({ where: { email } });

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    // 能收到验证码即证明拥有该邮箱
    create: { email, emailVerified: new Date() },
  });

  return { ok: true, email, userId: user.id };
}