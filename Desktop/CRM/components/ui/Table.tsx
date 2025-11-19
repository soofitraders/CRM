import { ReactNode } from 'react'

interface TableProps {
  headers: string[]
  children: ReactNode
}

export default function Table({ headers, children }: TableProps) {
  // Safety check - ensure headers is always an array
  const safeHeaders = Array.isArray(headers) ? headers : []
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-borderSoft">
            {safeHeaders.map((header, index) => (
              <th
                key={index}
                className="text-left py-3 px-4 text-sm font-semibold text-headingText"
              >
                {header || ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
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
      className={`border-b border-borderSoft hover:bg-pageBg transition-colors ${
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
}

export function TableCell({ children, className = '' }: TableCellProps) {
  return (
    <td className={`py-3 px-4 text-sm text-bodyText ${className}`}>
      {children}
    </td>
  )
}

