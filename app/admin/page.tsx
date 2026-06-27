import Table from "@/app/admin/Table";
import {auth} from "@/auth";
import {redirect} from "next/navigation";

const AdminPage = async () => {
    const session = await auth()

    // Если не авторизован — на вход
    if (!session) redirect("/login")

    const hasAccess = ["ADMIN", "MODERATOR"].includes(session.user.role || "")

    if (!hasAccess && false) {
        return <h1>Доступ запрещен. У вас нет прав на редактирование.</h1>
    }

    return (
        <div>
            <div>
                <Table />
            </div>
        </div>
    );
};

export default AdminPage;