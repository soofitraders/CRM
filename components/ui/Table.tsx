import { ReactNode } from 'react'

interface TableProps {
  headers: (string | ReactNode)[]
  children: ReactNode
}

export default function Table({ headers, children }: TableProps) {
  // Safety check - ensure headers is always an array
  const safeHeaders = Array.isArray(headers) ? headers : []
  
  return (
    <div className="overflow-x-auto rounded-lg border border-borderSoft">
      <table className="w-full">
        <thead className="bg-pageBg">
          <tr>
            {safeHeaders.map((header, index) => {
              // Check if header is a checkbox (ReactNode)
              const isCheckbox = typeof header !== 'string' && header !== null
              return (
                <th
                  key={index}
                  className={`py-4 px-6 text-xs font-semibold text-headingText uppercase tracking-wider ${
                    isCheckbox ? 'w-12 text-center' : 'text-left'
                  }`}
                >
                  {header || ''}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="bg-cardBg divide-y divide-borderSoft">{children}</tbody>
      </table>
    </div>
  )
}

interface TableRowProps {
  children: ReactNode
  onClick?: () => void
}

export function TableRow({ children, onClick }: TableRowProps) {
  return (
    <tr
      className={`hover:bg-pageBg/50 transition-colors ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

interface TableCellProps {
  children: ReactNode
  className?: string
  colSpan?: number
}

export function TableCell({ children, className = '', colSpan }: TableCellProps) {
  return (
    <td className={`py-4 px-6 text-sm text-bodyText ${className}`} colSpan={colSpan}>
      {children}
    </td>
  )
}

