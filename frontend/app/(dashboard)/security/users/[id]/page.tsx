import { redirect } from "next/navigation"

export default async function SecurityUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/security/users?selected=${id}`)
}
