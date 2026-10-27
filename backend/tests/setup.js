// Integration tests run against MongoDB Atlas but in a separate database that is dropped afterwards.
import 'dotenv/config'

process.env.NODE_ENV = 'test'
const uri = process.env.MONGODB_URI || ''
if (uri) {
  // .../daybook?options  ->  .../daybook_test?options
  process.env.MONGODB_URI = uri.replace(/(mongodb(?:\+srv)?:\/\/[^/]+\/)([^?]*)/, '$1daybook_test')
}
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-123'
