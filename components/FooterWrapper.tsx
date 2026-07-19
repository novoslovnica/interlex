'use client';

import {usePathname} from "next/navigation";
import {useEffect, useState, type ReactNode} from "react";

export default function FooterWrapper({children}: { children: ReactNode }) {
    const pathname = usePathname();
    const [isWide, setIsWide] = useState(false);

    useEffect(() => {
        const check = () => setIsWide(window.innerWidth >= 768);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    if (pathname.startsWith("/admin")) return null;
    if (pathname !== "/" && !isWide) return null;

    return <>{children}</>;
}