import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import Expense from '@/lib/models/Expense'
import ExpenseCategory from '@/lib/models/ExpenseCategory'
import { logger } from '@/lib/utils/performance'

// GET - Get single expense
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

      const expense = await Expense.findOne({
        _id: params.id,
        isDeleted: false,
      })
        .populate('category', 'name type code')
        .populate('salaryRecord', 'month year staffUser')
        .populate({
          path: 'investorPayout',
          select: 'periodFrom periodTo investor',
          populate: {
            path: 'investor',
            select: 'user',
            populate: {
              path: 'user',
              select: 'name',
            },
          },
        })
        .populate({
          path: 'investor',
          select: 'user companyName',
          populate: {
            path: 'user',
            select: 'name email',
          },
        })
        .populate('createdBy', 'name email')
        .lean()

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    return NextResponse.json({ expense })
  } catch (error: any) {
    logger.error('Error fetching expense:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch expense' },
      { status: 500 }
    )
  }
}

// PATCH - Update expense
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

      // Check if expense exists and is linked to salary or investor payout
      const existingExpense = await Expense.findById(params.id)
        .populate('category', 'code')
        .lean()

      if (!existingExpense || existingExpense.isDeleted) {
        return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
      }

      const isSalaryLinked = !!(existingExpense as any).salaryRecord
      const isInvestorPayoutLinked = !!(existingExpense as any).investorPayout
      const categoryDoc = await ExpenseCategory.findById(existingExpense.category).lean()
      const isSalariesCategory = categoryDoc?.code === 'SALARIES'
      const isInvestorPayoutCategory = categoryDoc?.code === 'INVESTOR_PAYOUTS'

      // If linked to salary or investor payout, restrict financial edits
      if (isSalaryLinked || isSalariesCategory || isInvestorPayoutLinked || isInvestorPayoutCategory) {
      const body = await request.json()
      const { category: categoryId, amount, dateIncurred } = body

        // Block financial field changes
        if (categoryId !== undefined || amount !== undefined || dateIncurred !== undefined) {
          const errorMessage = isSalaryLinked || isSalariesCategory
            ? 'This expense is linked to a salary record. To modify amount, category, or date, please edit the salary record in the Salaries module instead.'
            : 'This expense is linked to an investor payout. To modify amount, category, or date, please edit the investor payout in the Investor Payouts module instead.'
          
          return NextResponse.json(
            { error: errorMessage },
            { status: 400 }
          )
        }

      // Allow only non-financial fields
      const updateData: any = {}
      if (body.description !== undefined) updateData.description = body.description
      if (body.branchId !== undefined) updateData.branchId = body.branchId || undefined
      if (body.investor !== undefined) updateData.investor = body.investor || undefined

      const expense = await Expense.findOneAndUpdate(
        { _id: params.id, isDeleted: false },
        updateData,
        { new: true, runValidators: true }
      )
        .populate('category', 'name type code')
        .populate('salaryRecord', 'month year staffUser')
        .populate({
          path: 'investorPayout',
          select: 'periodFrom periodTo investor',
          populate: {
            path: 'investor',
            select: 'user',
            populate: {
              path: 'user',
              select: 'name',
            },
          },
        })
        .populate('createdBy', 'name email')
        .lean()

      return NextResponse.json({ expense })
    }

    // Regular expense - allow all updates
    const body = await request.json()
    const { category, description, amount, currency, dateIncurred, branchId, vehicle, investor } = body

    const updateData: any = {}
    if (category !== undefined) updateData.category = category
    if (description !== undefined) updateData.description = description
    if (amount !== undefined) updateData.amount = parseFloat(amount)
    if (currency !== undefined) updateData.currency = currency
    if (dateIncurred !== undefined) updateData.dateIncurred = new Date(dateIncurred)
    if (branchId !== undefined) updateData.branchId = branchId || undefined
    if (vehicle !== undefined) updateData.vehicle = vehicle || undefined
    if (investor !== undefined) updateData.investor = investor || undefined

    const expense = await Expense.findOneAndUpdate(
      { _id: params.id, isDeleted: false },
      updateData,
      { new: true, runValidators: true }
    )
      .populate('category', 'name type code')
      .populate('salaryRecord')
        .populate({
          path: 'investor',
          select: 'user companyName',
          populate: {
            path: 'user',
            select: 'name email',
          },
        })
        .populate('createdBy', 'name email')
        .lean()

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    return NextResponse.json({ expense })
  } catch (error: any) {
    logger.error('Error updating expense:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update expense' },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete expense
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

      // Check if expense exists and is linked to salary or investor payout
      let expense
      try {
        expense = await Expense.findById(params.id)
          .populate('category', 'code')
          .populate('salaryRecord')
          .populate('investorPayout')
          .lean()
      } catch (populateError: any) {
        logger.error('Error populating expense for delete:', populateError)
        // Fallback: try without populate
        expense = await Expense.findById(params.id).lean()
      }

      if (!expense) {
        return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
      }

      if (expense.isDeleted) {
        return NextResponse.json({ error: 'Expense already deleted' }, { status: 400 })
      }

      // Check if linked to salary or investor payout
      const isSalaryLinked = !!(expense as any).salaryRecord
      const isInvestorPayoutLinked = !!(expense as any).investorPayout

      // Check category code
      let isSalariesCategory = false
      let isInvestorPayoutCategory = false
      if (expense.category) {
        const categoryId = typeof expense.category === 'object'
          ? (expense.category as any)._id || (expense.category as any).id
          : expense.category

        if (categoryId) {
          const category = await ExpenseCategory.findById(categoryId).select('code').lean()
          isSalariesCategory = category?.code === 'SALARIES'
          isInvestorPayoutCategory = category?.code === 'INVESTOR_PAYOUTS'
        }
      }

      // Block deletion of salary-linked or investor payout-linked expenses
      if (isSalaryLinked || isSalariesCategory || isInvestorPayoutLinked || isInvestorPayoutCategory) {
        const errorMessage = isSalaryLinked || isSalariesCategory
          ? 'This expense is linked to a salary record. To delete it, please delete the salary record in the Salaries module instead.'
          : 'This expense is linked to an investor payout. To delete it, please cancel the investor payout in the Investor Payouts module instead.'
        
        return NextResponse.json(
          { error: errorMessage },
          { status: 400 }
        )
      }

    // Soft delete regular expense
    const deletedExpense = await Expense.findOneAndUpdate(
      { _id: params.id, isDeleted: false },
      { isDeleted: true },
      { new: true }
    )

    if (!deletedExpense) {
      return NextResponse.json(
        { error: 'Expense not found or already deleted' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Expense deleted successfully' })
  } catch (error: any) {
    logger.error('Error deleting expense:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete expense' },
      { status: 500 }
    )
  }
}

