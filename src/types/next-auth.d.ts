import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      passwordExpired?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    passwordExpired?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    passwordExpired?: boolean;
  }
}
