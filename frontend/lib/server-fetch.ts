import { cookies } from 'next/headers'

export class ServerFetchError extends Error {
    constructor(
        public status: number,
        message: string,
        public body?: unknown
    ) {
        super(message)
        this.name = 'ServerFetchError'
    }
}

interface ServerFetchOptions {
    params?: Record<string, string | undefined>
    init?: RequestInit
    revalidate?: number
    tags?: string[]
}

const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '') + '/'

export async function serverFetch<T>(
    path: string,
    opts?: ServerFetchOptions
): Promise<T> {
    const token = (await cookies()).get('access_token')?.value

    const cleanPath = path.replace(/^\//, '')
    let url = `${API_URL}${cleanPath}`

    if (opts?.params) {
        const qs = Object.entries(opts.params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
            .join('&')
        if (qs) url += `?${qs}`
    }

    const res = await fetch(url, {
        ...opts?.init,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(opts?.init?.headers as unknown as Record<string, string>),
        },
        next: { revalidate: opts?.revalidate ?? 0, tags: opts?.tags },
    })

    if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new ServerFetchError(res.status, res.statusText, body)
    }

    return res.json()
}
