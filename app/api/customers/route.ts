export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import CustomerProfile from '@/lib/models/CustomerProfile'
import User from '@/lib/models/User'
import { createCustomerSchema, customerQuerySchema } from '@/lib/validation/customer'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { jsonResponse } from '@/lib/utils/apiResponse'
import bcrypt from 'bcryptjs'
import { cacheQuery } from '@/lib/cache/cacheUtils'
import { CacheKeys } from '@/lib/cache/cacheKeys'
import { invalidateCustomerCache } from '@/lib/cache/cacheUtils'
import { logger } from '@/lib/utils/performance'

// GET - List customers with search
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const query = customerQuerySchema.parse({
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '10',
    })

    let filter: any = {}

    if (query.search) {
      // Search in user name/email first
      const userFilter = {
        role: 'CUSTOMER',
        $or: [
          { name: { $regex: query.search, $options: 'i' } },
          { email: { $regex: query.search, $options: 'i' } },
        ],
      }
      const matchingUsers = await User.find(userFilter).select('_id').lean()
      const userIds = matchingUsers.map((u) => u._id)

      // Search in customer profile fields
      const searchRegex = { $regex: query.search, $options: 'i' }
      const profileFilter = {
        $or: [
          { drivingLicenseNumber: searchRegex },
          { nationalId: searchRegex },
          { passportNumber: searchRegex },
          { phone: searchRegex },
          { alternatePhone: searchRegex },
        ],
      }

      // Combine filters
      if (userIds.length > 0) {
        filter = {
          $or: [
            { user: { $in: userIds } },
            profileFilter,
          ],
        }
      } else {
        filter = profileFilter
      }
    }

    const skip = (query.page - 1) * query.limit
    
    // Create cache key
    const cacheKey = CacheKeys.customers(JSON.stringify({ filter, page: query.page, limit: query.limit }))
    
    // Use cache
    const result = await cacheQuery(
      cacheKey,
      async () => {
        // Execute main query
        const customers = await CustomerProfile.find(filter)
          .populate('user', 'name email status')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(query.limit)
          .lean()

        const total = await CustomerProfile.countDocuments(filter)

        // Batch fetch stats for all customers to avoid N+1 queries
        const customerIds = customers.map((c) => c._id)
        const Booking = await import('@/lib/models/Booking').then((m) => m.default)
        
        // Execute aggregation queries in parallel
        const [activeBookings, lastBookings] = await Promise.all([
          customerIds.length > 0
            ? Booking.aggregate([
                {
                  $match: {
                    customer: { $in: customerIds },
                    status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_OUT'] },
                  },
                },
                {
                  $group: {
                    _id: '$customer',
                    count: { $sum: 1 },
                  },
                },
              ])
            : Promise.resolve([]),
          customerIds.length > 0
            ? Booking.aggregate([
                {
                  $match: {
                    customer: { $in: customerIds },
                  },
                },
                {
                  $sort: { createdAt: -1 },
                },
                {
                  $group: {
                    _id: '$customer',
                    lastBookingDate: { $first: '$createdAt' },
                  },
                },
              ])
            : Promise.resolve([]),
        ])

        // Build maps
        const activeBookingsMap = new Map<string, number>()
        activeBookings.forEach((item) => {
          activeBookingsMap.set(item._id.toString(), item.count)
        })

        const lastBookingMap = new Map<string, Date>()
        lastBookings.forEach((item) => {
          lastBookingMap.set(item._id.toString(), item.lastBookingDate)
        })

        // Attach stats to customers
        const customersWithStats = customers.map((customer) => ({
          ...customer,
          activeBookings: activeBookingsMap.get(customer._id.toString()) || 0,
          lastBookingDate: lastBookingMap.get(customer._id.toString()) || null,
        }))

        return {
          customers: customersWithStats,
          pagination: {
            page: query.page,
            limit: query.limit,
            total,
            pages: Math.ceil(total / query.limit),
          },
        }
      },
      60 // Cache for 1 minute
    )

    return jsonResponse(result, 200, { cache: 60 })
  } catch (error: any) {
    logger.error('Error fetching customers:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch customers' },
      { status: 500 }
    )
  }
}

// POST - Create customer (and underlying User)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    // Check permissions
    const user = await getCurrentUser()
    if (!user || !hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES_AGENT'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data = createCustomerSchema.parse(body)

    // Check if user with email already exists
    const existingUser = await User.findOne({ email: data.email.toLowerCase() })
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Create User first
    const passwordHash = data.password
      ? await bcrypt.hash(data.password, 12)
      : await bcrypt.hash('TempPassword123!', 12) // Default password if not provided

    const newUser = new User({
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash,
      role: 'CUSTOMER',
      status: 'ACTIVE',
    })

    await newUser.save()

    // Create CustomerProfile
    const customerProfile = new CustomerProfile({
      user: newUser._id,
      nationalId: data.nationalId,
      passportNumber: data.passportNumber,
      drivingLicenseNumber: data.drivingLicenseNumber.toUpperCase(),
      drivingLicenseCountry: data.drivingLicenseCountry,
      drivingLicenseExpiry: new Date(data.drivingLicenseExpiry),
      phone: data.phone,
      alternatePhone: data.alternatePhone,
      tradeLicenseNumber: data.tradeLicenseNumber,
      taxId: data.taxId,
      addressLine1: data.addressLine1,
      city: data.city,
      country: data.country,
      emergencyContactName: data.emergencyContactName,
      emergencyContactPhone: data.emergencyContactPhone,
    })

    await customerProfile.save()

    const populatedCustomer = await CustomerProfile.findById(customerProfile._id)
      .populate('user', 'name email status')
      .lean()

    return NextResponse.json({ customer: populatedCustomer }, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0]
      return NextResponse.json(
        { error: `${field} already exists` },
        { status: 400 }
      )
    }
    logger.error('Error creating customer:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create customer' },
      { status: 500 }
    )
  }
}
