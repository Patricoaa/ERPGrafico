import { PageContainer } from "@/components/shared"
import { FilesHeader } from "./FilesHeader"

export default function FilesLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer className="flex flex-col">
            <FilesHeader />
            <div className="flex-1 min-h-0 flex flex-col">
                {children}
            </div>
        </PageContainer>
    )
}
