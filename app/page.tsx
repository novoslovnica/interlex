import React from "react";
import Home from "@/app/Home";
import {auth} from "@/auth";
import {getUserScript} from "@/lib/get-user-script";

export default async function HomePage() {
    const session = await auth()

    const currentScript = await getUserScript()

  return (
      <>
        <main className="main-content">
          <Home
              currentScript={currentScript}
              isGuest={!session}
          />
        </main>
      </>
  );
}
