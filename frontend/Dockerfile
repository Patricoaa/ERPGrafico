FROM node:20

WORKDIR /app

COPY package*.json ./

# Install dependencies if package.json exists, otherwise we'll mount them or install later
RUN if [ -f package.json ]; then npm install; fi

# Copy the rest of the code
COPY . .

# Expose port
EXPOSE 3000

CMD ["npm", "run", "dev"]
