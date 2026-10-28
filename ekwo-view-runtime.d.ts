// ekwo-view-runtime.d.ts
export interface Field {column: string; label: string; required?: boolean; multiline?: boolean; type?: string; options?: string[]; optionLabels?: Record<string, string>}
export interface Group {key: string; title?: string; fields: Field[]}
export interface EditorOptions {
  record: Record<string, string | null>;
  groups: Group[];
  save(patch: Record<string, string | null>): Promise<void>;
  onSaved(): Promise<void>;
  onDone(): void;
}
export interface Application {
  key: string; label: string; order: number;
  entries: {key: string; label: string; href: string; icon: string; needs?: string}[];
}
export function registerApplication(application: Application): void;
export function mountEditor(element: HTMLElement, options: EditorOptions): void;
export function unmount(element: HTMLElement): void;
export function mountMenu(element: HTMLElement, options: {
  application: string; current: string; companyId: string | null;
  capabilities: string[]; folded: boolean; onNavigate(key: string): void;
}): void;
