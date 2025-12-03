import { readFileSync, writeFileSync } from 'fs'
import { glob } from 'glob'

const files = glob.sync('app/api/**/*.ts')

files.forEach((file) => {
  let content = readFileSync(file, 'utf-8')
  let modified = false

  // Replace 'OPERATIONS' with 'MANAGER' in role arrays
  if (content.includes("'OPERATIONS'")) {
    content = content.replace(/'OPERATIONS'/g, "'MANAGER'")
    modified = true
  }

  if (modified) {
    writeFileSync(file, content, 'utf-8')
    console.log(`Fixed: ${file}`)
  }
})

console.log('Done!')

