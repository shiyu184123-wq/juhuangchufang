import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { verifyCodeAndUpsertUser } from "@/lib/otp";

// 让 session.user.id 有类型（JWT 里只放 sub=userId，见下方 callbacks）
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

const credentialsSchema = z.object({
  email: z.email(),
  code: z.string().regex(/^\d{6}$/),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  // 产品只用邮箱验证码登录。Auth.js 的 Credentials provider 只支持 JWT session（官方限制），
  // 所以这里显式声明 jwt：登录态只存在于签名 cookie 里，sessions 表不参与登录。
  // 为什么不用 database session / PrismaAdapter 见 DECISIONS D-014。
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "邮箱验证码",
      credentials: {
        email: { label: "邮箱", type: "email" },
        code: { label: "验证码", type: "text" },
      },
      // 校验逻辑只在这里执行一次：verify 接口通过 signIn 走同一条路径，
      // 避免"接口先消费掉码、authorize 再校验一次"导致永远失败。
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const result = await verifyCodeAndUpsertUser(parsed.data.email, parsed.data.code);
        // 失败一律返回 null：不区分"码错"与"已过期"，不给枚举/爆破留信号
        if (!result.ok) return null;

        return { id: result.userId, email: result.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      // 首次登录时把 userId 写进 token（sub），之后每次刷新沿用
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});