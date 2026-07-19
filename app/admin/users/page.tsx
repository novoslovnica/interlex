import { redirect } from "next/navigation"

export default function OldAdminUsersRedirect() {
  redirect("/admin/platform/users")
}