const fs = require('fs');
let code = fs.readFileSync('src/components/users/user-table.tsx', 'utf8');

const oldUserRoles = `    {
      accessorKey: 'userRoles',
      header: 'Roles',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.userRoles.map((ur) => (
            <Badge key={ur.role.id} variant="secondary" className="text-xs">
              {ur.role.displayName}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      accessorKey: 'branch',
      header: 'Branch Assignment',
      cell: ({ row }) => {
        const b = row.original.branch
        return (
          <span className="text-xs text-muted-foreground font-mono">
            {b ? \`\${b.name} (\${b.code})\` : 'All Branches (Global)'}
          </span>
        )
      },
    },`;

const newUserRoles = `    {
      id: 'userRoles',
      accessorFn: (row) =>
        row.userRoles?.map((ur) => ur.role?.displayName || ur.role?.name || '').join(', ') || 'No Role',
      header: 'Roles',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.userRoles?.map((ur) => (
            <Badge key={ur.role?.id || ur.role?.name} variant="secondary" className="text-xs">
              {ur.role?.displayName || ur.role?.name}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: 'branch',
      accessorFn: (row) =>
        row.branch ? \`\${row.branch.name} (\${row.branch.code})\` : 'All Branches (Global)',
      header: 'Branch Assignment',
      cell: ({ row }) => {
        const b = row.original.branch
        return (
          <span className="text-xs text-muted-foreground font-mono">
            {b ? \`\${b.name} (\${b.code})\` : 'All Branches (Global)'}
          </span>
        )
      },
    },`;

// Normalize line endings to test match
const normalizedCode = code.replace(/\r\n/g, '\n');
const normalizedOld = oldUserRoles.replace(/\r\n/g, '\n');

if (normalizedCode.includes(normalizedOld)) {
  const replaced = normalizedCode.replace(normalizedOld, newUserRoles.replace(/\r\n/g, '\n'));
  fs.writeFileSync('src/components/users/user-table.tsx', replaced, 'utf8');
  console.log('Updated user-table.tsx successfully!');
} else {
  console.log('Target block not found in user-table.tsx');
}

