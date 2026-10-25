import { NextResponse } from "next/server";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/lib/auth";

const bodySchema = z.object({
  email: z.email(),
  code: z.string().regex(/^\d{6}$/),
});

/** 所有失败都回这一句：不区分"码错"和"已过期" */
const FAIL_MESSAGE = "验证码无效或已过期";

export async function POST(request: Request) {
  const payload: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: FAIL_MESSAGE }, { status: 400 });
  }

  try {
    // redirect:false —— 在 Route Handler 里只要 cookie，不要 302。
    // 校验与建用户都发生在 Credentials 的 authorize 里（一处逻辑，不重复消费验证码）。
    await signIn("credentials", {
      email: parsed.data.email,
      code: parsed.data.code,
      redirect: false,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: FAIL_MESSAGE }, { status: 400 });
    }
    console.error("[otp] 登录异常", error);
    return NextResponse.json({ error: "登录失败，请稍后再试" }, { status: 500 });
  }
}