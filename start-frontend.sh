#!/bin/bash

# Start Frontend Script for Glasgow Bengali FC
# This script starts the React frontend development server

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

echo -e "${BLUE}🚀 Starting Glasgow Bengali FC Frontend...${NC}"
echo -e "${YELLOW}📁 Project Root: $PROJECT_ROOT${NC}"
echo -e "${YELLOW}📁 Frontend Directory: $FRONTEND_DIR${NC}"

# Check if frontend directory exists
if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}❌ Error: Frontend directory not found at $FRONTEND_DIR${NC}"
    echo -e "${RED}❌ Please ensure you're running this script from the project root${NC}"
    exit 1
fi

# Navigate to frontend directory
cd "$FRONTEND_DIR"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found in frontend directory${NC}"
    echo -e "${RED}❌ Please ensure the frontend is properly set up${NC}"
    exit 1
fi

# Check if node_modules exists, if not run npm install
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 node_modules not found, running npm install...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Error: npm install failed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
fi

# Check if .env file exists, if not copy from example
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo -e "${YELLOW}📝 .env file not found, copying from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ .env file created from example${NC}"
    echo -e "${YELLOW}⚠️  Please update the .env file with your configuration${NC}"
fi

# Display environment info
echo -e "${BLUE}ℹ️  Environment Information:${NC}"
echo -e "${BLUE}   Node.js: $(node --version)${NC}"
echo -e "${BLUE}   npm: $(npm --version)${NC}"

# Check if the development server is already running
if lsof -ti:5173 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Frontend server is already running on port 5173${NC}"
    echo -e "${YELLOW}🔄 Stopping existing frontend server...${NC}"
    
    # Get the PID of the process running on port 5173
    FRONTEND_PID=$(lsof -ti:5173)
    
    if [ -n "$FRONTEND_PID" ]; then
        echo -e "${YELLOW}🛑 Killing process $FRONTEND_PID on port 5173...${NC}"
        kill -TERM $FRONTEND_PID 2>/dev/null || true
        
        # Wait a moment for graceful shutdown
        sleep 3
        
        # Check if process is still running and force kill if needed
        if lsof -ti:5173 > /dev/null 2>&1; then
            echo -e "${RED}⚡ Force killing remaining process on port 5173...${NC}"
            lsof -ti:5173 | xargs kill -9 2>/dev/null || true
            sleep 2
        fi
        
        echo -e "${GREEN}✅ Frontend server stopped successfully${NC}"
    fi
else
    echo -e "${GREEN}✅ Port 5173 is available${NC}"
fi

# Additional check to ensure port is completely free
for i in {1..5}; do
    if ! lsof -ti:5173 >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Port 5173 is confirmed free${NC}"
        break
    fi
    echo -e "${YELLOW}⏳ Waiting for port 5173 to be released... ($i/5)${NC}"
    sleep 1
done

echo -e "${GREEN}🎯 Starting React development server...${NC}"
echo -e "${GREEN}🌐 Frontend will be available at: http://localhost:5173${NC}"
echo -e "${GREEN}🔥 Hot reload enabled${NC}"
echo -e "${YELLOW}⚡ Press Ctrl+C to stop the server${NC}"
echo ""

# Start the development server
npm run dev
