import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'

/**
 * Health check endpoint for Render and other monitoring services
 * Returns 200 if the application and database are healthy
 */
export async function GET() {
  try {
    // Check database connection
    await connectDB()
    
    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: 'connected',
      },
      { status: 200 }
    )
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: 'disconnected',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Database connection failed',
      },
      { status: 503 }
    )
  }
}

