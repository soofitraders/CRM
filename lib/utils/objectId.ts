/**
 * Is this text a well-formed MongoDB id (24 hex characters)?
 * Used to answer a bad id from a screen or script with a clear 400 message instead of a
 * 500 crash. (mongoose.isValidObjectId is too loose: it also accepts any 12-character text.)
 */
export const isObjectIdString = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)
