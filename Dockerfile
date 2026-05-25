FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY packages/ ./packages/

RUN npm install
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=@agent-office/server"]
