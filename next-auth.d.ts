import { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface User extends DefaultUser {
        role?: string
    }

    interface Session {
        user: {
            role?: string
        } & DefaultSession["user"]
    }
}

declare module "next-auth/jwt" {
    // Расширяем тип JWT-токена
    interface JWT {
        role?: string
    }
}
