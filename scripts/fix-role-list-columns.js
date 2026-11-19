const fs = require('fs');
let code = fs.readFileSync('src/components/roles/role-list.tsx', 'utf8');

const oldBlock = `    {
      accessorKey: 'rolePermissions',
      header: 'Permissions',
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.rolePermissions.length} permissions</Badge>
      ),
    },
    {
      accessorKey: '_count',
      header: 'Users',
      cell: ({ row }) => (
        <Badge variant="outline">{row.original._count.userRoles} users</Badge>
      ),
    },`;

const newBlock = `    {
      id: 'rolePermissions',
      accessorFn: (row) => \`\${row.rolePermissions?.length || 0} permissions\`,
      header: 'Permissions',
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.rolePermissions?.length || 0} permissions</Badge>
      ),
    },
    {
      id: 'userCount',
      accessorFn: (row) => \`\${row._count?.userRoles || 0} users\`,
      header: 'Users',
      cell: ({ row }) => (
        <Badge variant="outline">{row.original._count?.userRoles || 0} users</Badge>
      ),
    },`;

const normCode = code.replace(/\r\n/g, '\n');
const normOld = oldBlock.replace(/\r\n/g, '\n');

if (normCode.includes(normOld)) {
  const replaced = normCode.replace(normOld, newBlock.replace(/\r\n/g, '\n'));
  fs.writeFileSync('src/components/roles/role-list.tsx', replaced, 'utf8');
  console.log('Updated role-list.tsx successfully!');
} else {
  console.log('Target not found in role-list.tsx');
}

