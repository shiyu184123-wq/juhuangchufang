/**
 * Bangumi OAuth / API 客户端（P0-04）
 *
 * ============================================================================
 * 端点核实记录（不许凭记忆改这里，改之前先回文档核对）
 * ============================================================================
 * 出处 1：https://github.com/bangumi/api/blob/master/docs-raw/How-to-Auth.md
 * 出处 2：https://raw.githubusercontent.com/bangumi/api/master/open-api/v0.yaml
 *         （本轮实测下载 113 KB 规范逐段比对；/v0/me 在 1025 行起，
 *          /v0/users/{username}/collections 在 1064 行起，Paged_UserCollection 在 3115 行起）
 * 核实日期：2026-10-25
 *
 * 1) 授权页   GET  https://bgm.tv/oauth/authorize
 *    参数 client_id、response_type=code、redirect_uri、state
 *    **scope 参数「尚未实现」**：传了也不起作用，所以本项目一个 scope 都不传。
 * 2) 换 token  POST https://bgm.tv/oauth/access_token
 *    grant_type=authorization_code + client_id + client_secret + code + redirect_uri
 *    返回 access_token / expires_in（604800 秒 = 7 天）/ refresh_token / user_id
 * 3) 刷新 token 同一端点，grant_type=refresh_token
 *    —— 本轮不实现自动刷新，但 refresh_token 字段照存（见 PROGRESS 技术债 T-010）。
 * 4) 调用 API  Authorization: Bearer <access_token>
 *    /v0/ 端点明确不支持 query string 传 token，只能走请求头。
 * 5) 域名区分  OAuth 在 bgm.tv，API 在 api.bgm.tv，两者不可互换。
 * 6) User-Agent 必须是「开发者 ID/应用名」格式（本文件用 shiyu/juhuang-chufang）。
 *    官方明确禁用 Bangumi/1.0、database 这类泛化值；所有请求（含 /v0/me）都要带。
 *
 * ============================================================================
 * 两个返回结构的核实结果
 * ============================================================================
 * GET /v0/me  →  User schema + email + reg_time（+ 额外 time_offset）。
 *   User 必填字段：id(number)、username、nickname、user_group、avatar、sign。
 *   - username：唯一用户名，初始与 UID 相同，可修改一次 → 做 URL 路径参数。
 *   - nickname：显示昵称（示例 username: sai / nickname: Sai🖖）→ 页面显示用这个，
 *     因为用户在 Bangumi 主页上看到的是 nickname。
 *   - email：属于隐私字段，本项目一律不取、不存、不显示。
 *
 * GET /v0/users/{username}/collections
 *   query: subject_type（1 书籍 / 2 动画 / 3 音乐 / 4 游戏 / 6 三次元；省略=全部）
 *          type（1 想看 / 2 看过 / 3 在看 / 4 搁置 / 5 抛弃；省略=全部）
 *          limit（1–50，默认 30）、offset（默认 0）
 *   返回 Paged_UserCollection { total, limit, offset, data[] }。
 *   **有 total 字段**，所以「收藏总数」= 一次 limit=1&offset=0 读 total，
 *   不需要分 subject_type 累加（手测时用 5 个类型分别取 total 求和交叉核对过）。
 *   注意 total 是「所有条目类型的收藏合计」，与 Bangumi 主页分类型显示的单个数字
 *   不是同一口径 —— 页面文案因此写「收藏 N 条」，不写「N 部动画」。
 */

/** OAuth 走 bgm.tv */
export const BGM_OAUTH_BASE = "https://bgm.tv";
/** API 走 api.bgm.tv —— 与 OAuth 域名不同，不要混用 */
export const BGM_API_BASE = "https://api.bgm.tv";

export const BGM_AUTHORIZE_PATH = "/oauth/authorize";
export const BGM_TOKEN_PATH = "/oauth/access_token";

/** 官方要求「开发者 ID/应用名」；泛化值（Bangumi/1.0、database 等）会被拒 */
export const BGM_USER_AGENT = "shiyu/juhuang-chufang";

/** state 放 httpOnly cookie，10 分钟过期（防 CSRF，一次性使用） */
export const OAUTH_STATE_COOKIE = "bgm_oauth_state";
export const OAUTH_STATE_MAX_AGE_SECONDS = 600;

/** 换 token 返回的 expires_in；注释里写死是为了在没有响应时也有兜底值 */
export const BGM_TOKEN_EXPIRES_IN_SECONDS = 604_800;

const REQUEST_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// 返回类型（只声明本项目用到的字段）
// ---------------------------------------------------------------------------

export type BgmAvatar = { large: string; medium: string; small: string };

export type BgmUser = {
  id: number;
  username: string;
  nickname: string;
  user_group: number;
  avatar?: BgmAvatar;
  sign?: string;
};

export type BgmPaged<T> = {
  total: number;
  limit: number;
  offset: number;
  data: T[];
};

