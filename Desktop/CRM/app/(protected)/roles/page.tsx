import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'

interface Role {
  name: string
  description: string
  access: string[]
}

const roles: Role[] = [
  {
    name: 'SUPER_ADMIN',
    description: 'Full system access with all permissions. Can manage users, roles, and all system settings.',
    access: [
      'All bookings (view, create, edit, cancel)',
      'All vehicles (view, create, edit, delete)',
      'All customers (view, create, edit)',
      'All financials (invoices, payments, view and update)',
      'User management (create, edit, deactivate)',
      'System settings and configuration',
    ],
  },
  {
    name: 'ADMIN',
    description: 'Administrative access to manage operations and users. Similar to Super Admin but may have some restrictions on system-level settings.',
    access: [
      'All bookings (view, create, edit, cancel)',
      'All vehicles (view, create, edit)',
      'All customers (view, create, edit)',
      'All financials (invoices, payments, view and update)',
      'User management (create, edit, deactivate)',
      'Operational settings',
    ],
  },
  {
    name: 'MANAGER',
    description: 'Operational management with access to bookings, fleet, and customer management.',
    access: [
      'All bookings (view, create, edit, cancel)',
      'All vehicles (view, create, edit)',
      'All customers (view, create, edit)',
      'Financials (view only)',
      'Reports and analytics',
    ],
  },
  {
    name: 'SALES_AGENT',
    description: 'Sales-focused role for creating and managing bookings and customer interactions.',
    access: [
      'Bookings (view, create, edit)',
      'Vehicles (view only)',
      'Customers (view, create, edit)',
      'Financials (view only)',
    ],
  },
  {
    name: 'FINANCE',
    description: 'Financial operations role with access to invoices, payments, and financial reporting.',
    access: [
      'Bookings (view only)',
      'Invoices (view, create, update status)',
      'Payments (view, create)',
      'Financial reports and analytics',
      'Customer financial information',
    ],
  },
  {
    name: 'INVESTOR',
    description: 'Read-only access for investors to view business metrics, financials, and reports.',
    access: [
      'Bookings (view only)',
      'Vehicles (view only)',
      'Financials (view only)',
      'Reports and analytics (view only)',
      'Dashboard metrics',
    ],
  },
  {
    name: 'CUSTOMER',
    description: 'Customer-facing role for viewing own bookings and profile information.',
    access: [
      'Own bookings (view only)',
      'Own profile (view, edit)',
      'Own invoices (view only)',
      'Own payments (view only)',
    ],
  },
]

export default function RolesPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-headingText">Roles & Permissions</h1>
        <p className="text-bodyText mt-2">
          Overview of system roles and their access permissions
        </p>
      </div>

      {/* Roles Table */}
      <SectionCard title="System Roles">
        <div className="space-y-6">
          {roles.map((role) => (
            <div
              key={role.name}
              className="border border-borderSoft rounded-lg p-6 hover:bg-borderSoft/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-headingText mb-2">
                    {role.name.replace('_', ' ')}
                  </h3>
                  <p className="text-bodyText">{role.description}</p>
                </div>
                <span className="px-3 py-1 bg-sidebarActiveBg/10 text-sidebarActiveBg rounded text-sm font-medium whitespace-nowrap">
                  {role.name}
                </span>
              </div>
              <div>
                <h4 className="text-sm font-medium text-headingText mb-3">Access Permissions:</h4>
                <ul className="space-y-2">
                  {role.access.map((permission, index) => (
                    <li key={index} className="flex items-start gap-2 text-bodyText text-sm">
                      <span className="text-sidebarActiveBg mt-1">•</span>
                      <span>{permission}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Quick Reference Table */}
      <SectionCard title="Quick Reference">
        <Table
          headers={['Role', 'Bookings', 'Vehicles', 'Customers', 'Financials', 'Users']}
        >
          {roles.map((role) => {
            const getAccessLevel = (category: string) => {
              const accessStr = role.access.join(' ').toLowerCase()
              if (accessStr.includes(`${category.toLowerCase()} (view, create, edit`) || accessStr.includes(`all ${category.toLowerCase()}`)) {
                return 'Full'
              }
              if (accessStr.includes(`${category.toLowerCase()} (view only`)) {
                return 'View'
              }
              if (accessStr.includes(`${category.toLowerCase()} (view, create, edit`)) {
                return 'Edit'
              }
              if (accessStr.includes(category.toLowerCase())) {
                return 'Limited'
              }
              return 'None'
            }

            return (
              <TableRow key={role.name}>
                <TableCell className="font-medium text-headingText">
                  {role.name.replace('_', ' ')}
                </TableCell>
                <TableCell>
                  <span className="text-sm text-bodyText">{getAccessLevel('bookings')}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-bodyText">{getAccessLevel('vehicles')}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-bodyText">{getAccessLevel('customers')}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-bodyText">{getAccessLevel('financials')}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-bodyText">{getAccessLevel('users')}</span>
                </TableCell>
              </TableRow>
            )
          })}
        </Table>
      </SectionCard>

      {/* Note */}
      <div className="p-4 bg-sidebarActiveBg/10 border border-sidebarActiveBg/20 rounded-lg">
        <p className="text-sm text-bodyText">
          <strong className="text-headingText">Note:</strong> Role permissions are enforced at the
          API level. Users can only perform actions allowed by their assigned role. Contact a
          system administrator to request role changes or additional permissions.
        </p>
      </div>
    </div>
  )
}

