import * as XLSX from 'xlsx';

export type Cell = string | number | boolean | null;

export function downloadXlsx(
  filename: string,
  sheets: { name: string; rows: Cell[][] }[],
) {
  const wb = XLSX.utils.book_new();
  for (const sh of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sh.rows);
    const widths: number[] = [];
    for (const r of sh.rows) {
      r.forEach((c, i) => {
        const len = String(c ?? '').length;
        widths[i] = Math.max(widths[i] ?? 8, Math.min(len + 2, 40));
      });
    }
    ws['!cols'] = widths.map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
  }
  wb.Workbook = { Views: sheets.map(() => ({ RTL: true })) };
  XLSX.writeFile(wb, filename);
}
