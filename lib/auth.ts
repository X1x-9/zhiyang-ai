import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { getPrisma } from "./prisma";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

const secret = process.env.AUTH_SECRET
  ?? process.env.NEXTAUTH_SECRET
  ?? (process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true" ? "zhiyang-demo-only-auth-secret" : undefined);

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/" },
  providers: [
    Credentials({
      name: "邮箱密码",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        try {
          const user = await getPrisma().user.findUnique({ where: { email: parsed.data.email } });
          if (!user) return null;
          const valid = await compare(parsed.data.password, user.passwordHash);
          if (!valid) return null;
          return { id: user.id, email: user.email, name: user.name || user.email };
        } catch (error) {
          console.error("AUTH AUTHORIZE ERROR", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (typeof token.id === "string" && session.user) session.user.id = token.id;
      return session;
    },
  },
});
