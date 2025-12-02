# Recurring Expenses Cron Job Setup

This document explains how to set up automated processing of recurring expenses.

## Overview

Recurring expenses are automatically processed by calling the `/api/recurring-expenses/process` endpoint. This endpoint:
- Finds all active recurring expenses that are due
- Creates Expense records for each due recurring expense
- Updates the next due date for each recurring expense
- Tracks occurrence counts

## Setup Options

### Option 1: External Cron Service (Recommended)

Use a service like:
- **cron-job.org** - Free cron job service
- **EasyCron** - Reliable cron service
- **Vercel Cron** - If deployed on Vercel

**Configuration:**
- URL: `https://your-domain.com/api/recurring-expenses/process`
- Method: POST
- Headers: `Authorization: Bearer YOUR_API_KEY`
- Schedule: Daily at 00:00 UTC (or your preferred time)

**Environment Variable:**
Add to your `.env` file:
```
RECURRING_EXPENSE_API_KEY=your-secure-api-key-here
```

### Option 2: Server-Side Cron (Node.js)

If you have access to the server, you can use `node-cron`:

```bash
npm install node-cron
```

Create a file `lib/cron/scheduler.ts`:

```typescript
import cron from 'node-cron'
import { processRecurringExpenses } from '@/lib/services/recurringExpenseService'
import connectDB from '@/lib/db'

// Run daily at midnight
cron.schedule('0 0 * * *', async () => {
  console.log('Processing recurring expenses...')
  try {
    await connectDB()
    const result = await processRecurringExpenses()
    console.log('Recurring expenses processed:', result)
  } catch (error) {
    console.error('Error processing recurring expenses:', error)
  }
})
```

Then import this in your main application file.

### Option 3: Manual Processing

You can manually trigger processing by:
1. Making a POST request to `/api/recurring-expenses/process`
2. Using the admin panel (if implemented)
3. Calling the service function directly

## Testing

To test the processing endpoint:

```bash
curl -X POST https://your-domain.com/api/recurring-expenses/process \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

Or use a tool like Postman or Thunder Client.

## Monitoring

Check the response from the processing endpoint:
- `processed`: Number of expenses successfully created
- `errors`: Number of errors encountered
- `details`: Array of processing results with IDs and any errors

## Best Practices

1. **Schedule**: Run daily, preferably at midnight or early morning
2. **Monitoring**: Set up alerts for processing failures
3. **Backup**: Ensure database backups are in place
4. **Logging**: Monitor the processing logs regularly
5. **Testing**: Test with a few recurring expenses before full deployment

## Troubleshooting

- **No expenses processed**: Check that recurring expenses are active and have due dates in the past
- **Authentication errors**: Verify the API key is correct
- **Database errors**: Check database connection and schema
- **Date issues**: Ensure server timezone is set correctly

