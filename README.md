# MisterWheels CRM - Car Rental Management System

**Version 1.0**

A comprehensive Car Rental Management System built with Next.js, MongoDB, and TypeScript. This CRM system provides complete management capabilities for car rental businesses including bookings, customers, vehicles, financials, and more.

## 🚀 Features

### 📊 Dashboard
- Real-time overview of key business metrics
- Booking statistics and trends
- Revenue summaries
- Quick access to recent activities
- Performance indicators

### 📅 Bookings Management
- **Create & Edit Bookings**: Full booking lifecycle management
- **Booking Status Tracking**: PENDING, CONFIRMED, CHECKED_OUT, CHECKED_IN, CANCELLED
- **Payment Status**: UNPAID, PARTIALLY_PAID, PAID
- **Deposit Management**: Track deposits with status (HELD, REFUNDED, FORFEITED)
- **Date Range Filtering**: Filter bookings by date ranges
- **Search Functionality**: Search bookings by notes and other criteria
- **Auto-Invoice Generation**: Automatically creates invoices when booking is confirmed
- **Booking Details**: View complete booking information including vehicle, customer, dates, and pricing

### 🚗 Vehicle/Units Management
- **Vehicle Inventory**: Complete vehicle management system
- **Vehicle Status**: AVAILABLE, RENTED, MAINTENANCE, UNAVAILABLE
- **Vehicle Categories**: Organize vehicles by category
- **Ownership Types**: Track vehicle ownership (OWNED, LEASED, PARTNERSHIP)
- **Vehicle Details**: Brand, model, year, plate number, VIN, mileage
- **Branch Management**: Track vehicle location across branches
- **Maintenance Records**: Track vehicle maintenance history
- **Fines & Penalties**: Record and manage fines/penalties for vehicles

### 👥 Customer/Client Management
- **Customer Profiles**: Complete customer information management
- **Customer Search**: Search customers by name, email, or phone
- **Booking History**: View all bookings for each customer
- **Customer Statistics**: Active bookings count, last booking date
- **Contact Information**: Name, email, phone, address
- **Customer Status**: Track customer account status

### 💰 Financial Management
- **Invoice Management**:
  - Create invoices from bookings
  - Custom invoice creation
  - Invoice status tracking (DRAFT, ISSUED, PAID, VOID)
  - **Deposit Integration**: Deposits automatically included in invoices and deducted from total
  - **PDF Export**: Export invoices as PDF documents
  - Invoice number generation
  - Tax calculations
  - Line items management
  
- **Payment Tracking**:
  - Payment method tracking (CASH, CARD, BANK_TRANSFER, ONLINE)
  - Payment status (PENDING, SUCCESS, FAILED, REFUNDED)
  - Transaction ID management
  - Payment history

### 👤 User & Role Management
- **Role-Based Access Control (RBAC)**:
  - SUPER_ADMIN: Full system access
  - ADMIN: Administrative access
  - MANAGER: Management operations
  - SALES_AGENT: Sales and booking management
  - FINANCE: Financial operations
  - CUSTOMER: Customer portal access
  - INVESTOR: Investor dashboard access
  
- **User Management**: Create, edit, and manage user accounts
- **Permission System**: Granular permissions based on roles
- **User Preferences**: User-specific settings and preferences

### 📄 Document Management
- **Document Storage**: Upload and manage documents
- **Document Types**: Support for various document types
- **Document Association**: Link documents to bookings, vehicles, customers

### 🔔 Notifications
- **System Notifications**: Real-time notifications for important events
- **Notification Types**: Various notification types for different events

### 🎫 Support Tickets
- **Ticket Management**: Create and manage support tickets
- **Ticket Status**: Track ticket status and resolution

### ⚙️ Settings
- **System Settings**: Configure system-wide settings
- **Company Information**: Manage company details
- **Preferences**: User and system preferences

### 🔐 Authentication & Security
- **NextAuth.js Integration**: Secure authentication system
- **Session Management**: Secure session handling
- **Password Hashing**: Bcrypt password hashing
- **Protected Routes**: Middleware-based route protection

### 📱 Responsive Design
- **Mobile-Friendly**: Fully responsive design
- **Modern UI**: Clean and intuitive user interface
- **Dark Theme**: Professional dark theme design

