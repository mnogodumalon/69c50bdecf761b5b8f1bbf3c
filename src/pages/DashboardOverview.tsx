import { useState, useMemo } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { TestfallErfassung } from '@/types/app';
import { LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formatDate } from '@/lib/formatters';
import { TestfallErfassungDialog } from '@/components/dialogs/TestfallErfassungDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  IconAlertCircle, IconPlus, IconPencil, IconTrash, IconSearch,
  IconClipboardList, IconCircleCheck, IconClockHour4,
  IconBan, IconCalendar, IconUser, IconTag,
  IconRocket, IconPlayerPlay, IconBug, IconList,
} from '@tabler/icons-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusKey = 'offen' | 'in_bearbeitung' | 'abgeschlossen' | 'blockiert';

interface KanbanColumn {
  key: StatusKey;
  label: string;
  color: string;
  headerBg: string;
  icon: React.ReactNode;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS: KanbanColumn[] = [
  {
    key: 'offen',
    label: 'Offen',
    color: 'text-blue-600',
    headerBg: 'bg-blue-50 border-blue-200',
    icon: <IconClipboardList size={16} className="shrink-0" />,
  },
  {
    key: 'in_bearbeitung',
    label: 'In Bearbeitung',
    color: 'text-amber-600',
    headerBg: 'bg-amber-50 border-amber-200',
    icon: <IconClockHour4 size={16} className="shrink-0" />,
  },
  {
    key: 'abgeschlossen',
    label: 'Abgeschlossen',
    color: 'text-green-600',
    headerBg: 'bg-green-50 border-green-200',
    icon: <IconCircleCheck size={16} className="shrink-0" />,
  },
  {
    key: 'blockiert',
    label: 'Blockiert',
    color: 'text-red-600',
    headerBg: 'bg-red-50 border-red-200',
    icon: <IconBan size={16} className="shrink-0" />,
  },
];

const PRIORITY_COLORS: Record<string, string> = {
  niedrig: 'bg-slate-100 text-slate-600 border-slate-200',
  mittel: 'bg-blue-100 text-blue-700 border-blue-200',
  hoch: 'bg-orange-100 text-orange-700 border-orange-200',
  kritisch: 'bg-red-100 text-red-700 border-red-200',
};

const ERGEBNIS_COLORS: Record<string, string> = {
  bestanden: 'bg-green-100 text-green-700 border-green-200',
  fehlgeschlagen: 'bg-red-100 text-red-700 border-red-200',
  nicht_getestet: 'bg-slate-100 text-slate-500 border-slate-200',
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function getStatusKey(record: TestfallErfassung): StatusKey {
  const key = record.fields.teststatus?.key;
  if (key === 'offen' || key === 'in_bearbeitung' || key === 'abgeschlossen' || key === 'blockiert') {
    return key;
  }
  return 'offen';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PriorityBadge({ value }: { value: TestfallErfassung['fields']['prioritaet'] }) {
  if (!value) return null;
  const cls = PRIORITY_COLORS[value.key] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      <IconTag size={10} className="shrink-0" />
      {value.label}
    </span>
  );
}

function ErgebnisBadge({ value }: { value: TestfallErfassung['fields']['testergebnis'] }) {
  if (!value) return null;
  const cls = ERGEBNIS_COLORS[value.key] ?? 'bg-slate-100 text-slate-500 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {value.label}
    </span>
  );
}

interface TestCardProps {
  record: TestfallErfassung;
  onEdit: (r: TestfallErfassung) => void;
  onDelete: (r: TestfallErfassung) => void;
  onStatusChange: (r: TestfallErfassung, newStatus: StatusKey) => void;
}

function TestCard({ record, onEdit, onDelete, onStatusChange }: TestCardProps) {
  const f = record.fields;
  const testerName = [f.tester_vorname, f.tester_nachname].filter(Boolean).join(' ');
  const currentStatus = getStatusKey(record);

  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm p-4 space-y-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-sm text-foreground leading-snug min-w-0 truncate">
          {f.testfall_name ?? '(Kein Name)'}
        </h4>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onEdit(record)}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <IconPencil size={14} className="shrink-0" />
          </button>
          <button
            onClick={() => onDelete(record)}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <IconTrash size={14} className="shrink-0" />
          </button>
        </div>
      </div>

