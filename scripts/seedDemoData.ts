import { config } from 'dotenv'
import { resolve } from 'path'
import connectDB from '../lib/db'
import User from '../lib/models/User'
import Vehicle from '../lib/models/Vehicle'
import CustomerProfile from '../lib/models/CustomerProfile'
import Booking from '../lib/models/Booking'
import Invoice from '../lib/models/Invoice'
import MaintenanceRecord from '../lib/models/MaintenanceRecord'
import { createInvoiceFromBooking } from '../lib/services/invoiceService'

// Load environment variables
const envPath = resolve(process.cwd(), '.env')
config({ path: envPath })

// UAE-style data generators
const uaeEmirates = ['DXB', 'AUH', 'SHJ', 'AJM', 'RAK', 'FJH', 'UMM']
const uaeNames = [
  'Ahmed Al Mansoori',
  'Fatima Al Zaabi',
  'Mohammed Al Suwaidi',
  'Sarah Al Dhaheri',
  'Khalid Al Nuaimi',
  'Mariam Al Qasimi',
  'Omar Al Shamsi',
  'Layla Al Mazrouei',
  'Youssef Al Dhaheri',
  'Aisha Al Falasi',
]

const uaeCities = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah']
const branches = ['Dubai Marina', 'Abu Dhabi Downtown', 'Sharjah Airport', 'Dubai Mall']

const vehicleBrands = [
  { brand: 'Toyota', models: ['Camry', 'Corolla', 'Land Cruiser', 'Prado', 'Yaris'] },
  { brand: 'Honda', models: ['Accord', 'Civic', 'CR-V', 'Pilot'] },
  { brand: 'Nissan', models: ['Altima', 'Sentra', 'Patrol', 'X-Trail'] },
  { brand: 'BMW', models: ['3 Series', '5 Series', 'X5', 'X3'] },
  { brand: 'Mercedes', models: ['C-Class', 'E-Class', 'GLE', 'A-Class'] },
  { brand: 'Audi', models: ['A4', 'A6', 'Q5', 'Q7'] },
]

function generatePlateNumber(): string {
  const emirate = uaeEmirates[Math.floor(Math.random() * uaeEmirates.length)]
  const number = Math.floor(Math.random() * 99999) + 1
  return `${emirate}-${number.toString().padStart(5, '0')}`
}