### ⚡ Performance Optimizations
- **Database Indexing**: Optimized database queries with indexes
- **Query Optimization**: N+1 query problem fixes
- **API Response Caching**: Cached API responses for better performance
- **Connection Pooling**: Optimized MongoDB connection management
- **Lean Queries**: Efficient data fetching with Mongoose lean()

## 🛠️ Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose
- **Authentication**: NextAuth.js
- **Styling**: Tailwind CSS
- **Form Handling**: React Hook Form with Zod validation
- **PDF Generation**: PDFKit
- **Icons**: Lucide React

## 📦 Installation

### Prerequisites

1. **Node.js** (v18 or higher)
2. **MongoDB** (Local or MongoDB Atlas)
3. **npm** or **yarn**

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/Azfar8888/MisterWheels-CRM.git
   cd MisterWheels-CRM
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="your-mongodb-connection-string"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key-change-in-production"
   ```

   **MongoDB Connection String Examples:**
   - **MongoDB Atlas (Cloud):**
     ```
     mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
     ```
   - **Local MongoDB:**
     ```
     mongodb://localhost:27017/crm
     ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🗄️ Database Setup

The application uses MongoDB with Mongoose. The database schema includes:

- **Users**: User accounts and authentication
- **Vehicles**: Vehicle inventory and details
- **Bookings**: Rental bookings
- **Customers**: Customer profiles
- **Invoices**: Financial invoices
- **Payments**: Payment records
- **Documents**: Document storage
- **Maintenance Records**: Vehicle maintenance history
- **Fines/Penalties**: Fines and penalty tracking
- **Notifications**: System notifications
- **Support Tickets**: Customer support tickets
- **Settings**: System settings

## 📝 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run seed:admin` - Seed super admin user

## 🔑 Default Credentials

After seeding the database, you can log in with:
- **Email**: admin@misterwheels.com
- **Password**: (set during seed)

## 📋 Key Features in Detail

### Invoice System
- Automatic invoice generation when booking is confirmed
- Deposit amounts automatically included and deducted from invoice total
- PDF export functionality for invoices
- Invoice status management (DRAFT, ISSUED, PAID, VOID)
- Custom invoice creation with line items
- Tax calculation and subtotal management

### Booking System
- Complete booking lifecycle management
- Automatic invoice creation for confirmed bookings
- Deposit tracking and management
- Payment status tracking
- Date range filtering and search
- Booking status workflow

### Financial Management
- Comprehensive invoice management
- Payment tracking and history
- Deposit management
- Financial reporting capabilities
- PDF invoice generation

## 🚀 Deployment

### Deploy on Render (Recommended)

See [README_DEPLOYMENT.md](./README_DEPLOYMENT.md) for detailed deployment instructions.

**Quick Steps:**
1. Push your code to GitHub
2. Create a new Web Service on Render
3. Connect your GitHub repository
4. Add environment variables (see below)
5. Deploy!

### Deploy on Vercel

1. Push your code to GitHub
2. Import your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Environment Variables for Production

**Required:**
- `MONGODB_URI`: Your MongoDB connection string (MongoDB Atlas recommended)
- `NEXTAUTH_URL`: Your production URL (e.g., `https://your-app.onrender.com`)
- `NEXTAUTH_SECRET`: A strong secret key (generate with `openssl rand -base64 32`)

**Optional:**
- `CACHE_TTL`: Cache time-to-live in seconds (default: 300)
- `CACHE_MAX_SIZE`: Maximum cache entries (default: 1000)
- `RECURRING_EXPENSE_API_KEY`: API key for recurring expenses endpoint

## 📄 License

This project is private and proprietary.

## 👨‍💻 Developer

**Azfar Ul Hussain**
- GitHub: [@Azfar8888](https://github.com/Azfar8888)

## 🔄 Version History

### Version 1.0 (Current)
- Initial release
- Complete CRM functionality
- Booking management
- Customer management
- Vehicle/Units management
- Financial management with invoices and payments
- PDF invoice export
- Role-based access control
- Responsive design
- Performance optimizations

---

**Built with ❤️ for MisterWheels Car Rental Management**
