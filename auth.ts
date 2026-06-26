import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prismaAuth as prisma } from "@/lib/prisma"
import authConfig from "./auth.config"

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" }, // Обязательно JWT для Credentials
    callbacks: {
        async signIn({ user, account }) {
            if (account?.provider === "telegram" && user.id) {
                // Проверяем, есть ли пользователь в SQLite
                const existingUser = await prisma.user.findUnique({
                    where: { id: user.id }
                })

                // Если пользователя нет — создаем его в базе
                if (!existingUser) {
                    await prisma.user.create({
                        data: {
                            id: user.id,
                            name: user.name,
                            image: user.image,
                            email: user.email, // псевдо-email
                        }
                    })
                }
            }
            return true // Разрешить вход
        },
        async session({ session, token }) {
            if (session.user && token.sub) {
                session.user.id = token.sub // Прокидываем ID пользователя в сессию
            }
            return session
        }
    },
    ...authConfig,
})
