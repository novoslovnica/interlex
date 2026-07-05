import React from "react";
import MainPage from "@/app/main/page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Главная",
  description: "Interslavic Lexicon — главная страница межславянского лексикона. Поиск, перевод, грамматика и учебные материалы.",
};

export default async function HomePage() {
  return (
      <>
        <MainPage />
      </>
  );
}
