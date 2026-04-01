export const FORM_STYLES = {
    // Labels
    label: "text-[10px] font-black uppercase tracking-widest text-muted-foreground",

    // Inputs & Selects
    input: "h-10 rounded-xl border bg-background focus-visible:ring-primary transition-all duration-200",
    textarea: "min-h-[100px] rounded-xl border bg-background focus-visible:ring-primary transition-all duration-200 resize-none p-3",

    // Cards & Containers (Legacy/Base)
    card: "rounded-2xl border border-dashed p-4 bg-card/50",

    // Table Elements
    tableHeader: "px-3 py-2 font-black text-[10px] uppercase tracking-widest text-muted-foreground",

    // Sections (like lines headers)
    sectionHeader: "text-[10px] font-black uppercase tracking-widest text-muted-foreground",
} as const;

export const LAYOUT_TOKENS = {
    view: "flex-1 space-y-6 p-8 pt-6 animate-in fade-in duration-500",
    section: "space-y-4",
    grid: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
} as const;

export const CARD_TOKENS = {
    container: "rounded-2xl border transition-all duration-200",
    standard: "border-dashed p-4 bg-card/50 shadow-sm",
    industrial: "shadow-xl border-none ring-1 ring-slate-200 dark:ring-slate-800 border-t-4 border-t-primary bg-card",
    glass: "backdrop-blur-md bg-white/5 border-white/10 shadow-2xl p-4",
} as const;
