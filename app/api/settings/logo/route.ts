export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import Settings from '@/lib/models/Settings'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { logger } from '@/lib/utils/performance'
import fs from 'fs'
import path from 'path'

// POST - Upload logo (only SUPER_ADMIN and ADMIN)
export async function POST(request: NextRequest) {
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

    // Check permissions - Only SUPER_ADMIN and ADMIN can upload logo
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('logo') as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 2MB' }, { status: 400 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Save to public/logo.png
    const logoPath = path.join(process.cwd(), 'public', 'logo.png')
    fs.writeFileSync(logoPath, buffer)

    // Update settings with logo URL
    let settings = await Settings.findOne()
    if (!settings) {
      settings = await Settings.create({})
    }
    settings.logoUrl = '/logo.png'
    await settings.save()

    logger.log(`[Settings] Logo uploaded successfully by ${user.email}`)

    return NextResponse.json({ 
      success: true, 
      logoUrl: '/logo.png',
      message: 'Logo uploaded successfully' 
    })
  } catch (error: any) {
    logger.error('Error uploading logo:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload logo' },
      { status: 500 }
    )
  }
}
