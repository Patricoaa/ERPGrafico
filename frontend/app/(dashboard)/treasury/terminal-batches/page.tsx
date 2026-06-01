import { redirect } from "next/navigation"

export default function TerminalBatchesRedirect() {
    redirect('/treasury/terminal-cobro?tab=batches')
}
