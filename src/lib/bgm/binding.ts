import { prisma } from "@/lib/db";
import {
  BGM_TOKEN_EXPIRES_IN_SECONDS,
  getCollectionTotal,
  getMyself,
  type BgmError,
} from "@/lib/bgm/api";

/**
 * Bangumi 绑定关系的读写（P0-04）
 *
 * 为什么没有 Auth.js adapter：见 DECISIONS D-014（PrismaAdapter 与 Prisma 7 不兼容），
 * 所以 accounts 表的每一条 bangumi 记录都只有本文件这一个写入方 —— 没有第二条路径
 * 会替我们落库。access_token / refresh_token 只在这里进出，永不进客户端。
 */

export const BGM_PROVIDER = "bangumi";

/** 绑定结果：taken = 该 Bangumi 账号已属于另一个本站用户 */
export type BindOutcome =
  | { ok: true }
  | { ok: false; reason: "taken" | "db"; message: string };

export type BindInput = {
  /** 本站 users.id */
  userId: string;
  /** Bangumi 数字用户 id，转成字符串存 providerAccountId */
  bgmUserId: number;
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
  tokenType?: string;
  scope?: string;
};

/**
 * 写入/更新绑定。provider_account_id 存 Bangumi 的数字 id（字符串形式），
 * 7 天有效期写进 expires_at（秒级 unix 时间戳，与 Auth.js 约定一致）。
 * 一个本站用户只保留一条 bangumi 记录：换绑别的 Bangumi 号时先删旧的。
 */
export async function bindBangumiAccount(input: BindInput): Promise<BindOutcome> {
  const providerAccountId = String(input.bgmUserId);

  try {
    const existing = await prisma.account.findUnique({
      where: { provider_providerAccountId: { provider: BGM_PROVIDER, providerAccountId } },
      select: { userId: true },
    });
    if (existing && existing.userId !== input.userId) {
      return { ok: false, reason: "taken", message: "该 Bangumi 账号已绑定到另一个本站账号" };
    }

    // expires_in 理论上恒为 604800；拿到异常值也不让 token 变成永不过期
    const expiresIn =
      Number.isFinite(input.expiresIn) && input.expiresIn > 0
        ? input.expiresIn
        : BGM_TOKEN_EXPIRES_IN_SECONDS;
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    const tokenFields = {
      access_token: input.accessToken,
      refresh_token: input.refreshToken ?? null,
      expires_at: expiresAt,
      token_type: input.tokenType ?? "Bearer",
      scope: input.scope ?? null,
    };

    await prisma.$transaction([
      // 同一用户只允许一条 bangumi account：换绑时清掉旧的那条
      prisma.account.deleteMany({
        where: { userId: input.userId, provider: BGM_PROVIDER, NOT: { providerAccountId } },
      }),
      prisma.account.upsert({
        where: { provider_providerAccountId: { provider: BGM_PROVIDER, providerAccountId } },
        create: {
          userId: input.userId,
          type: "oauth",
          provider: BGM_PROVIDER,
          providerAccountId,
          ...tokenFields,
        },
        update: tokenFields,
      }),
    ]);

    return { ok: true };
  } catch (error) {
    // 不把可能含连接串/数据的原始错误抛给页面，只在本轮开发里保留简短信息
    return {
      ok: false,
      reason: "db",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** 解绑：只删当前用户那条，不碰别人的 */
export async function unbindBangumiAccount(userId: string): Promise<BindOutcome> {
  try {
    await prisma.account.deleteMany({ where: { userId, provider: BGM_PROVIDER } });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: "db",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// 设置页展示用
// ---------------------------------------------------------------------------

export type BangumiCard =
  | { status: "unbound" }
  | {
      status: "linked";
      nickname: string;
      username: string;
      avatarUrl?: string;
      /** null = 收藏总数没取到（不影响绑定本身） */
      collectionTotal: number | null;
    }
  | { status: "expired"; message: string }
  | { status: "error"; message: string };

/**
 * 5 分钟进程内缓存：/settings 每次渲染都要打两次 Bangumi API，刷新几次就会撞限流。
 *
 * 键是「accounts 行 id + expires_at」而不是 userId —— 解绑会删掉整行、重新绑定会换
 * expires_at，键随之变化，缓存在解绑/换绑后自动失效。不能只按 userId 缓存：route handler
 * 与 page 可能在不同模块实例里（dev 下实测就是），手动清缓存根本清不到另一份 Map，
 * 会出现「解绑后页面还显示已绑定」。
 * 多实例下各缓存各的（与 T-009 同类局限，P0 单实例够用）。
 */
const CARD_CACHE_TTL_MS = 5 * 60 * 1000;
const cardCache = new Map<string, { card: BangumiCard; at: number }>();

export async function getBangumiCard(userId: string): Promise<BangumiCard> {
  const now = Date.now();

  // 先查库：解绑后这一行没了，缓存再新也不能用
  const account = await prisma.account.findFirst({
    where: { userId, provider: BGM_PROVIDER },
    select: { id: true, access_token: true, expires_at: true },
  });

  if (!account) return { status: "unbound" };

  const cacheKey = `${account.id}:${account.expires_at ?? 0}`;
  const cached = cardCache.get(cacheKey);
  if (cached && now - cached.at < CARD_CACHE_TTL_MS) return cached.card;

  const accessToken = account.access_token;
  if (!accessToken) {
    return { status: "expired", message: "没有可用的 access_token，请重新绑定。" };
  }

  // 7 天后静默失效：本轮不做自动刷新（技术债 T-010），到点直接提示重新绑定
  if (account.expires_at && account.expires_at * 1000 <= now) {
    return { status: "expired", message: "Bangumi 授权已过期（有效期 7 天），请重新绑定。" };
  }

  const me = await getMyself(accessToken);
  if (!me.ok) {
    if (me.error.status === 401) {
      return { status: "expired", message: "Bangumi 授权已失效，请重新绑定。" };
    }
    return { status: "error", message: `读取 Bangumi 用户信息失败：${describeError(me.error)}` };
  }

  // 收藏总数拿不到不算绑定失败，页面显示「—」
  const totalResult = await getCollectionTotal(accessToken, me.data.username);

  const card: BangumiCard = {
    status: "linked",
    nickname: me.data.nickname || me.data.username,
    username: me.data.username,
    avatarUrl: me.data.avatar?.large,
    collectionTotal: totalResult.ok ? totalResult.data : null,
  };

  cardCache.set(cacheKey, { card, at: now });
  return card;
}

function describeError(error: BgmError): string {
  return error.status ? `HTTP ${error.status}` : error.message;
}