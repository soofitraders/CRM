import { readFileSync, writeFileSync } from 'fs'
import { glob } from 'glob'

const files = glob.sync('app/api/**/*.ts')

files.forEach((file) => {
  let content = readFileSync(file, 'utf-8')
  let modified = false

  // Fix validationResult.error.errors to validationResult.error.issues
  if (content.includes('.error.errors')) {
    content = content.replace(/\.error\.errors/g, '.error.issues')
    modified = true
  }

  if (modified) {
    writeFileSync(file, content, 'utf-8')
    console.log(`Fixed: ${file}`)
  }
})

console.log('Done!')

