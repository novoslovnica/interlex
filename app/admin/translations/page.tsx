import Table from "@/app/admin/Table";
import {auth} from "@/auth";
import {redirect} from "next/navigation";
import { prismaAuth as dbAuth } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { saveColumnVisibilityPreference } from "@/app/settings/actions"
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Переводы — администрирование",
  description: "Панель управления словарём межславянского языка. Редактирование статей, управление синонимами, антонимами и корнями.",
};

// Moved from app/admin/page.tsx - / (Home) is now the moderator landing hub,
// this table lives at its own route. AdminNav is provided once by
// app/admin/layout.tsx, not rendered here.
const AdminTranslationsPage = async () => {
    const session = await auth()

    if (!session) redirect("/login")

    await requirePermission(session, "dictionary_edit")

    const userPermissions = session.user.role === "MODERATOR"
        ? (await dbAuth.featurePermission.findMany({
            where: { userId: session.user.id },
            select: { featureKey: true },
          })).map(p => p.featureKey)
        : []

    const userSettings = await dbAuth.userSettings.findUnique({
        where: { userId: session.user.id },
        select: { columnVisibility: true },
    })

    return (
        <div>
            <Table
                initialColumnVisibility={userSettings?.columnVisibility ?? null}
                onSaveColumnVisibility={saveColumnVisibilityPreference}
                userPermissions={userPermissions}
                userRole={session.user.role || ""}
            />
        </div>
    );
};

export default AdminTranslationsPage;
