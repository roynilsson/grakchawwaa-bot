import NextAuth from "next-auth"
import Discord from "next-auth/providers/discord"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.discordId = profile.id
      }
      return token
    },
    async session({ session, token }) {
      if (token.discordId) {
        session.user.discordId = token.discordId as string
      }
      return session
    },
  },
  pages: {
    signIn: "/",
  },
})
