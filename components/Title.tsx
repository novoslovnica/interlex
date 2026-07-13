'use client';

import {useTranslations} from "next-intl";
import Link from "next/link";
import React from "react";

export default function Title() {
    const t = useTranslations("common")

    return (
        <h1>
            <Link href="/">{t('title')}</Link>
        </h1>
    );
}