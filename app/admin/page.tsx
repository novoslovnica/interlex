import Table from "@/app/admin/Table";
import {auth} from "@/auth";
import {redirect} from "next/navigation";
import AdminNav from "@/components/AdminNav";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Админ-панель",
  description: "Панель управления словарём межславянского языка. Редактирование статей, управление синонимами, антонимами и корнями.",
};

const AdminPage = async () => {
    const session = await auth()

    // Если не авторизован — на вход
    if (!session) redirect("/login")

    const hasAccess = ["ADMIN", "MODERATOR"].includes(session.user.role || "")

    if (!hasAccess) {
        return <h1>Доступ запрещен. У вас нет прав на редактирование.</h1>
    }

    return (
        <div className="h-full flex flex-col bg-background text-foreground transition-colors duration-300">
            <div>
                <AdminNav userRole={session.user.role || ""} />
                <Table />
            </div>
        </div>
    );
};

export default AdminPage;