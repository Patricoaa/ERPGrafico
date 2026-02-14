export class ErrorCollector {
    private errors: string[] = [];

    add(message: string): void {
        this.errors.push(message);
    }

    hasErrors(): boolean {
        return this.errors.length > 0;
    }

    getErrors(): string[] {
        return [...this.errors];
    }

    getJoinedMessage(separator: string = "\n"): string {
        return this.errors.join(separator);
    }

    clear(): void {
        this.errors = [];
    }
}

export function createErrorCollector(): ErrorCollector {
    return new ErrorCollector();
}
