import type {CymaticsConfigV1} from './types';

const escapeCsv=(value:string|number)=>`"${String(value).replaceAll('"','""')}"`;
export function exportCymaticsJournalCsv(rows:CymaticsConfigV1[]){const lines=['fecha,figura,frecuencia_hz,calma,nota'];for(const row of rows){if(!row.journal)continue;lines.push([row.journal.createdAt,row.title,row.channelFrequenciesHz[0],row.journal.calm,row.journal.note].map(escapeCsv).join(','));}return lines.join('\r\n');}

export function parseCymaticsJournalCsv(csv:string){const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;for(let index=0;index<csv.length;index++){const char=csv[index];if(quoted){if(char==='"'&&csv[index+1]==='"'){cell+='"';index++;}else if(char==='"')quoted=false;else cell+=char;}else if(char==='"')quoted=true;else if(char===','){row.push(cell);cell='';}else if(char==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=char;}row.push(cell.replace(/\r$/,''));rows.push(row);if(quoted)throw new Error('CSV incompleto.');return rows;}
