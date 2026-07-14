import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin(
    './i18n/request.ts'
);

const nextConfig: NextConfig = {
    experimental: {
        serverActions: {
            bodySizeLimit: "50mb",
        },
    },
    serverExternalPackages: ["epub-gen"],
    typescript: {
        ignoreBuildErrors: true,
    },
};

export default withNextIntl(nextConfig);
