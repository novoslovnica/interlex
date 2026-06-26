import React from "react";
import Home from "@/app/Home";
import {auth, signIn} from "@/auth";

export default async function HomePage() {
    const session = await auth()

    console.log(session);

  return (
      <>
        <main className="main-content">
          <Home />
            <form
                action={async () => {
                    "use server"
                    await signIn("yandex", { redirectTo: "/admin" })
                }}
            >
                <button className="px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition shadow-sm">
                    Войти через Яндекс ID
                </button>
            </form>
        </main>
      </>
  );
}
