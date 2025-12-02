# Deployment Guide for MisterWheels CRM

This guide explains how to deploy the MisterWheels CRM application on Render while maintaining compatibility with localhost development.

## 🚀 Render Deployment

### Prerequisites

1. **GitHub Repository**: Your code should be pushed to GitHub
2. **MongoDB Atlas Account**: For production database (or use Render's MongoDB service)
3. **Render Account**: Sign up at [render.com](https://render.com)

### Step 1: Create a New Web Service on Render

1. Go to your Render dashboard
2. Click "New +" → "Web Service"
3. Connect your GitHub repository: `https://github.com/soofitraders/CRM.git`
4. Render will auto-detect the settings from `render.yaml`

### Step 2: Configure Environment Variables

In the Render dashboard, go to your service → Environment tab and add:

#### Required Variables:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
NEXTAUTH_URL=https://crm-n5iw.onrender.com
NEXTAUTH_SECRET=your-generated-secret-key-here
```

#### Optional Variables:

```env
CACHE_TTL=300
CACHE_MAX_SIZE=1000
RECURRING_EXPENSE_API_KEY=your-api-key-here
```

### Step 3: Generate NEXTAUTH_SECRET

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

Or use Node.js:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Step 4: Deploy

1. Click "Create Web Service" or "Save Changes"
2. Render will automatically:
   - Install dependencies (`npm install`)
   - Build the application (`npm run build`)
   - Start the server (`npm start`)
3. Your app will be available at: `https://your-app-name.onrender.com`

## 🔧 Local Development Setup

### Step 1: Clone and Install

```bash
git clone https://github.com/soofitraders/CRM.git
cd CRM
npm install
```

### Step 2: Create Environment File

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### Step 3: Configure Local Environment Variables

Edit `.env` file:

```env
# For local MongoDB or MongoDB Atlas
MONGODB_URI=mongodb://localhost:27017/misterwheels
# OR
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database

# Local development URL
NEXTAUTH_URL=http://localhost:3000

# Generate a secret for local development
NEXTAUTH_SECRET=your-local-secret-key

# Optional cache settings
CACHE_TTL=300
CACHE_MAX_SIZE=1000
```

### Step 4: Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## 📋 Environment Variables Reference

### Required Variables

| Variable | Description | Localhost Example | Production Example |
|----------|-------------|-------------------|-------------------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/misterwheels` | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `NEXTAUTH_URL` | Application URL | `http://localhost:3000` | `https://your-app.onrender.com` |
| `NEXTAUTH_SECRET` | Secret key for JWT tokens | Any secure string | Generate with `openssl rand -base64 32` |

### Optional Variables

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `CACHE_TTL` | Cache time-to-live in seconds | `300` | 5 minutes |
| `CACHE_MAX_SIZE` | Maximum cache entries | `1000` | LRU eviction when exceeded |
| `RECURRING_EXPENSE_API_KEY` | API key for recurring expenses endpoint | - | Optional security |

## 🔄 Auto-Deployment

Render automatically deploys when you push to your main branch. To disable auto-deploy:

1. Go to your service settings
2. Under "Auto-Deploy", select "No"

## 🏥 Health Check

The application includes a health check endpoint at `/api/health` that:
- Checks database connectivity
- Returns service status
- Used by Render for monitoring

## 🛠️ Build Configuration

The application uses Next.js standalone output mode for optimal deployment:

- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Node Version**: Auto-detected (recommended: Node.js 18+)

## 📝 Render Service Configuration

The `render.yaml` file contains the service configuration:

```yaml
services:
  - type: web
    name: misterwheels-crm
    env: node
    plan: starter
    buildCommand: npm install && npm run build
    startCommand: npm start
    healthCheckPath: /api/health
```

### Upgrading Plan

To upgrade from `starter` to `standard` or `pro`:
1. Go to service settings in Render dashboard
2. Change the plan
3. Redeploy

## 🔐 Security Best Practices

1. **Never commit `.env` files** - They're in `.gitignore`
2. **Use different secrets** for development and production
3. **Rotate secrets** periodically
4. **Use MongoDB Atlas IP whitelist** - Restrict database access
5. **Enable MongoDB authentication** - Always use username/password

## 🐛 Troubleshooting

### Build Fails

- Check Node.js version (should be 18+)
- Verify all dependencies are in `package.json`
- Check build logs in Render dashboard

### Database Connection Issues

- Verify `MONGODB_URI` is correct
- Check MongoDB Atlas IP whitelist (add `0.0.0.0/0` for Render)
- Ensure database user has proper permissions

### Authentication Not Working

- Verify `NEXTAUTH_URL` matches your Render URL exactly
- Check `NEXTAUTH_SECRET` is set
- Ensure cookies are enabled in browser

### Application Crashes

- Check Render logs for errors
- Verify all environment variables are set
- Test health endpoint: `https://your-app.onrender.com/api/health`

## 📊 Monitoring

Render provides:
- **Logs**: Real-time application logs
- **Metrics**: CPU, memory, and request metrics
- **Events**: Deployment and error events

Access via your Render dashboard.

## 🔄 Updating the Application

1. Make changes locally
2. Test on localhost: `npm run dev`
3. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```
4. Render will automatically deploy the changes

## 📞 Support

For issues:
1. Check Render logs
2. Verify environment variables
3. Test health endpoint
4. Review application logs

---

**Note**: The application is configured to work seamlessly on both localhost and Render without any code changes. Just update the environment variables accordingly.

