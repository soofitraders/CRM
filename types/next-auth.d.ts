import 'next-auth'
import { UserRole } from '@/lib/models/User'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: UserRole
      status: string
    }
  }

  interface User {
    id: string
    name: string
    email: string
    role: UserRole
    status: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: UserRole
    status: string
  }
}

