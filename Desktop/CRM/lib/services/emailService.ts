import nodemailer from 'nodemailer'
import User from '@/lib/models/User'

interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

// Create reusable transporter
let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (transporter) {
    return transporter
  }

  // Configure email transporter
  // For production, use environment variables for SMTP settings
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASSWORD || '',
    },
  })

  return transporter
}

/**
 * Send an email notification
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    // Skip email sending if SMTP is not configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.warn('SMTP not configured. Email not sent:', options.subject)
      return
    }

    const emailTransporter = getTransporter()

    const mailOptions = {
      from: `"MisterWheels CRM" <${process.env.SMTP_USER}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    }

    await emailTransporter.sendMail(mailOptions)
    console.log('Email sent successfully:', options.subject)
  } catch (error) {
    console.error('Error sending email:', error)
    // Don't throw - email failures shouldn't break the application
  }
}

/**
 * Send notification email to a user
 */
export async function sendNotificationEmail(
  userId: string,
  notification: {
    title: string
    message: string
    type: string
  }
): Promise<void> {
  try {
    const user = await User.findById(userId).select('email emailNotifications name').lean()

    if (!user) {
      console.warn('User not found for notification email:', userId)
      return
    }

    // Check if user has email notifications enabled
    if (user.emailNotifications === false) {
      console.log('Email notifications disabled for user:', userId)
      return
    }

    if (!user.email) {
      console.warn('User has no email address:', userId)
      return
    }

    const emailSubject = `[MisterWheels] ${notification.title}`
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${notification.title}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #F2B233 0%, #E6A020 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 28px;">MISTERWHEELS</h1>
            <p style="color: #fff; margin: 5px 0 0 0; font-size: 14px;">RENT A CAR LLC</p>
          </div>
          <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #111827; margin-top: 0; font-size: 22px;">${notification.title}</h2>
            <div style="background: #f5f5f7; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #4b5563; font-size: 16px;">${notification.message}</p>
            </div>
            <p style="color: #9ca3af; font-size: 14px; margin-top: 30px;">
              This is an automated notification from MisterWheels CRM System.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
              © ${new Date().getFullYear()} MisterWheels. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `

    await sendEmail({
      to: user.email,
      subject: emailSubject,
      html: emailHtml,
    })
  } catch (error) {
    console.error('Error sending notification email:', error)
  }
}

/**
 * Send notification emails to multiple users
 */
export async function sendBulkNotificationEmails(
  userIds: string[],
  notification: {
    title: string
    message: string
    type: string
  }
): Promise<void> {
  // Send emails in parallel (but limit concurrency)
  const batchSize = 10
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize)
    await Promise.all(
      batch.map((userId) => sendNotificationEmail(userId, notification))
    )
  }
}

