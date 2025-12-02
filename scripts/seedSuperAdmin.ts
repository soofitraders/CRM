import { config } from 'dotenv'
import { resolve } from 'path'
import connectDB from '../lib/db'
import User from '../lib/models/User'
import bcrypt from 'bcryptjs'

// Load environment variables from .env
const envPath = resolve(process.cwd(), '.env')
config({ path: envPath })

async function seedSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@misterwheels.com'
  const password = process.env.SUPER_ADMIN_PASSWORD || 'Admin123!'
  const name = process.env.SUPER_ADMIN_NAME || 'Super Admin'

  try {
    console.log('Connecting to MongoDB Atlas...')
    await connectDB()
    console.log('✓ Connected successfully\n')

    // Check if super admin already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() })

    if (existingUser) {
      console.log('Super admin already exists. Updating password...')
      const passwordHash = await bcrypt.hash(password, 12)
      existingUser.passwordHash = passwordHash
      existingUser.role = 'SUPER_ADMIN'
      existingUser.status = 'ACTIVE'
      await existingUser.save()
      console.log('✓ Super admin password updated successfully\n')
    } else {
      console.log('Creating super admin user...')
      const passwordHash = await bcrypt.hash(password, 12)

      const superAdmin = new User({
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      })

      await superAdmin.save()
      console.log('✓ Super admin created successfully\n')
    }

    console.log('Credentials:')
    console.log('  Email:', email)
    console.log('  Password:', password)
    console.log('  Role: SUPER_ADMIN')
    process.exit(0)
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    if (error.message.includes('MONGODB_URI')) {
      console.error('\nPlease make sure MONGODB_URI is set in .env or .env.local')
    }
    process.exit(1)
  }
}

seedSuperAdmin()
