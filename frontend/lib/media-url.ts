const rawBaseURL = process.env.NEXT_PUBLIC_API_URL || '';

export function resolveMediaUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
        return path;
    }

    const backendHost = rawBaseURL.replace(/\/api\/?$/, '');

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    return `${backendHost}${normalizedPath}`;
}