export type BgmTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  user_id?: number;
  token_type?: string;
  scope?: string;
};

// ---------------------------------------------------------------------------
// 结构化错误：不抛裸异常，调用方按 kind 决定给用户看什么
// ---------------------------------------------------------------------------

export type BgmErrorKind = "config" | "network" | "http" | "parse";

export type BgmError = {
  kind: BgmErrorKind;
  /** HTTP 状态码，仅 kind = "http" 时有 */
  status?: number;
  /** 可安全展示/记日志的信息：绝不包含 access_token 或 client_secret */
  message: string;
};

export type BgmResult<T> = { ok: true; data: T } | { ok: false; error: BgmError };

function truncate(text: string, max = 200): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

async function requestJson<T>(url: string, init: RequestInit): Promise<BgmResult<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      // 收藏/用户信息属于实时数据，不参与 Next 的 fetch 缓存
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        error: {
          kind: "http",
          status: res.status,
          message: `HTTP ${res.status}${text ? `: ${truncate(text)}` : ""}`,
        },
      };
    }
    try {
      return { ok: true, data: JSON.parse(text) as T };
    } catch {
      return { ok: false, error: { kind: "parse", status: res.status, message: "响应不是合法 JSON" } };
    }
  } catch (error) {
    return {
      ok: false,
      error: { kind: "network", message: error instanceof Error ? error.message : String(error) },
    };
  }
}

// ---------------------------------------------------------------------------
// API 调用（api.bgm.tv）：统一加 User-Agent，可选 Bearer token
// ---------------------------------------------------------------------------

export async function fetchBgm<T>(path: string, options: { accessToken?: string } = {}): Promise<BgmResult<T>> {
  const headers: Record<string, string> = {
    "User-Agent": BGM_USER_AGENT,
    Accept: "application/json",
  };
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;

  return requestJson<T>(`${BGM_API_BASE}${path}`, { method: "GET", headers });
}

/** 当前 token 对应的 Bangumi 用户（昵称 + 唯一用户名） */
export function getMyself(accessToken: string): Promise<BgmResult<BgmUser>> {
  return fetchBgm<BgmUser>("/v0/me", { accessToken });
}

/**
 * 收藏总数：limit=1 只取 total，不拉全量（全量同步属于 P2-01）。
 * 失败时返回结构化错误，调用方可以降级成「—」，不阻断绑定。
 */
export async function getCollectionTotal(accessToken: string, username: string): Promise<BgmResult<number>> {
  const path = `/v0/users/${encodeURIComponent(username)}/collections?limit=1&offset=0`;
  const result = await fetchBgm<BgmPaged<unknown>>(path, { accessToken });
  if (!result.ok) return result;
  const total = result.data?.total;
  if (typeof total !== "number") {
    return { ok: false, error: { kind: "parse", message: "收藏响应缺少 total 字段" } };
  }
  return { ok: true, data: total };
}

// ---------------------------------------------------------------------------
// OAuth（bgm.tv）
// ---------------------------------------------------------------------------

/** 拼授权页 URL。刻意不传 scope —— Bangumi 尚未实现该参数。 */
export function buildAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL(`${BGM_OAUTH_BASE}${BGM_AUTHORIZE_PATH}`);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  return url.toString();
}

/** 用授权码换 token。授权码只有 60 秒有效期，失败由调用方提示「请重新绑定」。 */
export function exchangeAuthorizationCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<BgmResult<BgmTokenResponse>> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code: input.code,
    redirect_uri: input.redirectUri,
  });

  return requestJson<BgmTokenResponse>(`${BGM_OAUTH_BASE}${BGM_TOKEN_PATH}`, {
    method: "POST",
    headers: {
      "User-Agent": BGM_USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
}

// ---------------------------------------------------------------------------
// 服务端环境变量
// ---------------------------------------------------------------------------

export type BgmOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/** 三个变量缺一不可；缺了就是配置错误，不要用默认值猜（与 D-013 同一原则） */
export function readOAuthConfig(): BgmResult<BgmOAuthConfig> {
  const clientId = process.env.BANGUMI_CLIENT_ID?.trim();
  const clientSecret = process.env.BANGUMI_CLIENT_SECRET?.trim();
  const redirectUri = process.env.BANGUMI_REDIRECT_URI?.trim();

  const missing = [
    !clientId ? "BANGUMI_CLIENT_ID" : null,
    !clientSecret ? "BANGUMI_CLIENT_SECRET" : null,
    !redirectUri ? "BANGUMI_REDIRECT_URI" : null,
  ].filter((name): name is string => Boolean(name));

  if (!clientId || !clientSecret || !redirectUri) {
    return {
      ok: false,
      error: {
        kind: "config",
        message: `缺少环境变量 ${missing.join(" / ")}，请写进 .env.local`,
      },
    };
  }

  return { ok: true, data: { clientId, clientSecret, redirectUri } };
}