import AzureADProvider from "next-auth/providers/azure-ad";
import type { NextAuthOptions } from "next-auth";
import { db } from "./db";

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
      // Files.ReadWrite.AppFolder: this app can only see/write its own
      // folder inside the person's OneDrive, never their other files.
      authorization: {
        params: { scope: "openid profile email offline_access Files.ReadWrite.AppFolder" },
      },
    }),
  ],
  callbacks: {
    // Keep the Graph access token around so API routes can call OneDrive
    // on the signed-in person's behalf.
    async jwt({ token, account, profile }) {
      if (account) token.accessToken = account.access_token;
      if (profile) token.msId = (profile as any).oid ?? (profile as any).sub;
      return token;
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      (session as any).userId = token.msId;
      return session;
    },
    // First sign-in: make sure a profiles row exists for this person.
    async signIn({ user, profile }) {
      const id = (profile as any)?.oid ?? (profile as any)?.sub;
      if (id) {
        await db().query(
          `insert into profiles (id, email, full_name)
           values ($1, $2, $3)
           on conflict (id) do nothing`,
          [id, user.email, user.name]
        );
      }
      return true;
    },
  },
};
