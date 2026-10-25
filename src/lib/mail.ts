import { Resend } from "resend";

const FROM = process.env.OTP_FROM ?? "剧荒处方 <onboarding@resend.dev>";

/**
 * 发送登录验证码邮件（纯文本，不用 HTML 模板：验证码场景没有排版需求，
 * 纯文本还更不容易被判定为营销邮件）。
 */
export async function sendOtpMail(to: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  // 本地验收用：没有真实邮件通道也能从服务端日志拿到码。
  // 生产环境（NODE_ENV=production）绝不打印，接口响应里也永远不含验证码。
  if (process.env.NODE_ENV !== "production") {
    console.log(`[otp] 验证码 ${code} → ${to}`);
  }

  if (!apiKey) {
    // 开发环境没有 key 时只跳过真实发信，好让本地能完整走一遍登录；
    // 生产环境缺 key 必须直接报错，不能假装发成功（同 D-013 的 fail fast 原则）。
    if (process.env.NODE_ENV !== "production") {
      console.log("[otp] 未配置 RESEND_API_KEY，本次跳过真实发信（仅本地日志）");
      return;
    }
    throw new Error(
      "缺少环境变量 RESEND_API_KEY。请在 .env.local 中配置（模板见 .env.example）；" +
        "本项目不提供默认值，避免生产环境漏配时静默发不出信。",
    );
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: "你的登录验证码",
    text: [
      `你的登录验证码是：${code}`,
      "",
      "10 分钟内有效，仅可使用一次。",
      "如果不是你本人操作，忽略这封邮件即可，你的邮箱不会被登录。",
    ].join("\n"),
  });

  if (error) {
    throw new Error(`邮件发送失败：${error.message}`);
  }
}