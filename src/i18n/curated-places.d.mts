type Labels = { name: string; address: string; isStation: boolean; displayAddress: string }
export function curatedLabels(id: string, locale?: string): Labels | null
export function curatedSearchTerms(place: { name: string; nameKo?: string; address: string; addressKo?: string; aliases: string[] }, includeAddress?: boolean): string[]
export function curatedPlaceForLocale(id: string, locale?: string): (Labels & { id: string; latitude: number; longitude: number; source: 'popular'; accuracy: 'building' }) | null
