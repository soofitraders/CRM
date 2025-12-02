#!/bin/bash
# Start script for Render deployment using Next.js standalone build

# Get the port from Render (automatically provided)
PORT=${PORT:-3000}

# Change to the standalone directory
cd .next/standalone

# Start the server
node server.js

