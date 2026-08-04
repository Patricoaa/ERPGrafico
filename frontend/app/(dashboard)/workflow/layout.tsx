import { PageContainer } from "@/components/shared"
import { WorkflowHeader } from "./WorkflowHeader"

export default function WorkflowLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer className="flex flex-col">
            <WorkflowHeader />
            <div className="flex-1 min-h-0 flex flex-col">
                {children}
            </div>
        </PageContainer>
    )
}