function generateVIN(): string {
  const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'
  let vin = ''
  for (let i = 0; i < 17; i++) {
    vin += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return vin
}

function generatePhoneNumber(): string {
  return `+971${Math.floor(Math.random() * 90000000) + 50000000}`
}

async function seedDemoData() {
  try {
    console.log('🌱 Starting demo data seeding...\n')
    console.log('Connecting to MongoDB...')
    await connectDB()
    console.log('✓ Connected successfully\n')

    // Get or create an admin user for bookings
    let adminUser = await User.findOne({ role: { $in: ['SUPER_ADMIN', 'ADMIN'] } })
    if (!adminUser) {
      console.log('Creating admin user for bookings...')
      const bcrypt = await import('bcryptjs')
      const passwordHash = await bcrypt.default.hash('Admin123!', 12)
      adminUser = await User.create({
        name: 'System Admin',
        email: 'admin@misterwheels.com',
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      })
      console.log('✓ Admin user created\n')
    }

    // Create Vehicles
    console.log('Creating vehicles...')
    const vehicles = []
    for (let i = 0; i < 15; i++) {
      const brandData = vehicleBrands[Math.floor(Math.random() * vehicleBrands.length)]
      const model = brandData.models[Math.floor(Math.random() * brandData.models.length)]
      const year = 2020 + Math.floor(Math.random() * 5)
      const category = ['SEDAN', 'SUV', 'HATCHBACK'][Math.floor(Math.random() * 3)] as any
      const dailyRate = Math.floor(Math.random() * 200) + 100 // 100-300 AED
      const weeklyRate = dailyRate * 6
      const monthlyRate = dailyRate * 25

      const registrationExpiry = new Date()
      registrationExpiry.setMonth(registrationExpiry.getMonth() + Math.floor(Math.random() * 12) + 1)

      const insuranceExpiry = new Date()
      insuranceExpiry.setMonth(insuranceExpiry.getMonth() + Math.floor(Math.random() * 12) + 1)

      const vehicle = await Vehicle.create({
        plateNumber: generatePlateNumber(),
        vin: generateVIN(),
        brand: brandData.brand,
        model,
        year,
        category,
        ownershipType: 'COMPANY',
        status: ['AVAILABLE', 'BOOKED', 'IN_MAINTENANCE'][Math.floor(Math.random() * 3)] as any,
        mileage: Math.floor(Math.random() * 50000) + 10000,
        fuelType: ['PETROL', 'DIESEL', 'HYBRID'][Math.floor(Math.random() * 3)] as any,
        transmission: ['AUTOMATIC', 'MANUAL'][Math.floor(Math.random() * 2)] as any,
        registrationExpiry,
        insuranceExpiry,
        dailyRate,
        weeklyRate,
        monthlyRate,
        currentBranch: branches[Math.floor(Math.random() * branches.length)],
      })
      vehicles.push(vehicle)
    }
    console.log(`✓ Created ${vehicles.length} vehicles\n`)

    // Create Customer Users and Profiles
    console.log('Creating customers...')
    const customers = []
    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.default.hash('Customer123!', 12)

    for (let i = 0; i < 10; i++) {
      const name = uaeNames[i]
      const email = `customer${i + 1}@example.com`
      
      // Check if user exists
      let user = await User.findOne({ email })
      if (!user) {
        user = await User.create({
          name,
          email,
          passwordHash,
          role: 'CUSTOMER',
          status: 'ACTIVE',
        })
      }

      // Check if customer profile exists
      let customerProfile = await CustomerProfile.findOne({ user: user._id })
      if (!customerProfile) {
        const licenseExpiry = new Date()
        licenseExpiry.setFullYear(licenseExpiry.getFullYear() + 2)

        customerProfile = await CustomerProfile.create({
          user: user._id,
          drivingLicenseNumber: `UAE${Math.floor(Math.random() * 999999) + 100000}`,
          drivingLicenseCountry: 'UAE',
          drivingLicenseExpiry: licenseExpiry,
          phone: generatePhoneNumber(),
          addressLine1: `${Math.floor(Math.random() * 999) + 1} Street`,
          city: uaeCities[Math.floor(Math.random() * uaeCities.length)],
          country: 'UAE',
          emergencyContactName: `Emergency Contact ${i + 1}`,
          emergencyContactPhone: generatePhoneNumber(),
        })
      }
      customers.push(customerProfile)
    }
    console.log(`✓ Created ${customers.length} customers\n`)

    // Create Bookings
    console.log('Creating bookings...')
    const bookings = []
    const today = new Date()
    
    for (let i = 0; i < 20; i++) {
      const vehicle = vehicles[Math.floor(Math.random() * vehicles.length)]
      const customer = customers[Math.floor(Math.random() * customers.length)]
      const rentalType = ['DAILY', 'WEEKLY', 'MONTHLY'][Math.floor(Math.random() * 3)] as any
      
      const daysOffset = Math.floor(Math.random() * 60) - 30 // -30 to +30 days
      const startDate = new Date(today)
      startDate.setDate(startDate.getDate() + daysOffset)
      startDate.setHours(10, 0, 0, 0)

      const duration = rentalType === 'DAILY' ? 1 + Math.floor(Math.random() * 7) :
                      rentalType === 'WEEKLY' ? 7 + Math.floor(Math.random() * 14) :
                      30 + Math.floor(Math.random() * 30)
      
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + duration)
      endDate.setHours(18, 0, 0, 0)

      const baseRate = rentalType === 'DAILY' ? vehicle.dailyRate * duration :
                      rentalType === 'WEEKLY' ? vehicle.weeklyRate * Math.ceil(duration / 7) :
                      vehicle.monthlyRate * Math.ceil(duration / 30)
      
      const discounts = Math.random() > 0.7 ? baseRate * 0.1 : 0
      const subtotal = baseRate - discounts
      const taxes = subtotal * 0.05 // 5% VAT
      const totalAmount = subtotal + taxes
      const depositAmount = totalAmount * 0.2 // 20% deposit

      const statuses: any[] = ['PENDING', 'CONFIRMED', 'CHECKED_OUT', 'CHECKED_IN', 'CANCELLED']
      const status = statuses[Math.floor(Math.random() * statuses.length)]
      
      const paymentStatuses: any[] = ['UNPAID', 'PARTIALLY_PAID', 'PAID']
      const paymentStatus = paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)]

      const booking = await Booking.create({
        vehicle: vehicle._id,
        customer: customer._id,
        bookedBy: adminUser._id,
        startDateTime: startDate,
        endDateTime: endDate,
        pickupBranch: branches[Math.floor(Math.random() * branches.length)],
        dropoffBranch: branches[Math.floor(Math.random() * branches.length)],
        status,
        rentalType,
        baseRate,
        discounts,
        taxes,
        totalAmount,
        depositAmount,
        depositStatus: 'HELD',
        paymentStatus,
        notes: i % 3 === 0 ? 'Special request: GPS navigation required' : undefined,
      })
      bookings.push(booking)
    }
    console.log(`✓ Created ${bookings.length} bookings\n`)

    // Create Invoices for confirmed bookings
    console.log('Creating invoices...')
    let invoiceCount = 0
    for (const booking of bookings) {
      if (booking.status === 'CONFIRMED' || booking.status === 'CHECKED_OUT') {
        try {
          await createInvoiceFromBooking(booking._id.toString())
          invoiceCount++
        } catch (error: any) {
          // Invoice might already exist, skip
          if (!error.message.includes('already exists')) {
            console.log(`  Warning: Could not create invoice for booking ${booking._id}`)
          }
        }
      }
    }
    console.log(`✓ Created ${invoiceCount} invoices\n`)

    // Create Maintenance Records
    console.log('Creating maintenance records...')
    const maintenanceTypes: any[] = ['SERVICE', 'REPAIR', 'ACCIDENT', 'INSPECTION']
    const maintenanceStatuses: any[] = ['OPEN', 'IN_PROGRESS', 'COMPLETED']
    const maintenanceRecords = []

    for (let i = 0; i < 10; i++) {
      const vehicle = vehicles[Math.floor(Math.random() * vehicles.length)]
      const type = maintenanceTypes[Math.floor(Math.random() * maintenanceTypes.length)]
      const status = maintenanceStatuses[Math.floor(Math.random() * maintenanceStatuses.length)]
      
      const scheduledDate = new Date()
      scheduledDate.setDate(scheduledDate.getDate() + Math.floor(Math.random() * 30) - 15)

      const completedDate = status === 'COMPLETED' ? new Date(scheduledDate) : undefined
      if (completedDate) {
        completedDate.setDate(completedDate.getDate() + Math.floor(Math.random() * 5))
      }

      const descriptions = [
        'Regular service and oil change',
        'Brake pad replacement',
        'Tire rotation and alignment',
        'Engine diagnostic and repair',
        'AC system service',
        'Battery replacement',
        'Annual inspection',
        'Windshield replacement',
        'Transmission service',
        'Bodywork repair',
      ]

      const record = await MaintenanceRecord.create({
        vehicle: vehicle._id,
        type,
        description: descriptions[Math.floor(Math.random() * descriptions.length)],
        status,
        scheduledDate,
        completedDate,
        cost: Math.floor(Math.random() * 2000) + 200, // 200-2200 AED
        vendorName: ['Al Futtaim', 'AGMC', 'Al Tayer Motors', 'Independent Garage'][
          Math.floor(Math.random() * 4)
        ],
        createdBy: adminUser._id,
      })
      maintenanceRecords.push(record)
    }
    console.log(`✓ Created ${maintenanceRecords.length} maintenance records\n`)

    console.log('✅ Demo data seeding completed successfully!\n')
    console.log('Summary:')
    console.log(`  - Vehicles: ${vehicles.length}`)
    console.log(`  - Customers: ${customers.length}`)
    console.log(`  - Bookings: ${bookings.length}`)
    console.log(`  - Invoices: ${invoiceCount}`)
    console.log(`  - Maintenance Records: ${maintenanceRecords.length}\n`)

    return {
      success: true,
      summary: {
        vehicles: vehicles.length,
        customers: customers.length,
        bookings: bookings.length,
        invoices: invoiceCount,
        maintenanceRecords: maintenanceRecords.length,
      },
    }
  } catch (error: any) {
    console.error('❌ Error seeding demo data:', error)
    console.error(error.stack)
    throw error
  }
}

// Run if called directly
if (require.main === module) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}

export { seedDemoData }