      {f.testfall_beschreibung && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {f.testfall_beschreibung}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {f.prioritaet && <PriorityBadge value={f.prioritaet} />}
        {f.testergebnis && <ErgebnisBadge value={f.testergebnis} />}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-1 border-t border-border/50">
        {f.software_version && (
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded truncate max-w-[100px]" title={f.software_version}>
            v{f.software_version}
          </span>
        )}
        {f.testdatum && (
          <span className="inline-flex items-center gap-1">
            <IconCalendar size={11} className="shrink-0" />
            {formatDate(f.testdatum)}
          </span>
        )}
        {testerName && (
          <span className="inline-flex items-center gap-1 min-w-0 truncate">
            <IconUser size={11} className="shrink-0" />
            <span className="truncate">{testerName}</span>
          </span>
        )}
      </div>

      {f.fehler_beschreibung && (
        <div className="text-xs bg-red-50 border border-red-100 rounded-lg p-2 text-red-700 line-clamp-2">
          <span className="font-medium">Fehler: </span>{f.fehler_beschreibung}
        </div>
      )}

      <div className="flex flex-wrap gap-1 pt-1 border-t border-border/50">
        {COLUMNS.filter(col => col.key !== currentStatus).map(col => (
          <button
            key={col.key}
            onClick={() => onStatusChange(record, col.key)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-foreground bg-muted hover:bg-accent transition-colors"
          >
            {col.icon}
            {col.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface KanbanColProps {
  column: KanbanColumn;
  records: TestfallErfassung[];
  onAdd: (statusKey: StatusKey) => void;
  onEdit: (r: TestfallErfassung) => void;
  onDelete: (r: TestfallErfassung) => void;
  onStatusChange: (r: TestfallErfassung, newStatus: StatusKey) => void;
}

function KanbanCol({ column, records, onAdd, onEdit, onDelete, onStatusChange }: KanbanColProps) {
  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px] w-full flex-1">
      <div className={`flex items-center justify-between px-4 py-3 rounded-t-2xl border-b-2 ${column.headerBg}`}>
        <div className={`flex items-center gap-2 font-semibold text-sm ${column.color}`}>
          {column.icon}
          <span>{column.label}</span>
          <span className="ml-1 bg-white/70 rounded-full px-2 py-0.5 text-xs font-bold">
            {records.length}
          </span>
        </div>
        <button
          onClick={() => onAdd(column.key)}
          className="p-1.5 rounded-lg hover:bg-white/70 transition-colors text-muted-foreground hover:text-foreground"
          title="Neuen Testfall hinzufügen"
        >
          <IconPlus size={15} className="shrink-0" />
        </button>
      </div>

      <div className="flex-1 bg-muted/30 rounded-b-2xl border border-t-0 border-border/50 p-3 space-y-3 min-h-[120px] overflow-y-auto" style={{ maxHeight: 'calc(100vh - 340px)', minHeight: '120px' }}>
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50 text-xs gap-2">
            <IconClipboardList size={28} stroke={1.5} />
            <span>Keine Testfälle</span>
          </div>
        ) : (
          records.map(r => (
            <TestCard key={r.record_id} record={r} onEdit={onEdit} onDelete={onDelete} onStatusChange={onStatusChange} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardOverview() {
  const { testfallErfassung, loading, error, fetchAll } = useDashboardData();

  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterErgebnis, setFilterErgebnis] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<TestfallErfassung | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TestfallErfassung | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<StatusKey>('offen');

  const filtered = useMemo(() => {
    return testfallErfassung.filter(r => {
      const f = r.fields;
      const q = search.toLowerCase();
      if (q) {
        const haystack = [
          f.testfall_name, f.testfall_beschreibung, f.software_version,
          f.tester_vorname, f.tester_nachname, f.fehler_beschreibung,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filterPriority !== 'all' && f.prioritaet?.key !== filterPriority) return false;
      if (filterErgebnis !== 'all' && f.testergebnis?.key !== filterErgebnis) return false;
      return true;
    });
  }, [testfallErfassung, search, filterPriority, filterErgebnis]);

  const byStatus = useMemo(() => {
    const map: Record<StatusKey, TestfallErfassung[]> = {
      offen: [], in_bearbeitung: [], abgeschlossen: [], blockiert: [],
    };
    for (const r of filtered) {
      map[getStatusKey(r)].push(r);
    }
    return map;
  }, [filtered]);

  function handleAdd(statusKey: StatusKey) {
    setDefaultStatus(statusKey);
    setEditRecord(null);
    setDialogOpen(true);
  }

  function handleEdit(record: TestfallErfassung) {
    setEditRecord(record);
    setDialogOpen(true);
  }

  async function handleSubmit(fields: TestfallErfassung['fields']) {
    if (editRecord) {
      await LivingAppsService.updateTestfallErfassungEntry(editRecord.record_id, fields);
    } else {
      await LivingAppsService.createTestfallErfassungEntry(fields);
    }
    fetchAll();
  }

  async function handleStatusChange(record: TestfallErfassung, newStatus: StatusKey) {
    const statusOpt = LOOKUP_OPTIONS['testfall_erfassung']?.teststatus?.find(o => o.key === newStatus);
    if (!statusOpt) return;
    await LivingAppsService.updateTestfallErfassungEntry(record.record_id, {
      ...record.fields,
      teststatus: statusOpt,
    });
    fetchAll();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await LivingAppsService.deleteTestfallErfassungEntry(deleteTarget.record_id);
    setDeleteTarget(null);
    fetchAll();
  }

  const priorityOptions = LOOKUP_OPTIONS['testfall_erfassung']?.prioritaet ?? [];
  const ergebnisOptions = LOOKUP_OPTIONS['testfall_erfassung']?.testergebnis ?? [];

  // ── New-dialog default values: inject the status we clicked ──
  const statusOpt = LOOKUP_OPTIONS['testfall_erfassung']?.teststatus?.find(o => o.key === defaultStatus);
  const createDefaults = editRecord
    ? editRecord.fields
    : statusOpt ? { teststatus: statusOpt } : undefined;

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">
      {/* ── Workflows ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <IconRocket size={18} className="text-primary shrink-0" />
          <h2 className="text-base font-semibold text-foreground">ABLÄUFE</h2>
        </div>
        <div className="flex flex-wrap gap-6">
          <a
            href="#/intents/testfall-durchfuehren"
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <IconPlayerPlay size={28} className="text-primary" />
            </div>
            <span className="text-xs font-medium text-foreground text-center">Testfall durchführen</span>
          </a>
          <a
            href="#/intents/fehler-melden"
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <IconBug size={28} className="text-primary" />
            </div>
            <span className="text-xs font-medium text-foreground text-center">Fehler melden</span>
          </a>
          <a
            href="#/intents/alle-testfaelle"
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <IconList size={28} className="text-primary" />
            </div>
            <span className="text-xs font-medium text-foreground text-center">Alle Testfälle</span>
          </a>
        </div>
      </div>

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Testfall-Übersicht</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Alle Testfälle im Überblick — Status, Priorität und Ergebnis</p>
        </div>
        <Button onClick={() => { setEditRecord(null); setDefaultStatus('offen'); setDialogOpen(true); }} className="shrink-0 gap-2">
          <IconPlus size={16} className="shrink-0" />
          <span>Neuer Testfall</span>
        </Button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
          <Input
            placeholder="Testfall suchen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[150px] h-9 text-sm">
            <SelectValue placeholder="Priorität" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Prioritäten</SelectItem>
            {priorityOptions.map(o => (
              <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterErgebnis} onValueChange={setFilterErgebnis}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue placeholder="Ergebnis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Ergebnisse</SelectItem>
            {ergebnisOptions.map(o => (
              <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || filterPriority !== 'all' || filterErgebnis !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearch(''); setFilterPriority('all'); setFilterErgebnis('all'); }}
            className="text-muted-foreground h-9"
          >
            Filter zurücksetzen
          </Button>
        )}
      </div>

      {/* ── Kanban Board ── */}
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '420px' }}>
        {COLUMNS.map(col => (
          <KanbanCol
            key={col.key}
            column={col}
            records={byStatus[col.key]}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={r => setDeleteTarget(r)}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>

      {/* ── Dialogs ── */}
      <TestfallErfassungDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditRecord(null); }}
        onSubmit={handleSubmit}
        defaultValues={createDefaults}
        enablePhotoScan={AI_PHOTO_SCAN['TestfallErfassung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['TestfallErfassung']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Testfall löschen"
        description={`Soll der Testfall "${deleteTarget?.fields.testfall_name ?? ''}" wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ─── Skeletons / Error ────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-80 rounded-2xl min-w-[280px]" />)}
      </div>
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">{error.message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>Erneut versuchen</Button>
    </div>
  );
}
