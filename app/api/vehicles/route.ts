export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import Vehicle from '@/lib/models/Vehicle'
// Import models to ensure they're registered with Mongoose before populate
import InvestorProfile from '@/lib/models/InvestorProfile'
import User from '@/lib/models/User'
import { vehicleQuerySchema, createVehicleSchema } from '@/lib/validation/vehicle'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { cacheQuery } from '@/lib/cache/cacheUtils'
import { CacheKeys } from '@/lib/cache/cacheKeys'
import { invalidateVehicleCache } from '@/lib/cache/cacheUtils'
import { logger } from '@/lib/utils/performance'

// Ensure models are registered by referencing them
// This ensures Mongoose knows about InvestorProfile when populating
if (typeof InvestorProfile !== 'undefined') {
  // Model is registered
}

// GET - List vehicles with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    // Ensure InvestorProfile model is registered before populate
    if (!InvestorProfile) {
      throw new Error('InvestorProfile model not available')
    }

    const searchParams = request.nextUrl.searchParams
    const query = vehicleQuerySchema.parse({
      status: searchParams.get('status') || undefined,
      ownershipType: searchParams.get('ownershipType') || undefined,
      branch: searchParams.get('branch') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '10',
    })

    const filter: any = {}

    if (query.status) {
      filter.status = query.status
    }

    if (query.ownershipType) {
      filter.ownershipType = query.ownershipType
    }

    if (query.branch) {
      filter.currentBranch = query.branch
    }

    if (query.search) {
      filter.$or = [
        { plateNumber: { $regex: query.search, $options: 'i' } },
        { brand: { $regex: query.search, $options: 'i' } },
        { model: { $regex: query.search, $options: 'i' } },
        { vin: { $regex: query.search, $options: 'i' } },
      ]
    }

    const skip = (query.page - 1) * query.limit
    
    // Create cache key
    const cacheKey = CacheKeys.vehicles(JSON.stringify({ filter, page: query.page, limit: query.limit }))
    
    // Use cache
    const result = await cacheQuery(
      cacheKey,
      async () => {
        // Execute queries in parallel
        const [vehicles, total] = await Promise.all([
          Vehicle.find(filter)
            .populate('investor', 'user')
            .sort({ plateNumber: 1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
          Vehicle.countDocuments(filter),
        ])

        return { vehicles, total }
      },
      60 // Cache for 1 minute
    )

    return NextResponse.json({
      vehicles: result.vehicles,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        pages: Math.ceil(result.total / query.limit),
      },
    })
  } catch (error: any) {
    logger.error('Error fetching vehicles:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch vehicles' },
      { status: 500 }
    )
  }
}

// POST - Create vehicle
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    // Check permissions
    const user = await getCurrentUser()
    if (!user || !hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data = createVehicleSchema.parse(body)

    // Validate investor is required if ownershipType is INVESTOR
    if (data.ownershipType === 'INVESTOR' && !data.investor) {
      return NextResponse.json(
        { error: 'Investor is required for investor-owned vehicles' },
        { status: 400 }
      )
    }

    const vehicle = new Vehicle({
      ...data,
      registrationExpiry: new Date(data.registrationExpiry),
      insuranceExpiry: new Date(data.insuranceExpiry),
      investor: data.ownershipType === 'INVESTOR' ? data.investor : undefined,
    })

    await vehicle.save()

    // Invalidate cache
    invalidateVehicleCache((vehicle._id as any)?.toString())

    const populatedVehicle = await Vehicle.findById(vehicle._id as any)
      .populate('investor', 'user')
      .lean()

    return NextResponse.json({ vehicle: populatedVehicle }, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0]
      return NextResponse.json(
        { error: `${field} already exists` },
        { status: 400 }
      )
    }
    logger.error('Error creating vehicle:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create vehicle' },
      { status: 500 }
    )
  }
}

