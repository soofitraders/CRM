export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import Vehicle from '@/lib/models/Vehicle'
import Booking from '@/lib/models/Booking'
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
    
    // Ignore cache-busting parameter
    const _t = searchParams.get('_t')

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

    const skip = (query.page - 1) * query.limit
    
    // If filtering by AVAILABLE status, exclude vehicles with active bookings
    let vehicleIdsToExclude: string[] = []
    if (query.status === 'AVAILABLE') {
      const now = new Date()
      // Find vehicles that have active bookings (bookings that haven't ended yet)
      // Only exclude vehicles with bookings that are:
      // - Status: PENDING, CONFIRMED, or CHECKED_OUT (not CANCELLED or CHECKED_IN)
      // - AND endDateTime is in the future OR null/undefined (open-ended)
      // Note: CHECKED_OUT bookings with past endDateTime should NOT exclude the vehicle
      // Find active bookings: bookings that haven't ended yet
      // A booking is active if:
      // 1. Status is PENDING, CONFIRMED, or CHECKED_OUT (not CANCELLED or CHECKED_IN)
      // 2. AND endDateTime is in the future OR null/undefined
      const activeBookings = await Booking.find({
        status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_OUT'] },
        $or: [
          { endDateTime: { $gte: now } }, // Booking ends in the future
          { endDateTime: null }, // Open-ended booking
          { endDateTime: { $exists: false } }, // No end date set
        ],
      })
        .select('vehicle endDateTime status')
        .lean()
      
      logger.log(`[Vehicles API] Found ${activeBookings.length} active bookings`)
      logger.log(`[Vehicles API] Current time: ${now.toISOString()}`)
      if (activeBookings.length > 0) {
        logger.log(`[Vehicles API] Sample active booking:`, {
          vehicle: activeBookings[0].vehicle,
          endDateTime: activeBookings[0].endDateTime,
          status: activeBookings[0].status,
        })
      }
      
      vehicleIdsToExclude = activeBookings.map((b: any) => {
        const vehicleId = b.vehicle
        if (!vehicleId) return null
        // Handle both populated and non-populated vehicle references
        if (typeof vehicleId === 'object' && vehicleId._id) {
          return vehicleId._id.toString()
        }
        return vehicleId.toString()
      }).filter(Boolean) as string[]
      
      logger.log(`[Vehicles API] Excluding ${vehicleIdsToExclude.length} vehicles with active bookings`)
      
      // For AVAILABLE filter, include:
      // 1. Vehicles with status AVAILABLE that don't have active bookings
      // 2. Vehicles with status BOOKED/IN_MAINTENANCE that don't have active bookings
      // This ensures vehicles with past bookings are available
      if (vehicleIdsToExclude.length > 0) {
        filter.$and = [
          {
            $or: [
              {
                status: 'AVAILABLE',
                _id: { $nin: vehicleIdsToExclude },
              },
              {
                status: { $in: ['BOOKED', 'IN_MAINTENANCE'] },
                _id: { $nin: vehicleIdsToExclude },
              },
            ],
          },
        ]
      } else {
        // If no active bookings, include all AVAILABLE and BOOKED/IN_MAINTENANCE vehicles
        filter.$and = [
          {
            $or: [
              { status: 'AVAILABLE' },
              { status: { $in: ['BOOKED', 'IN_MAINTENANCE'] } },
            ],
          },
        ]
      }
    }
    
    // Add search filter if provided (combine with existing filters using $and)
    if (query.search) {
      const searchFilter = {
        $or: [
          { plateNumber: { $regex: query.search, $options: 'i' } },
          { brand: { $regex: query.search, $options: 'i' } },
          { model: { $regex: query.search, $options: 'i' } },
          { vin: { $regex: query.search, $options: 'i' } },
        ],
      }
      if (filter.$and) {
        filter.$and.push(searchFilter)
      } else {
        filter.$and = [searchFilter]
      }
    }
    
    // Create cache key
    const cacheKey = CacheKeys.vehicles(JSON.stringify({ filter, page: query.page, limit: query.limit, excludeIds: vehicleIdsToExclude }))
    
    // Use cache
    const result = await cacheQuery(
      cacheKey,
      async () => {
        // Build final filter - the exclusion is already handled in the $or condition above
        const finalFilter = { ...filter }
        
        // Execute queries in parallel
        const [vehicles, total] = await Promise.all([
          Vehicle.find(finalFilter)
            .populate('investor', 'user')
            .sort({ plateNumber: 1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
          Vehicle.countDocuments(finalFilter),
        ])
        
        logger.log(`[Vehicles API] Found ${vehicles.length} vehicles matching filter (total: ${total})`)
        if (query.status === 'AVAILABLE' && vehicles.length > 0) {
          const plateNumbers = vehicles.map((v: any) => `${v.plateNumber} (${v.status})`).slice(0, 10)
          logger.log(`[Vehicles API] Sample vehicles: ${plateNumbers.join(', ')}`)
        }

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

