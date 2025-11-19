import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import CustomerProfile from '@/lib/models/CustomerProfile'
import User from '@/lib/models/User'
import { updateCustomerSchema } from '@/lib/validation/customer'
import { hasRole, getCurrentUser } from '@/lib/auth'
import bcrypt from 'bcryptjs'

// GET - Get single customer with stats
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const customer = await CustomerProfile.findById(params.id)
      .populate('user', 'name email status role')
      .lean()

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Get customer stats
    const Booking = await import('@/lib/models/Booking').then((m) => m.default)
    const Payment = await import('@/lib/models/Payment').then((m) => m.default)
    const FineOrPenalty = await import('@/lib/models/FineOrPenalty').then((m) => m.default)

    const activeBookings = await Booking.countDocuments({
      customer: params.id,
      status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_OUT'] },
    })

    const totalBookings = await Booking.countDocuments({
      customer: params.id,
    })

    const lastBooking = await Booking.findOne({ customer: params.id })
      .sort({ createdAt: -1 })
      .select('createdAt')
      .lean()

    const totalPayments = await Payment.aggregate([
      {
        $lookup: {
          from: 'bookings',
          localField: 'booking',
          foreignField: '_id',
          as: 'booking',
        },
      },
      {
        $match: {
          'booking.customer': params.id,
          status: 'SUCCESS',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ])

    const totalFines = await FineOrPenalty.aggregate([
      {
        $match: {
          customer: params.id,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          paid: {
            $sum: {
              $cond: [{ $eq: ['$status', 'PAID'] }, '$amount', 0],
            },
          },
        },
      },
    ])

    return NextResponse.json({
      customer,
      stats: {
        activeBookings,
        totalBookings,
        lastBookingDate: lastBooking?.createdAt || null,
        totalPayments: totalPayments[0]?.total || 0,
        totalFines: totalFines[0]?.total || 0,
        paidFines: totalFines[0]?.paid || 0,
      },
    })
  } catch (error: any) {
    console.error('Error fetching customer:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch customer' },
      { status: 500 }
    )
  }
}

// PATCH - Update customer
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check permissions
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES_AGENT'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const customer = await CustomerProfile.findById(params.id).populate('user')
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const body = await request.json()
    const data = updateCustomerSchema.parse(body)

    // Update User fields
    if (data.name !== undefined) {
      ;(customer.user as any).name = data.name
    }
    if (data.email !== undefined) {
      ;(customer.user as any).email = data.email.toLowerCase()
    }
    if (data.password !== undefined) {
      ;(customer.user as any).passwordHash = await bcrypt.hash(data.password, 12)
    }
    await (customer.user as any).save()

    // Update CustomerProfile fields
    if (data.nationalId !== undefined) customer.nationalId = data.nationalId
    if (data.passportNumber !== undefined)
      customer.passportNumber = data.passportNumber
    if (data.drivingLicenseNumber !== undefined)
      customer.drivingLicenseNumber = data.drivingLicenseNumber.toUpperCase()
    if (data.drivingLicenseCountry !== undefined)
      customer.drivingLicenseCountry = data.drivingLicenseCountry
    if (data.drivingLicenseExpiry !== undefined)
      customer.drivingLicenseExpiry = new Date(data.drivingLicenseExpiry)
    if (data.phone !== undefined) customer.phone = data.phone
    if (data.alternatePhone !== undefined) customer.alternatePhone = data.alternatePhone
    if (data.addressLine1 !== undefined) customer.addressLine1 = data.addressLine1
    if (data.city !== undefined) customer.city = data.city
    if (data.country !== undefined) customer.country = data.country
    if (data.emergencyContactName !== undefined)
      customer.emergencyContactName = data.emergencyContactName
    if (data.emergencyContactPhone !== undefined)
      customer.emergencyContactPhone = data.emergencyContactPhone

    await customer.save()

    const updatedCustomer = await CustomerProfile.findById(customer._id)
      .populate('user', 'name email status')
      .lean()

    return NextResponse.json({ customer: updatedCustomer })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating customer:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update customer' },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete (set User status to INACTIVE)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check permissions
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES_AGENT'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const customer = await CustomerProfile.findById(params.id).populate('user')
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Soft delete by setting user status to INACTIVE
    ;(customer.user as any).status = 'INACTIVE'
    await (customer.user as any).save()

    return NextResponse.json({ message: 'Customer deactivated successfully' })
  } catch (error: any) {
    console.error('Error deleting customer:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete customer' },
      { status: 500 }
    )
  }
}

