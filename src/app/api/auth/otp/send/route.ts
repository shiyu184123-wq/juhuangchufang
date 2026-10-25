import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendOtpMail } from "@/lib/mail";
import { checkSendRate, issueCode, normalizeEmail, recordSend } from "@/lib/otp";

const bodySchema = z.object({ email: z.email() });

function clientIp(request: Request): string {
  // 本地开发没有反向代理，取不到就记成 unknown（限流退化成全局计数，可接受）
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  const payload: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const ip = clientIp(request);

  const guard = checkSendRate(email, ip);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.message },
      { status: 429, headers: { "Retry-After": String(guard.retryAfterSeconds) } },
    );
  }

  const code = await issueCode(email);

  try {
    await sendOtpMail(email, code);
  } catch (error) {
    // 没发出去就别占着冷却：清掉这条码，让用户可以立刻重试
    await prisma.emailCode.deleteMany({ where: { email } });
    console.error("[otp] 发信失败", error);
    return NextResponse.json({ error: "验证码发送失败，请稍后再试" }, { status: 502 });
  }

  recordSend(email, ip);

  // 注意：响应体里永远不含验证码本身
  return NextResponse.json({ ok: true });
}