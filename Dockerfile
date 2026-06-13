# Use official Node.js runtime as parent image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json to install dependencies
COPY package*.json ./

# Install production dependencies
RUN npm install --only=production

# Copy all project files to the container
COPY . .

# Expose the port (Cloud Run sets the PORT env variable automatically, defaults to 8080)
EXPOSE 8080

# Start the Node.js server
CMD [ "npm", "start" ]
