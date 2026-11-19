const fs = require('fs');
let code = fs.readFileSync('src/components/settings/period-lock-card.tsx', 'utf8');

// Ensure formatDateTime is imported
if (!code.includes('formatDateTime')) {
  code = code.replace("import { useToast } from '@/lib/hooks/use-toast'", "import { useToast } from '@/lib/hooks/use-toast'\nimport { formatDateTime } from '@/lib/utils/date'");
}

// Replace log rendering with safe parsing
const oldRender = `{auditLogs.map((log) => (
                <div key={log.id} className="p-2.5 flex items-center justify-between hover:bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-[10px] py-0 px-1.5">
                      {log.action}
                    </Badge>
                    <span className="font-medium text-foreground">
                      {log.newData?.lockDate ? \`Locked prior to \${log.newData.lockDate}\` : 'Lock cleared (open)'}
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      by {log.user?.name || log.user?.email || 'System Administrator'}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}`;

const newRender = `{auditLogs.map((log) => {
                const newDataObj = typeof log.newData === 'string' ? (() => { try { return JSON.parse(log.newData) } catch { return null } })() : log.newData
                const displayLock = newDataObj?.lockDate ? \`Locked prior to \${newDataObj.lockDate}\` : 'Lock cleared (open)'
                return (
                  <div key={log.id} className="p-2.5 flex items-center justify-between hover:bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-[10px] py-0 px-1.5">
                        {log.action}
                      </Badge>
                      <span className="font-medium text-foreground">
                        {displayLock}
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        by {log.user?.name || log.user?.email || 'System Administrator'}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {formatDateTime(log.createdAt)}
                    </span>
                  </div>
                )
              })}`;

const normCode = code.replace(/\r\n/g, '\n');
const normOld = oldRender.replace(/\r\n/g, '\n');

if (normCode.includes(normOld)) {
  const replaced = normCode.replace(normOld, newRender.replace(/\r\n/g, '\n'));
  fs.writeFileSync('src/components/settings/period-lock-card.tsx', replaced, 'utf8');
  console.log('Updated period-lock-card.tsx successfully!');
} else {
  console.log('Target block not found in period-lock-card.tsx');
}

