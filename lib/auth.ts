import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

function allowedEmails() {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
    authorized: async ({ auth: session }) => Boolean(session?.user),
    signIn: async ({ profile }) => {
      const email = profile?.email?.toLowerCase();
      return Boolean(email && allowedEmails().includes(email));
    },
  },
});

export async function isAdmin() {
  const session = await auth();
  return Boolean(session?.user?.email);
}

export async function isSetupAdmin() {
  const session = await auth();
  return session?.user?.email?.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase();
}
