/**
 * One set of rules for "what did this vehicle's expenses cost", used by the Expenses page
 * summary and by the Vehicle Performance page so both always show the same numbers.
 *
 *  - running expenses : fuel, fines, etc. These reduce the vehicle's net profit.
 *  - maintenance      : expenses created by a maintenance job. The Performance page already
 *                       counts the job itself as "Maintenance", so they are kept apart here
 *                       and never added to running expenses (that would count them twice).
 *  - purchase cost    : the buying price of the car (category VEHICLE_PURCHASE). It is not a
 *                       running cost, so it is shown on its own and never reduces net profit.
 *
 * Deleted expenses must be removed by the caller (query with isDeleted != true).
 */
export interface VehicleExpenseSummary {
  /** running + maintenance: everything except the purchase price (matches the rows listed) */
  totalExpenses: number
  runningTotal: number
  maintenanceTotal: number
  purchaseCost: number
  count: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function isPurchaseExpense(expense: any, purchaseCategoryId: string): boolean {
  return !!purchaseCategoryId && String(expense?.category?._id ?? expense?.category) === purchaseCategoryId
}

export function summarizeVehicleExpenses(expenses: any[], purchaseCategoryId: string): VehicleExpenseSummary {
  let runningTotal = 0
  let maintenanceTotal = 0
  let purchaseCost = 0
  for (const e of expenses) {
    const amount = Number(e?.amount) || 0
    if (isPurchaseExpense(e, purchaseCategoryId)) purchaseCost += amount
    else if (e?.maintenanceRecord) maintenanceTotal += amount
    else runningTotal += amount
  }
  return {
    totalExpenses: round2(runningTotal + maintenanceTotal),
    runningTotal: round2(runningTotal),
    maintenanceTotal: round2(maintenanceTotal),
    purchaseCost: round2(purchaseCost),
    count: expenses.length,
  }
}
