// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface TestfallErfassung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    testfall_name?: string;
    testfall_beschreibung?: string;
    software_version?: string;
    testdatum?: string; // Format: YYYY-MM-DD oder ISO String
    prioritaet?: LookupValue;
    teststatus?: LookupValue;
    testergebnis?: LookupValue;
    tester_vorname?: string;
    tester_nachname?: string;
    fehler_beschreibung?: string;
    screenshot?: string;
    anmerkungen?: string;
  };
}

export const APP_IDS = {
  TESTFALL_ERFASSUNG: '69c50bd3d38d8ccb727de8f4',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'testfall_erfassung': {
    prioritaet: [{ key: "niedrig", label: "Niedrig" }, { key: "mittel", label: "Mittel" }, { key: "hoch", label: "Hoch" }, { key: "kritisch", label: "Kritisch" }],
    teststatus: [{ key: "offen", label: "Offen" }, { key: "in_bearbeitung", label: "In Bearbeitung" }, { key: "abgeschlossen", label: "Abgeschlossen" }, { key: "blockiert", label: "Blockiert" }],
    testergebnis: [{ key: "bestanden", label: "Bestanden" }, { key: "fehlgeschlagen", label: "Fehlgeschlagen" }, { key: "nicht_getestet", label: "Nicht getestet" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'testfall_erfassung': {
    'testfall_name': 'string/text',
    'testfall_beschreibung': 'string/textarea',
    'software_version': 'string/text',
    'testdatum': 'date/date',
    'prioritaet': 'lookup/radio',
    'teststatus': 'lookup/select',
    'testergebnis': 'lookup/radio',
    'tester_vorname': 'string/text',
    'tester_nachname': 'string/text',
    'fehler_beschreibung': 'string/textarea',
    'screenshot': 'file',
    'anmerkungen': 'string/textarea',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateTestfallErfassung = StripLookup<TestfallErfassung['fields']>;