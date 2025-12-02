# Quick Render Deployment Guide

## 🚀 Step-by-Step Render Deployment

### 1. Prepare Your Repository
- ✅ Code is pushed to GitHub: `https://github.com/soofitraders/CRM.git`
- ✅ `render.yaml` is in the root directory
- ✅ All environment variables are documented

### 2. Create Render Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account if not already connected
4. Select repository: `soofitraders/CRM`
5. Render will auto-detect settings from `render.yaml`

### 3. Configure Environment Variables

In the Render dashboard, go to your service → **Environment** tab:

#### Required Variables:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXTAUTH_URL=https://your-service-name.onrender.com
```

**Important:** 
- Replace `your-service-name` with your actual Render service name
- Generate `NEXTAUTH_SECRET` using: `openssl rand -base64 32`

#### Optional Variables:

```env
CACHE_TTL=300
CACHE_MAX_SIZE=1000
RECURRING_EXPENSE_API_KEY=your-secure-api-key
```

### 4. Deploy

1. Click **"Create Web Service"** or **"Save Changes"**
2. Render will:
   - Install dependencies
   - Build the application
   - Start the server
3. Wait for deployment to complete (usually 5-10 minutes)

### 5. Update NEXTAUTH_URL After First Deploy

After the first deployment:
1. Copy your Render URL (e.g., `https://misterwheels-crm.onrender.com`)
2. Go to Environment variables
3. Update `NEXTAUTH_URL` to your actual Render URL
4. Redeploy (or it will auto-redeploy)

### 6. Verify Deployment

1. Visit your Render URL
2. Check health endpoint: `https://your-app.onrender.com/api/health`
3. Should return: `{"status":"healthy","database":"connected"}`

## 🔧 Local Development

### Setup

1. Copy `.env.example` to `.env`
2. Fill in your local values:

```env
MONGODB_URI=mongodb://localhost:27017/misterwheels
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-local-secret
```

3. Run: `npm run dev`

## 📝 Environment Variables Summary

| Variable | Localhost | Render | Required |
|----------|-----------|--------|----------|
| `MONGODB_URI` | `mongodb://localhost:27017/misterwheels` | MongoDB Atlas connection string | ✅ Yes |
| `NEXTAUTH_URL` | `http://localhost:3000` | `https://your-app.onrender.com` | ✅ Yes |
| `NEXTAUTH_SECRET` | Any secure string | Generate with `openssl rand -base64 32` | ✅ Yes |
| `CACHE_TTL` | `300` (default) | `300` (default) | ❌ No |
| `CACHE_MAX_SIZE` | `1000` (default) | `1000` (default) | ❌ No |
| `RECURRING_EXPENSE_API_KEY` | Optional | Optional | ❌ No |

## 🎯 Key Features

✅ **Auto-detection**: App automatically detects localhost vs Render  
✅ **Health Check**: Built-in `/api/health` endpoint for monitoring  
✅ **Standalone Build**: Optimized for Render deployment  
✅ **Environment-aware**: Works seamlessly in both environments  

## 🐛 Troubleshooting

### Build Fails
- Check Node.js version (should be 18+)
- Verify all dependencies in `package.json`
- Check Render build logs

### Database Connection Issues
- Verify `MONGODB_URI` is correct
- Check MongoDB Atlas IP whitelist (add `0.0.0.0/0` for Render)
- Ensure database user has proper permissions

### Authentication Not Working
- Verify `NEXTAUTH_URL` matches your Render URL exactly (including `https://`)
- Check `NEXTAUTH_SECRET` is set
- Clear browser cookies and try again

## 📚 More Information

See [README_DEPLOYMENT.md](./README_DEPLOYMENT.md) for detailed documentation.

