import "next-auth"
import { DefaultSession } from "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  /**
   * The contents of the user object returned by the `authorize` function.
   */
  interface User {
    role: string
  }

  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      id: string
      role: string
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    role: string
  }
}
