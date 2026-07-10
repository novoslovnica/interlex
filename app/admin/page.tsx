import Table from "@/app/admin/Table";
import {auth} from "@/auth";
import {redirect} from "next/navigation";
import AdminNav from "@/components/AdminNav";
import { prismaAuth as dbAuth } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Админ-панель",
  description: "Панель управления словарём межславянского языка. Редактирование статей, управление синонимами, антонимами и корнями.",
};

const AdminPage = async () => {
    const session = await auth()

    if (!session) redirect("/login")

    await requirePermission(session, "dictionary_edit")

    const userPermissions = session.user.role === "MODERATOR"
        ? (await dbAuth.featurePermission.findMany({
            where: { userId: session.user.id },
            select: { featureKey: true },
          })).map(p => p.featureKey)
        : []

    return (
        <div className="h-full flex flex-col bg-background text-foreground transition-colors duration-300">
            <div>
                <AdminNav userRole={session.user.role || ""} userPermissions={userPermissions} />
                <Table />
            </div>
        </div>
    );
};

export default AdminPage;