import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subWeeks, subMonths } from 'date-fns'
import Booking from '@/lib/models/Booking'
import Vehicle from '@/lib/models/Vehicle'
import Invoice from '@/lib/models/Invoice'
import Payment from '@/lib/models/Payment'
import CustomerProfile from '@/lib/models/CustomerProfile'

// GET - Get dashboard metrics based on widget type
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const widgetType = searchParams.get('type') as string
    const timeRange = searchParams.get('timeRange') as string || 'MONTH'
    const limit = parseInt(searchParams.get('limit') || '10')

    let metrics: any = {}

    switch (widgetType) {
      case 'REVENUE_SUMMARY': {
        const now = new Date()
        let startDate: Date
        let endDate: Date = endOfDay(now)
        let previousStartDate: Date
        let previousEndDate: Date

        switch (timeRange) {
          case 'DAY':
            startDate = startOfDay(now)
            previousStartDate = startOfDay(subDays(now, 1))
            previousEndDate = endOfDay(subDays(now, 1))
            break
          case 'WEEK':
            startDate = startOfWeek(now, { weekStartsOn: 0 })
            endDate = endOfWeek(now, { weekStartsOn: 0 })
            previousStartDate = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 })
            previousEndDate = endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 })
            break
          case 'MONTH':
            startDate = startOfMonth(now)
            endDate = endOfMonth(now)
            previousStartDate = startOfMonth(subMonths(now, 1))
            previousEndDate = endOfMonth(subMonths(now, 1))
            break
          case 'YEAR':
            startDate = startOfYear(now)
            endDate = endOfYear(now)
            previousStartDate = startOfYear(new Date(now.getFullYear() - 1, 0, 1))
            previousEndDate = endOfYear(new Date(now.getFullYear() - 1, 11, 31))
            break
          default:
            startDate = startOfMonth(now)
            endDate = endOfMonth(now)
            previousStartDate = startOfMonth(subMonths(now, 1))
            previousEndDate = endOfMonth(subMonths(now, 1))
        }

        const [currentRevenue, previousRevenue] = await Promise.all([
          Payment.aggregate([
            {
              $match: {
                status: 'SUCCESS',
                paidAt: { $gte: startDate, $lte: endDate },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$amount' },
              },
            },
          ]),
          Payment.aggregate([
            {
              $match: {
                status: 'SUCCESS',
                paidAt: { $gte: previousStartDate, $lte: previousEndDate },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$amount' },
              },
            },
          ]),
        ])

        const current = currentRevenue[0]?.total || 0
        const previous = previousRevenue[0]?.total || 0
        const growth = previous > 0 ? ((current - previous) / previous) * 100 : 0

        metrics = {
          current,
          previous,
          growth,
          timeRange,
        }
        break
      }

      case 'BOOKING_TRENDS': {
        const now = new Date()
        let startDate: Date
        let endDate: Date = endOfDay(now)

        switch (timeRange) {
          case 'DAY':
            startDate = startOfDay(now)
            // Get hourly data for the day
            const hourlyData = []
            for (let i = 0; i < 24; i++) {
              const hourStart = new Date(now)
              hourStart.setHours(i, 0, 0, 0)
              const hourEnd = new Date(now)
              hourEnd.setHours(i, 59, 59, 999)
              const count = await Booking.countDocuments({
                createdAt: { $gte: hourStart, $lte: hourEnd },
                status: { $in: ['CONFIRMED', 'CHECKED_OUT', 'CHECKED_IN'] },
              })
              hourlyData.push({ period: `${i}:00`, count })
            }
            metrics = { data: hourlyData, timeRange: 'DAY' }
            break
          case 'WEEK':
            startDate = startOfWeek(now, { weekStartsOn: 0 })
            endDate = endOfWeek(now, { weekStartsOn: 0 })
            const dailyData = []
            for (let i = 0; i < 7; i++) {
              const dayStart = new Date(startDate)
              dayStart.setDate(startDate.getDate() + i)
              const dayEnd = endOfDay(dayStart)
              const count = await Booking.countDocuments({
                createdAt: { $gte: startOfDay(dayStart), $lte: dayEnd },
                status: { $in: ['CONFIRMED', 'CHECKED_OUT', 'CHECKED_IN'] },
              })
              dailyData.push({ period: dayStart.toLocaleDateString('en-US', { weekday: 'short' }), count })
            }
            metrics = { data: dailyData, timeRange: 'WEEK' }
            break
          case 'MONTH':
            startDate = startOfMonth(now)
            endDate = endOfMonth(now)
            const daysInMonth = endDate.getDate()
            const monthlyData = []
            for (let i = 1; i <= daysInMonth; i++) {
              const dayStart = new Date(now.getFullYear(), now.getMonth(), i)
              const dayEnd = endOfDay(dayStart)
              const count = await Booking.countDocuments({
                createdAt: { $gte: startOfDay(dayStart), $lte: dayEnd },
                status: { $in: ['CONFIRMED', 'CHECKED_OUT', 'CHECKED_IN'] },
              })
              monthlyData.push({ period: i.toString(), count })
            }
            metrics = { data: monthlyData, timeRange: 'MONTH' }
            break
          default:
            metrics = { data: [], timeRange }
        }
        break
      }

      case 'ACTIVE_VEHICLES': {
        const [available, booked, maintenance, inactive] = await Promise.all([
          Vehicle.countDocuments({ status: 'AVAILABLE' }),
          Vehicle.countDocuments({ status: 'BOOKED' }),
          Vehicle.countDocuments({ status: 'IN_MAINTENANCE' }),
          Vehicle.countDocuments({ status: 'INACTIVE' }),
        ])

        metrics = {
          available,
          booked,
          maintenance,
          inactive,
          total: available + booked + maintenance + inactive,
        }
        break
      }

      case 'TOP_PERFORMING_VEHICLES': {
        const now = new Date()
        const startDate = startOfMonth(now)
        const endDate = endOfMonth(now)

        const topVehicles = await Invoice.aggregate([
          {
            $match: {
              issueDate: { $gte: startDate, $lte: endDate },
              status: { $in: ['ISSUED', 'PAID'] },
            },
          },
          {
            $lookup: {
              from: 'bookings',
              localField: 'booking',
              foreignField: '_id',
              as: 'bookingData',
            },
          },
          {
            $unwind: '$bookingData',
          },
          {
            $lookup: {
              from: 'vehicles',
              localField: 'bookingData.vehicle',
              foreignField: '_id',
              as: 'vehicleData',
            },
          },
          {
            $unwind: '$vehicleData',
          },
          {
            $group: {
              _id: '$vehicleData._id',
              plateNumber: { $first: '$vehicleData.plateNumber' },
              brand: { $first: '$vehicleData.brand' },
              model: { $first: '$vehicleData.model' },
              revenue: { $sum: '$total' },
              bookingsCount: { $sum: 1 },
            },
          },
          {
            $sort: { revenue: -1 },
          },
          {
            $limit: limit,
          },
        ])

        metrics = {
          vehicles: topVehicles.map((v) => ({
            vehicleId: v._id.toString(),
            plateNumber: v.plateNumber,
            brand: v.brand,
            model: v.model,
            revenue: v.revenue,
            bookingsCount: v.bookingsCount,
          })),
        }
        break
      }

      case 'CUSTOMER_ACQUISITION': {
        const now = new Date()
        const startDate = startOfMonth(now)
        const endDate = endOfMonth(now)
        const previousStartDate = startOfMonth(subMonths(now, 1))
        const previousEndDate = endOfMonth(subMonths(now, 1))

        const [currentCustomers, previousCustomers] = await Promise.all([
          CustomerProfile.countDocuments({
            createdAt: { $gte: startDate, $lte: endDate },
          }),
          CustomerProfile.countDocuments({
            createdAt: { $gte: previousStartDate, $lte: previousEndDate },
          }),
        ])

        const growth = previousCustomers > 0 
          ? ((currentCustomers - previousCustomers) / previousCustomers) * 100 
          : currentCustomers > 0 ? 100 : 0

        metrics = {
          current: currentCustomers,
          previous: previousCustomers,
          growth,
        }
        break
      }

      default:
        return NextResponse.json({ error: 'Invalid widget type' }, { status: 400 })
    }

    return NextResponse.json({ metrics })
  } catch (error: any) {
    console.error('Error fetching dashboard metrics:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard metrics' },
      { status: 500 }
    )
  }
}

