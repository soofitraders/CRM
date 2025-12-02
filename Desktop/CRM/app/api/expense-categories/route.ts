import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import ExpenseCategory from '@/lib/models/ExpenseCategory'

// GET - List all expense categories
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const filter: any = {}
    if (!includeInactive) {
      filter.isActive = true
    }

    const categories = await ExpenseCategory.find(filter).sort({ name: 1 }).lean()

    return NextResponse.json({ categories })
  } catch (error: any) {
    console.error('Error fetching expense categories:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch expense categories' },
      { status: 500 }
    )
  }
}

// POST - Create new expense category
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await request.json()
    const { name, code, type, isActive } = body

    if (!name || !code || !type) {
      return NextResponse.json(
        { error: 'name, code, and type are required' },
        { status: 400 }
      )
    }

    const category = await ExpenseCategory.create({
      name,
      code: code.toUpperCase().trim(),
      type,
      isActive: isActive !== undefined ? isActive : true,
    })

    return NextResponse.json({ category }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating expense category:', error)
    if (error.code === 11000) {
      return NextResponse.json({ error: 'Category name already exists' }, { status: 400 })
    }
    return NextResponse.json(
      { error: error.message || 'Failed to create expense category' },
      { status: 500 }
    )
  }
}

